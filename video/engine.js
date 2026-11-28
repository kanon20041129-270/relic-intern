'use strict';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const vertical = params.get('format') === 'vertical';
const embed = params.get('embed') === '1';
const frame = params.has('t');
const duration = 30;
const width = vertical ? 1080 : 1920;
const height = vertical ? 1920 : 1080;
const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const lerp = (a, b, p) => a + (b - a) * p;
const phase = (t, at, span) => clamp((t - at) / span);
const cubic = (a, b, c, d, t) => {
  const i = 1 - t;
  return i * i * i * a + 3 * i * i * t * b + 3 * i * t * t * c + t * t * t * d;
};
function enter(p) {
  if (p <= 0 || p >= 1) return p;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 13; i++) {
    const mid = (low + high) / 2;
    if (cubic(0, .05, .1, 1, mid) < p) low = mid;
    else high = mid;
  }
  return cubic(0, .7, 1, 1, (low + high) / 2);
}
const eased = (t, at, span) => enter(phase(t, at, span));
const accelerate = p => p * p * p;
function pose(el, opacity, transform = '') {
  el.style.opacity = opacity;
  el.style.transform = transform;
}
function rise(el, amount, opacity = amount, distance = 35) {
  pose(el, opacity, `translateY(${(1 - amount) * distance}px)`);
}

document.body.classList.toggle('vertical', vertical);
document.body.classList.toggle('embed', embed);
document.body.classList.toggle('safe', params.get('safe') === '1');
const viewport = $('viewport');
const stage = $('stage');
const overlay = $('overlay');
const poster = $('poster');
const playCircle = overlay.querySelector('.play-circle');
const playIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m10 6 17 10-17 10Z" fill="currentColor"/></svg>';
const replayIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 14a10 10 0 1 1 2 9M6 6v8h8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const formatParams = new URLSearchParams(params);
formatParams.set('format', vertical ? 'horizontal' : 'vertical');
$('switch').href = '?' + formatParams;
$('switch').textContent = vertical ? '横版' : '縦版';

