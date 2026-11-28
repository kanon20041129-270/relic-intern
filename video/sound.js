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
  const beat = 60 / 124;
  // D major: I–V–vi–IV, one chord per bar.
  const harmony = [[50, 66, 69, 74], [45, 64, 69, 73], [47, 66, 71, 74], [43, 62, 67, 71]];
  for (let step = 0; step * beat / 2 < timing.end; step++) {
    const time = step * beat / 2;
    if (rests.some(([from, to]) => time >= from && time < to)) continue;
    const [root, third, fifth, top] = harmony[Math.floor(step / 8) % harmony.length];
    const position = step % 8;
    const add = (type, note) => music.push({time, type, note});
    if (position % 2 === 1) add('bass', position === 7 ? root + 7 : root);
    if (position % 4 === 0) add('kick');
    if (position % 4 === 2) add('clap');
    const melody = [fifth, third, null, top, fifth, null, third, fifth];
    if (melody[position]) add('pluck', melody[position]);
    if (position === 3 || position === 7) add('bell', top + 12);
  }

  const fx = (time, type, note) => effects.push({time, type, note});
  const chime = time => [74, 78, 81].forEach((note, i) => fx(time + .085 * i, 'bell', note));
  fx(.04, 'bubble');
  fx(duration === 15 ? 1.36 : 1.64, 'thump');
  fx(timing.reply - .24, 'swipe');
  fx(timing.answer, 'stick');
  if (duration === 15) fx(timing.proof, 'swipe');
  timing.chips.forEach((time, i) => fx(time, 'glock', [81, 85, 88][i]));
  chime(timing.approve);
  if (duration === 30) {
    fx(timing.review, 'swipe');
    fx(14.60, 'stick');
    fx(timing.phone, 'swipe');
    fx(17.3, 'bubble');
  }
  fx(timing.faq, 'thump');
  fx(timing.diff, 'swipe');
  fx(timing.publish, 'stick');
  fx(timing.end, 'stick');
  chime(timing.end + .10);
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

  const delay = new DelayNode(context, {delayTime:60 / 124 / 2});
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

  // Fixed taps keep the chime tails repeatable during offline rendering.
  const wet = gain();
  for (const [time, level] of [[.027, .18], [.053, .11], [.089, .07]]) {
    const tap = new DelayNode(context, {delayTime:time});
    wet.connect(tap).connect(gain(level)).connect(effects);
  }
  const white = noise(.52, 1, () => 1);

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
      envelope(oscillator, length, level, options);
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
      case 'pluck':
        tone(f, f, .15, .21, {wave:'triangle', echo:true});
        tone(f * 2, f * 2, .085, .058, {wave:'triangle'});
        break;
      case 'bass':
        tone(f, f, .205, .27, {attack:.009});
        tone(f, f, .14, .11, {wave:'triangle', attack:.008});
        break;
      case 'kick':
        tone(110, 46, .17, .25, {attack:.003});
        break;
      case 'clap':
        grain(white, filter('bandpass', 1600, .65), 1100, .105, .20);
        grain(white, filter('highpass', 3800), 2200, .05, .12);
        break;
      case 'bubble':
        tone(740, 1030, .065, .20);
        tone(1400, 1500, .038, .045);
        break;
      case 'swipe':
        grain(white, filter('bandpass', 1100, .65), 4800, .21, .29, true);
        break;
      case 'stick':
        tone(260, 185, .085, .23, {wave:'triangle'});
        grain(white, filter('bandpass', 2600, .75), 1150, .065, .22);
        break;
      case 'thump':
        tone(130, 57, .19, .38, {attack:.004});
        grain(white, filter('lowpass', 1500), 600, .08, .13);
        break;
      case 'glock':
        tone(f, f, .27, .20, {attack:.002, send:.20});
        tone(f * 2.76, f * 2.76, .075, .036, {attack:.002});
        tone(f * 5.40, f * 5.40, .048, .014, {attack:.002});
        break;
      case 'bell':
        tone(f, f, .48, .20, {attack:.004, send:output === effects ? .24 : 0});
        tone(f * 2.01, f * 2.01, .19, .041, {send:output === effects ? .15 : 0});
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
