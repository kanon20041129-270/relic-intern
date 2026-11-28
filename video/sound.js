'use strict';

const hz = note => 440 * 2 ** ((note - 69) / 12);
const db = gain => 10 ** (gain / 20);

async function fetchAsset(path, read) {
  try {
    const response = await fetch(path, {mode:'same-origin'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await read(response);
  } catch (error) {
    throw new Error(`${path} — ${error.message}`, {cause:error});
  }
}

async function loadNarration(duration, starts) {
  const root = './assets/narration';
  const manifest = await fetchAsset(`${root}/lines.json`, response => response.json());
  const entries = manifest[duration];
  if (!Array.isArray(entries) || entries.length !== starts.length) {
    throw new Error(`${root}/lines.json — ${duration}秒版の文数が一致しません。`);
  }
  const decoder = new OfflineAudioContext(2, 1, 48000);
  return Promise.all(entries.map(async ({file, duration: length}, i) => {
    const path = `${root}/${duration}/${file}`;
    if (!/^\d{2}\.wav$/.test(file) || !Number.isFinite(length) || length <= 0) {
      throw new Error(`${root}/lines.json — ${path} の指定が無効です。`);
    }
    const buffer = await fetchAsset(path, async response => decoder.decodeAudioData(await response.arrayBuffer()));
    return {time:starts[i], length, buffer};
  }));
}

function buildScore(duration, timing, rests) {
  const music = [];
  const effects = [];
  const add = (list, time, type, note) => list.push({time, type, note});
  const fx = (time, type, note) => add(effects, time, type, note);
  for (const time of [0, .5]) add(music, time, 'key', time ? 69 : 62);

  const harmony = [[62, 69, 66, 76], [59, 66, 69, 73], [55, 62, 66, 69], [57, 64, 71, 73]];
  for (let beat = 4; beat < (timing.end - .55) * 4; beat++) {
    const time = beat / 4;
    if (rests.some(([from, to]) => time >= from - .18 && time < to)) continue;
    const chord = harmony[Math.floor(beat / 8) % harmony.length];
    add(music, time, 'pluck', chord[beat % chord.length]);
    if (beat % 2 === 0) add(music, time, 'bass', chord[0] - 24);
    if (time > timing.answer && beat % 4 === 0) add(music, time, 'kick');
  }

  fx(timing.wipe - .5, 'rise');
  fx(timing.wipe - .42, 'reverse');
  fx(timing.reply, 'fall');
  fx(timing.answer, 'impact');
  add(music, timing.answer, 'kick');
  fx(timing.answer, 'shimmer', 74);
  timing.chips.forEach((time, i) => fx(time, 'glock', [86, 90, 93][i]));
  if (duration === 15) fx(timing.approve, 'key', 66);
  fx(duration === 15 ? 8.07 : timing.approve, 'bell', 78);
  fx(timing.publish, 'bell', 81);
  if (duration === 30) fx(14.60, 'key', 69);
  const logo = timing.end;
  fx(logo, 'bell', 74);
  fx(logo + .16, 'bell', 81);
  fx(logo + .16, 'shimmer', 74);
  return {music, effects};
}

function synthesize(context, destination, score, narration, start, duration, rests) {
  const gain = (level = 1) => new GainNode(context, {gain:level});
  const filter = (type, frequency, Q = .707, level = 0) =>
    new BiquadFilterNode(context, {type, frequency, Q, gain:level});
  const music = gain();
  const effects = gain();
  const voice = gain(1.58);
  const mix = gain(db(duration === 15 ? 1.9 : .95));
  const gate = gain();
  const limiter = new WaveShaperNode(context, {
    curve:Float32Array.from({length:8193}, (_, i) => {
      const value = i / 4096 - 1;
      const knee = .69;
      const limit = db(-1.25);
      const magnitude = Math.abs(value);
      return magnitude <= knee ? value :
        Math.sign(value) * (knee + (limit - knee) * Math.tanh((magnitude - knee) / (limit - knee)));
    }),
    oversample:'none'
  });
  music.connect(filter('peaking', 2500, .9, -3)).connect(mix);
  effects.connect(mix);
  voice.connect(filter('highpass', 80)).connect(mix);
  mix.connect(limiter).connect(gate).connect(destination);

  for (const [from, to] of [...rests, [duration - .5, duration]]) {
    gate.gain.setValueAtTime(1, start + from - .025);
    gate.gain.linearRampToValueAtTime(0, start + from);
    gate.gain.setValueAtTime(0, start + to);
    if (to < duration) gate.gain.linearRampToValueAtTime(1, start + to + .008);
  }

  const delay = new DelayNode(context, {delayTime:.1875});
  const feedback = gain(.17);
  delay.connect(feedback).connect(delay);
  delay.connect(gain(.10)).connect(music);

  let seed = 0x3543f721;
  function noise(seconds, channels, envelope) {
    const buffer = context.createBuffer(channels, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    for (let channel = 0; channel < channels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        samples[i] = seed / 2147483648 * envelope(i / samples.length);
      }
    }
    return buffer;
  }

  const room = noise(.65, 2, p => Math.exp(-8 * p) * (1 - p));
  const wet = new DelayNode(context, {delayTime:.015});
  wet.connect(new ConvolverNode(context, {buffer:room}))
    .connect(filter('highpass', 250)).connect(filter('lowpass', 6000)).connect(effects);
  const white = noise(.52, 1, () => 1);
  const reversed = noise(.42, 1, p => Math.exp(4 * (p - 1)));

  function playCue({time, type, note}, output) {
    const at = start + time;
    const f = hz(note ?? 62);
    function envelope(source, length, level, {attack = .005, send = 0, echo = false, sweep = false} = {}) {
      const shape = gain(0);
      source.connect(shape);
      shape.connect(output);
      if (send) shape.connect(gain(send)).connect(wet);
      if (echo) shape.connect(delay);
      shape.gain.setValueAtTime(0, at);
      shape.gain.linearRampToValueAtTime(level, at + (sweep ? length - .025 : attack));
      shape.gain.exponentialRampToValueAtTime(level * .015, at + length - .005);
      shape.gain.linearRampToValueAtTime(0, at + length);
    }

    function tone(from, to, length, level, options = {}) {
      const oscillator = new OscillatorNode(context, {frequency:from, type:options.wave ?? 'sine'});
      oscillator.frequency.setValueAtTime(from, at);
      oscillator.frequency.exponentialRampToValueAtTime(to, at + length);
      const lowpass = options.lowpass;
      if (lowpass) {
        lowpass.frequency.setValueAtTime(lowpass.frequency.value, at);
        envelope(oscillator.connect(lowpass), length, level, options);
      } else envelope(oscillator, length, level, options);
      oscillator.start(at);
      oscillator.stop(at + length);
    }

    function grain(buffer, node, to, length, level, sweep = false) {
      const source = new AudioBufferSourceNode(context, {buffer});
      node.frequency.setValueAtTime(node.frequency.value, at);
      node.frequency.exponentialRampToValueAtTime(to, at + length);
      envelope(source.connect(node), length, level, {sweep});
      source.start(at);
      source.stop(at + length);
    }

    switch (type) {
      case 'key':
        grain(white, filter('bandpass', 2200, 1.1), 1520, .06, .17);
        tone(f, f, .18, .15, {wave:'triangle'});
        break;
      case 'pluck': {
        const lowpass = filter('lowpass', 2800);
        lowpass.frequency.exponentialRampToValueAtTime(900, at + .13);
        tone(f, f, .17, .19, {wave:'triangle', echo:true});
        // A short second harmonic gives the pick definition under speech.
        tone(f * 2, f * 2, .10, .03, {lowpass});
        break;
      }
      case 'bass':
        tone(f, f, .29, .24, {attack:.012});
        tone(f, f, .20, .04, {wave:'triangle', attack:.012});
        break;
      case 'kick':
        tone(117, 47, .19, .28, {attack:.003});
        break;
      case 'impact':
        tone(390, 175, .095, .12, {wave:'triangle'});
        grain(white, filter('bandpass', 1970), 1010, .09, .11);
        break;
      case 'rise':
        grain(white, filter('bandpass', 800), 5000, .5, .12, true);
        break;
      case 'reverse':
        grain(reversed, filter('highpass', 3000), 4700, .42, .10, true);
        break;
      case 'fall':
        grain(white, filter('bandpass', 4000), 500, .35, .11);
        break;
      case 'glock':
        tone(f, f, .27, .20, {attack:.002, send:.20});
        tone(f * 2.76, f * 2.76, .075, .036, {attack:.002});
        tone(f * 5.40, f * 5.40, .048, .014, {attack:.002});
        break;
      case 'bell':
        tone(f, f, .48, .20, {attack:.004, send:.24});
        tone(f * 2.01, f * 2.01, .19, .041, {send:.15});
        break;
      case 'shimmer':
        // Route the octave directly to the wet path.
        const octave = new OscillatorNode(context, {frequency:f * 2});
        const send = gain(0);
        octave.connect(send).connect(wet);
        send.gain.setValueAtTime(0, at);
        send.gain.linearRampToValueAtTime(.12, at + .020);
        send.gain.exponentialRampToValueAtTime(.001, at + .31);
        octave.start(at);
        octave.stop(at + .32);
        break;
    }
  }

  score.music.forEach(cue => playCue(cue, music));
  score.effects.forEach(cue => playCue(cue, effects));

  const intervals = [];
  for (const {time, length, buffer} of narration) {
    const source = new AudioBufferSourceNode(context, {buffer});
    source.connect(voice);
    source.start(start + time);
    const interval = {from:time - .08, time, end:time + length};
    const previous = intervals.at(-1);
    if (previous && interval.from <= previous.end + .25) previous.end = interval.end;
    else intervals.push(interval);
  }
  for (const [bus, attenuation] of [[music, -8], [effects, -4]]) {
    for (const {from, time, end} of intervals) {
      bus.gain.setValueAtTime(1, start + from);
      bus.gain.linearRampToValueAtTime(db(attenuation), start + time);
      bus.gain.setValueAtTime(db(attenuation), start + end);
      bus.gain.linearRampToValueAtTime(1, start + end + .25);
    }
  }
}

function wavBase64(buffer) {
  const frames = buffer.length;
  const bytes = new Uint8Array(44 + frames * 4);
  const view = new DataView(bytes.buffer);
  function ascii(offset, content) {
    for (const [index, char] of [...content].entries()) view.setUint8(offset + index, char.charCodeAt(0));
  }
  ascii(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, frames * 4, true);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  for (let i = 0; i < frames; i++) {
    view.setInt16(44 + i * 4, Math.round(left[i] * 32767), true);
    view.setInt16(46 + i * 4, Math.round(right[i] * 32767), true);
  }
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 24576) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(i, i + 24576))));
  }
  return chunks.join('');
}