function fit() {
  const scale = Math.min(viewport.clientWidth / width, viewport.clientHeight / height);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
new ResizeObserver(fit).observe(viewport);
fit();

const brand = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect width="100" height="100" rx="22" fill="#2E5BFF"/>
  <g fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path class="logo-line" pathLength="1" d="M73 36a27 27 0 1 0 2 26m-1-38v13H61"/>
    <path class="logo-line" pathLength="1" d="M41 39h18a7 7 0 0 1 7 7v7a7 7 0 0 1-7 7H48l-8 6v-6a7 7 0 0 1-6-7v-7a7 7 0 0 1 7-7Z"/>
  </g></svg><span>AnswerLoop</span>`;
const brands = [...document.querySelectorAll('.brand')];
brands.forEach(el => { el.innerHTML = brand; });
const logoLines = brands.map(el => [...el.querySelectorAll('.logo-line')]);
logoLines.flat().forEach(line => { line.style.strokeDasharray = '1 1'; });
function drawLogo(index, t, at) {
  logoLines[index].forEach((line, i) => {
    line.style.strokeDashoffset = 1 - eased(t, at + i * .15, .68);
  });
  rise(brands[index].lastElementChild, eased(t, at + .16, .48));
}

const notices = [
  '追加料金はいつ？', '請求書払いできますか', 'ユーザー追加の料金は',
  '日割り計算になりますか', '招待したらすぐ課金？', '請求書はいつ届きますか',
  '日割りの期間を教えてください', 'ユーザーを増やしたい', '請求の締め日は？',
  '追加分はいつ請求されますか', '請求書払いに切り替えたい', '今月の追加料金は？',
  '料金ページを確認しました', '追加ユーザーの請求について'
];
const noticeAt = [.12, .37, .61, .84, 1.06, 1.28, 1.49, 1.69, 1.88, 2.06, 2.22, 2.36, 2.49, 2.61];
const noticePositions = vertical
  ? [[27,395],[610,520],[195,270],[498,915],[-108,841],[660,315],[70,1070],[529,1130],[-93,575],[690,785],[91,1342],[579,1429],[10,153],[491,112]]
  : [[138,258],[1386,562],[1197,174],[305,766],[39,556],[1522,313],[1025,815],[20,108],[619,119],[1492,778],[-58,752],[757,927],[1444,51],[287,405]];
const noticeEls = notices.map((title, i) => {
  const el = document.createElement('div');
  el.className = 'notice';
  el.innerHTML = '<small>新着問い合わせ</small><b></b>';
  el.lastElementChild.textContent = title;
  el.style.left = noticePositions[i][0] + 'px';
  el.style.top = noticePositions[i][1] + 'px';
  $('notifications').append(el);
  return el;
});

const answer = 'お問い合わせありがとうございます。ユーザーを追加した場合、招待したユーザーが参加した時点で課金対象となり[K3]、追加日から月末までの日割り料金を次回のご請求に加算いたします[K1][K2]。';
const letters = [...answer].map(char => {
  const letter = document.createElement('span');
  letter.textContent = char;
  return letter;
});
$('draft-text').append(...letters);
let lastLetter = -1;
const bars = [['ユーザー追加時の料金',14],['請求書払い',9],['CSVインポート',6],['ログインできない',4],['領収書の発行',3]].map(([label, value]) => {
  const el = document.createElement('div');
  el.className = 'bar-row';
  el.innerHTML = '<span></span><div class="track"><i class="fill"></i></div><strong></strong>';
  el.firstElementChild.textContent = label;
  el.lastElementChild.textContent = value + '件';
  $('bars').append(el);
  return { el, fill:el.querySelector('.fill'), value };
});

const scenes = [
  ['hook',0,3], ['problem',3,6.5], ['intro',6.5,8.5], ['reply',8.5,15],
  ['review',15,19.5], ['insight',19.5,25], ['ending',25,30]
].map(([id, start, end]) => ({ el:$(id), start, end }));
const cameraEls = [...document.querySelectorAll('.camera')];
const featureCopies = [...document.querySelectorAll('.feature-copy')];
const marks = [...document.querySelectorAll('mark')];
const conflicts = [...document.querySelectorAll('.conflicts > div')];
const warning = document.querySelector('.warning');
const handoff = document.querySelector('.handoff');
const diff = document.querySelector('.diff');
const metric = document.querySelector('.metric');
const approve = $('approve');
const sent = $('sent');
const pointerAt = 11.72;
const clickAt = 12.85;
const countStart = 22;
const countEnd = 24;
const countSteps = 11;
const countTimes = Array.from({length:countSteps}, (_, i) => lerp(countStart, countEnd, (i + 1) / countSteps));

function render(seconds) {
  const t = clamp(Number(seconds) || 0, 0, duration);
  for (const { el, start, end } of scenes) {
    const opacity = (start === 0 ? 1 : eased(t, start, .45)) *
      (end === duration ? 1 : 1 - accelerate(phase(t, end - .10, .40)));
    el.style.visibility = opacity > 0 ? 'visible' : 'hidden';
    el.style.opacity = opacity;
  }
  noticeEls.forEach((el, i) => {
    const incoming = eased(t, noticeAt[i], .25);
    const outgoing = accelerate(phase(t, 2.70 + (i % 4) * .047, .51));
    const direction = i % 2 ? 1 : -1;
    pose(el, incoming * (1 - outgoing) * .86,
      `translate(${direction * outgoing * 310}px,${(1 - incoming) * 68 + ((i % 3) - 1) * outgoing * 170}px) rotate(${(i % 5 - 2) * 2 + direction * outgoing * 17}deg)`);
  });
  const hookExit = accelerate(phase(t, 1.38, .24));
  rise($('hook-first'), 1 + hookExit, 1 - hookExit);
  const nextIn = eased(t, 1.48, .27);
  rise($('hook-next'), nextIn, nextIn * (1 - phase(t, 2.83, .24)));

  for (const [id, at] of [['problem',3.03],['intro',6.53]]) {
    rise($(id).firstElementChild, eased(t, at, .49));
  }
  drawLogo(0, t, 6.56);
  rise($('intro').querySelector('p'), eased(t, 7.14, .29));

  [8.5,15,19.5].forEach((at, i) => {
    rise(featureCopies[i], eased(t, at + .05, .48));
    const arrived = eased(t, at + .11, .48);
    const zoom = phase(t, at + .4, [5.2,3.9,4.9][i]);
    const scale = vertical ? 1 : lerp(1, 1.06, zoom);
    pose(cameraEls[i], arrived, `translate(${vertical ? 0 : -8 * zoom}px,${(1 - arrived) * 60 - zoom * 8}px) scale(${scale})`);
  });

  const typed = Math.floor(phase(t, 9.06, 2.04) * letters.length);
  if (typed !== lastLetter) {
    letters.forEach((el, i) => { el.style.visibility = i < typed ? 'visible' : 'hidden'; });
    lastLetter = typed;
  }
  marks.forEach((el, i) => {
    const reveal = eased(t, 11.36 + i * .13, .26);
    el.style.setProperty('--reveal', reveal);
    const chip = el.closest('.source').querySelector('.chip');
    chip.style.transform = `scale(${1 + .15 * Math.sin(Math.PI * phase(t, 11.36 + i * .13, .27))})`;
    rise(el.closest('.source'), eased(t, 11.18 + i * .06, .24), .33 + .67 * reveal, 12);
  });
  const moved = phase(t, pointerAt, clickAt - pointerAt);
  const action = approve.parentElement;
  const endX = action.offsetLeft + action.offsetWidth * .93;
  const endY = action.offsetTop + action.offsetHeight * .53;
  const shrink = Math.sin(Math.PI * phase(t, clickAt - .08, .20));
  pose($('pointer'), eased(t, pointerAt, .23) * (1 - phase(t, clickAt + .25, .24)),
    `translate(${cubic(endX - 72, endX - 48, endX + 16, endX, moved)}px,${cubic(endY - 143, endY - 102, endY - 54, endY, moved)}px) scale(${1 - shrink * .16})`);
  const ripple = phase(t, clickAt, .29);
  pose($('ripple'), ripple > 0 ? (1 - ripple) * .9 : 0, `translate(-50%,-50%) scale(${lerp(.4, 4.1, ripple)})`);
  const approved = eased(t, clickAt + .15, .25);
  pose(approve, 1 - approved, `scale(${1 - shrink * .035})`);
  rise(sent, approved, approved, 7);

  rise(warning, eased(t, 15.49, .27));
  conflicts.forEach((el, i) => {
    rise(el, eased(t, 15.83 + .06 * i, .26));
    el.querySelector('em').style.setProperty('--reveal', eased(t, 16.34 + .07 * i, .27));
  });
  rise(handoff, eased(t, 17.07, .28));

  pose($('ranking'), 1 - accelerate(phase(t, 21.61, .33)));
  bars.forEach(({el, fill, value}, i) => {
    const at = 19.83 + i * .065;
    rise(el, eased(t, at, .29), eased(t, at, .29), 14);
    fill.style.transform = `scaleX(${eased(t, at + .08, .55) * value / 14})`;
  });
  rise($('proposal'), eased(t, 21.72, .37), eased(t, 21.72, .37), 22);
  diff.style.setProperty('--reveal', eased(t, 22.06, .27));
  rise(metric, eased(t, 21.82, .18));
  const count = lerp(4.2, 2.0, phase(t, countStart, countEnd - countStart)).toFixed(1);
  if ($('count').textContent !== count) $('count').textContent = count;

  const resultIn = eased(t, 25.03, .48);
  const resultOut = accelerate(phase(t, 27.11, .37));
  rise($('result'), resultIn + resultOut, resultIn * (1 - resultOut));
  rise(document.querySelector('.result-tail'), eased(t, 25.43, .40));
  rise($('cta'), eased(t, 27.27, .51));
  drawLogo(1, t, 27.34);
}
window.render = render;

let current = frame ? clamp(Number(params.get('t')) || 0, 0, duration) : 0;
let playing = false;
let muted = params.get('muted') === '1';
let startedAt = 0;
let animation = 0;
let capture = null;
let requestingCapture = false;
let audio;
let soundRun;

const cues = [
  ...noticeAt.map((t,i) => [t,'notice',i]),
  [clickAt,'click'], [clickAt + .11,'send'], [clickAt + .27,'approved'], [15.49,'warning'],
  ...countTimes.map(t => [t,'tick']), [27.49,'logo']
];
function unlockAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  if (!audio) {
    const context = new Audio();
    const master = context.createGain();
    const output = context.createMediaStreamDestination();
    master.gain.value = muted ? 0 : 1;
    master.connect(context.destination);
    master.connect(output);
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 2026;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    audio = { context, master, output, buffer };
  }
  return audio.context.resume().catch(() => {});
}
function stopSound() {
  if (!soundRun) return;
  soundRun.bus.disconnect();
  soundRun.sources.forEach(source => source.stop());
  soundRun = null;
}
function scheduleSound(offset, delay = .018) {
  stopSound();
  if (!audio || audio.context.state !== 'running' || offset >= duration) return;
  const { context, master, buffer } = audio;
  const origin = context.currentTime + delay - offset;
  const bus = context.createGain();
  const music = context.createGain();
  music.gain.value = .126;
  music.connect(bus);
  bus.connect(master);
  const sources = [];
  soundRun = { bus, sources };

  function voice({at, length, volume, from, to = from, wave = 'sine', filter, attack = .01, output = bus}) {
    const start = origin + at;
    const end = Math.min(start + length, origin + duration);
    if (start < context.currentTime || end - start < .012) return;
    const envelope = context.createGain();
    const noise = wave === 'noise';
    const source = noise ? context.createBufferSource() : context.createOscillator();
    if (noise) source.buffer = buffer;
    else {
      source.type = wave;
      source.frequency.setValueAtTime(from, start);
      if (from !== to) source.frequency.exponentialRampToValueAtTime(to, end);
    }
    if (filter) {
      const eq = context.createBiquadFilter();
      eq.type = 'bandpass';
      eq.frequency.value = filter;
      eq.Q.value = .85;
      source.connect(eq);
      eq.connect(envelope);
    } else source.connect(envelope);
    envelope.connect(output);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.linearRampToValueAtTime(volume, Math.min(start + attack, end - .005));
    envelope.gain.exponentialRampToValueAtTime(.0001, end);
    source.start(start);
    source.stop(end);
    sources.push(source);
  }

  const chords = [[130.81,196,261.63,329.63],[110,164.81,261.63,329.63],[87.31,174.61,220,261.63],[98,196,246.94,293.66]];
  for (let beat = 0; beat < 50; beat++) {
    const at = beat * .6;
    if (at >= 28.8) break;
    if (beat % 4 === 0 || (at >= offset && at - offset < .6)) {
      chords[Math.floor(beat / 4) % chords.length].forEach((from, i) => {
        voice({ at, from, wave:i === 0 ? 'sine' : 'triangle', length:2.56, attack:.40, volume:i === 0 ? .22 : .12, output:music });
      });
    }
    if (beat % 2 === 0) voice({at, from:93, to:42, length:.20, volume:.42, output:music});
    voice({at:at + .30, wave:'noise', filter:7600, length:.058, volume:.12, attack:.004, output:music});
  }

  const tone = (at, from, length, volume, wave = 'sine', to = from) => voice({at,from,to,length,volume,wave});
  const noise = (at, filter, length, volume) => voice({at,filter,length,volume,wave:'noise',attack:.004});
  for (const [at, type, index] of cues) {
    if (at < offset) continue;
    switch (type) {
      case 'notice': tone(at, [660,784,880,740][index % 4], .12, .044); break;
      case 'click': noise(at, 2900, .052, .044); break;
      case 'send': voice({at,wave:'noise',filter:1600,length:.23,attack:.045,volume:.088}); break;
      case 'approved': tone(at, 587.33, .22, .067); tone(at + .11, 783.99, .37, .078); break;
      case 'warning': tone(at, 261.63, .29, .074, 'sine', 196); break;
      case 'tick': tone(at, 620, .049, .035, 'triangle', 510); break;
      case 'logo':
        [392,523.25,659.25].forEach((n,i) => tone(at + i * .14,n,.62,.075));
        break;
    }
  }
  for (let i = 0; i <= 300; i++) {
    const t = offset + i / 10;
    if (t > duration) break;
    const dip = cues.reduce((strength, [at]) => Math.max(strength, clamp(1 - Math.abs(t - at - .03) / .17)), 0);
    const fade = 1 - phase(t, 28.55, 1.45);
    music.gain.linearRampToValueAtTime(.126 * (1 - .35 * dip) * fade, origin + t);
  }
}

function syncControls() {
  $('seek').value = current;
  $('time').value = current.toFixed(2).padStart(5, '0') + ' / 30';
  $('play').textContent = playing ? '一時停止' : '再生';
  $('mute').textContent = muted ? '音 OFF' : '音 ON';
  $('mute').setAttribute('aria-pressed', String(muted));
  poster.hidden = !embed || playing || frame || Boolean(capture);
  const ended = current >= duration;
  const label = ended ? 'リプレイ' : '再生 0:30';
  if ($('play-label').textContent !== label || !playCircle.firstChild) {
    $('play-label').textContent = label;
    playCircle.innerHTML = ended ? replayIcon : playIcon;
  }
}
function paint() {
  render(current);
  syncControls();
}
function halt() {
  cancelAnimationFrame(animation);
  playing = false;
  stopSound();
  syncControls();
}
function advance(now) {
  current = clamp((now - startedAt) / 1000, 0, duration);
  paint();
  if (current >= duration) {
    halt();
    if (capture?.recorder.state === 'recording') capture.recorder.stop();
  } else animation = requestAnimationFrame(advance);
}
function start({ reset = false, gesture = false } = {}) {
  cancelAnimationFrame(animation);
  if (reset || current >= duration) current = 0;
  startedAt = performance.now() - current * 1000;
  playing = true;
  paint();
  scheduleSound(current);
  if (gesture && (!audio || audio.context.state !== 'running')) {
    unlockAudio()?.then(() => { if (playing && !soundRun) scheduleSound(current); });
  }
  animation = requestAnimationFrame(advance);
}
function togglePlay() {
  if (capture || requestingCapture) return;
  const resumed = unlockAudio();
  if (playing) {
    current = clamp((performance.now() - startedAt) / 1000, 0, duration);
    halt();
    paint();
  } else start({gesture:true});
  resumed?.then(() => { if (playing && !soundRun) scheduleSound(current); });
}
function replay() {
  if (!capture && !requestingCapture) start({reset:true,gesture:true});
}
function toggleMute() {
  if (capture || requestingCapture) return;
  muted = !muted;
  const resumed = unlockAudio();
  if (audio) audio.master.gain.setTargetAtTime(muted ? 0 : 1, audio.context.currentTime, .015);
  resumed?.then(() => { if (playing && !soundRun) scheduleSound(current); });
  syncControls();
}
$('play').onclick = togglePlay;
overlay.onclick = togglePlay;
$('replay').onclick = replay;
$('mute').onclick = toggleMute;
$('seek').oninput = event => {
  if (capture || requestingCapture) return;
  current = Number(event.target.value);
  if (playing && current < duration) start();
  else if (current >= duration) halt();
  paint();
};
document.addEventListener('keydown', event => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey ||
    event.target.closest?.('textarea, select, [contenteditable], input:not([type=range])')) return;
  if (event.code === 'Space' && !event.target.closest?.('button, a')) {
    event.preventDefault();
    togglePlay();
  }
  if (event.code === 'KeyR' && !embed) replay();
  if (event.code === 'KeyM' && !embed) toggleMute();
});
document.addEventListener('pointerdown', event => {
  if (playing && !soundRun && !event.target.closest('#record')) {
    unlockAudio()?.then(() => { if (playing && !soundRun) scheduleSound(current); });
  }
});
paint();
if (!frame && !embed && params.get('autoplay') === '1') start();

const recordButton = $('record');
const status = $('status');
const supportedCapture = Boolean(navigator.mediaDevices?.getDisplayMedia && window.MediaRecorder);

function downloadVideo(chunks, type) {
  const extension = type.includes('mp4') ? 'mp4' : 'webm';
  const url = URL.createObjectURL(new Blob(chunks, {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `answerloop_${vertical ? 'vertical' : 'horizontal'}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function closeCapture(session, error) {
  if (capture !== session) return;
  const complete = !error && current >= duration && session.chunks.length > 0;
  halt();
  capture = null;
  session.display.getTracks().forEach(track => track.stop());
  session.audioTrack?.stop();
  document.body.classList.remove('recording');
  fit();
  syncControls();
  if (complete) downloadVideo(session.chunks, session.recorder.mimeType || session.chunks[0].type);
  status.textContent = complete ? '録画を書き出しました。' : '録画が中断されたため、ファイルは保存されませんでした。';
}

recordButton.disabled = !supportedCapture;
if (!supportedCapture) status.textContent = 'このブラウザまたは接続先ではタブ録画を利用できません。';
recordButton.onclick = async () => {
  if (!supportedCapture || capture || requestingCapture) return;
  requestingCapture = true;
  recordButton.disabled = true;
  status.textContent = '';
  let display;
  let audioTrack;
  try {
    const resumed = unlockAudio();
    if (playing) {
      current = clamp((performance.now() - startedAt) / 1000, 0, duration);
      halt();
      paint();
    }
    display = await navigator.mediaDevices.getDisplayMedia({video:true, audio:true, preferCurrentTab:true});
    await resumed;
    const videoTrack = display.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') throw new Error('Capture ended');
    display.getAudioTracks().forEach(track => track.stop());
    audioTrack = audio?.output.stream.getAudioTracks()[0]?.clone();
    const stream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack]);
    const types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    let recorder;
    for (const mimeType of types.filter(type => MediaRecorder.isTypeSupported(type)).concat('')) {
      try {
        recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
        break;
      } catch (error) {
        if (mimeType === '') throw error;
      }
    }
    const session = {recorder, display, audioTrack, chunks:[]};
    capture = session;
    recorder.ondataavailable = event => { if (event.data.size) session.chunks.push(event.data); };
    recorder.onstop = () => closeCapture(session);
    recorder.onerror = () => closeCapture(session, true);
    videoTrack.addEventListener('ended', () => {
      if (recorder.state === 'recording') recorder.stop();
      else closeCapture(session, true);
    }, {once:true});
    document.body.classList.add('recording');
    current = 0;
    fit();
    paint();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (capture !== session) return;
      try {
        recorder.start();
        start({reset:true});
      } catch {
        closeCapture(session, true);
      }
    }));
  } catch (error) {
    display?.getTracks().forEach(track => track.stop());
    audioTrack?.stop();
    status.textContent = error.name === 'NotAllowedError' ? '画面共有がキャンセルされました。' : '録画を開始できませんでした。';
  } finally {
    requestingCapture = false;
    recordButton.disabled = false;
  }
};
