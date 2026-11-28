'use strict';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const vertical = params.get('format') === 'vertical';
const embed = params.get('embed') === '1';
const frame = params.has('t');
const width = vertical ? 1080 : 1920;
const height = vertical ? 1920 : 1080;
const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const phase = (t, at, span) => clamp((t - at) / span);
const cubic = (a, b, c, d, t) => {
  const i = 1 - t;
  return i * i * i * a + 3 * i * i * t * b + 3 * i * t * t * c + t * t * t * d;
};
function bezier(p, x1, y1, x2, y2) {
  if (p <= 0 || p >= 1) return p;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 13; i++) {
    const mid = (low + high) / 2;
    if (cubic(0, x1, x2, 1, mid) < p) low = mid;
    else high = mid;
  }
  return cubic(0, y1, y2, 1, (low + high) / 2);
}
const eased = (t, at, span) => bezier(phase(t, at, span), .05, .7, .1, 1);
function pose(el, opacity, transform = '') {
  el.style.opacity = opacity;
  el.style.transform = transform;
}

const duration = params.get('cut') === '15' ? 15 : 30;
const short = duration === 15;
const exporting = params.get('export') === '1';
const stage = $('stage');
const viewport = $('viewport');
const poster = $('poster');
const overlay = $('overlay');
const playCircle = overlay.querySelector('.play-circle');
const playIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m10 6 17 10-17 10Z" fill="currentColor"/></svg>';
const replayIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 14a10 10 0 1 1 2 9M6 6v8h8" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
document.body.classList.toggle('vertical', vertical);
document.body.classList.toggle('embed', embed);
document.body.classList.toggle('frame', frame);
document.body.classList.toggle('export', exporting);
document.body.classList.toggle('safe', params.get('safe') === '1');

function switchLink(id, name, value, label) {
  const query = new URLSearchParams(params);
  query.set(name, value);
  $(id).href = '?' + query;
  $(id).textContent = label;
}
switchLink('switch', 'format', vertical ? 'horizontal' : 'vertical', vertical ? '横版' : '縦版');
switchLink('cut', 'cut', short ? '30' : '15', short ? '30秒版' : '15秒版');
$('seek').max = duration;

function fit() {
  const scale = Math.min(viewport.clientWidth / width, viewport.clientHeight / height);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
new ResizeObserver(fit).observe(viewport);
fit();

const smooth = (t, at, span) => bezier(phase(t, at, span), .2, 0, 0, 1);
const billing = {
  question: '追加料金はいつ発生しますか？',
  evidence: ['料金ページ', 'FAQ', '利用規約']
};
const starts = short ? [.25, 3, 6.1, 9.4, 12.3] : [.25, 4.9, 10.8, 15.9, 20.6, 27];
const timing = short
  ? {reply:2.9, answer:3.8, proof:6, chips:[6.43, 6.76, 7.10], approve:7.70, faq:9.2, diff:9.8, publish:11.83, end:12}
  : {reply:4.95, answer:5.9, chips:[7.2, 7.55, 7.9], approve:9.15, review:10, phone:15.5, faq:20, diff:20.5, publish:24.55, end:26.5};
const rests = short ? [] : [[14.10, 14.60]];
const caption = lines => `<h1>${lines.map(line => `<span class="line">${line}</span>`).join('')}</h1>`;
const scene = (name, color, copy, body) => `<section class="scene ${name}" data-color="${color}" hidden>
  <div class="copy">${copy}</div><div class="camera">${body}</div></section>`;
const card = (label, body) => `<article class="app"><header class="chrome">${label}</header>${body}</article>`;
const circle = `<svg class="doodle circle" viewBox="0 0 300 130" preserveAspectRatio="none" aria-hidden="true">
  <path pathLength="1" d="M237 19C176-3 52 8 21 46c-37 45 27 73 116 72 83-1 159-28 145-67-7-21-40-37-79-43"/></svg>`;
const arrow = `<svg class="doodle arrow" viewBox="0 0 126 75" aria-hidden="true">
  <path pathLength="1" d="M7 14c27 40 67 48 108 27M86 32l31 7-21 26"/></svg>`;
const logo = `<svg class="doodle logo" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1"
  d="M79 34a33 33 0 1 0 2 29 M80 19v16H64 M39 39h22a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7H48l-11 8v-9a7 7 0 0 1-5-7v-9a7 7 0 0 1 7-7Z"/></svg>`;
const inbox = card('TaskNest ／ 受信箱', `<div class="inbox-line"><strong>${billing.question}</strong>
  <span class="tally"><b>14</b> 件${circle}</span></div>`);
const evidence = `<div class="sources">${billing.evidence.map(label => `<span class="source">${label}</span>`).join('')}</div>`;
const approval = '<span class="stamp">✓ 承認済み</span>';

$('identity').textContent = 'AnswerLoop';
$('scenes').innerHTML = [
  scene('hook', 'cream', caption(['また、<mark>同じ</mark>', '料金の質問。']) +
    (short ? '' : '<p class="thought">前の返信、どこだっけ。</p>'), inbox),
  scene('reply', 'mint', caption(['送信する前に、', '<mark>答えが出てる。</mark>']),
    card('ヘルプチャット', `<p class="input">${billing.question}</p>
      <div class="answer"><strong>追加日から月末まで日割り。</strong><p>次回の請求に加算します。</p></div>
      ${short ? '' : evidence + approval}`)),
  ...(short ? [scene('proof', 'sky', caption(['根拠を見て、', '<mark>承認</mark>するだけ。']),
    card('回答の根拠', `${evidence}<div class="approval">${arrow}${approval}</div>`))] : [
    scene('review', 'sky', caption(['資料が食い違えば、', 'AIは答えず、<mark>人へ。</mark>']),
      card('請求書払いはできますか？', `<div class="comparison">
        <p>料金ページ<strong>対応済み</strong></p><span class="versus">≠</span>
        <p>社内メモ<strong>時期未定</strong></p></div>
        <div class="handoff">${arrow}<strong>経理担当へ引き継ぎ</strong></div>`)),
    scene('phone', 'cream', caption(['電話でも、', '<mark>その場で</mark>回答。']), card('模擬通話', `
      <div class="wave" aria-hidden="true">${'<i></i>'.repeat(15)}</div>
      <div class="voice-answer"><strong>日割り分を次回請求に加算。</strong></div>`))
  ]),
  scene('faq', 'mint', caption(['よく来る質問は、', 'ページに<mark>追記。</mark>']),
    card('TaskNest ／ 料金ページ', `<div class="faq-count">同じ料金質問 <span class="tally"><b>14</b> 件${circle}</span></div>
      <div class="diff"><span class="stamp diff-status"></span><strong>＋ ユーザー追加時の料金</strong>
      <p>月末までの日割り分を次回請求に加算します。</p></div>`)),
  scene('end', 'navy', caption(['デモは、', '<mark>プロフィール</mark>から。']) +
    '<p class="credits">声：VOICEVOX:No.7</p>', `<div class="wordmark"><span>${logo}<b>AnswerLoop</b></span></div>
      <div class="loop-inbox" hidden>${inbox}</div>`)
].join('');

const timeline = [[0,'hook'], [timing.reply,'reply'],
  ...(short ? [[timing.proof,'proof']] : [[timing.review,'review'], [timing.phone,'phone']]),
  [timing.faq,'faq'], [timing.end,'end']];
const scenes = Object.fromEntries(timeline.map(([at, name]) => {
  const el = document.querySelector('.scene.' + name);
  return [name, {at, el, camera:el.querySelector('.camera'), get:selector => el.querySelector(selector)}];
}));

function sticker(el, t, at) {
  const p = phase(t, at, .2);
  const scale = p < .65 ? .6 + .48 * eased(p, 0, .65) : 1.08 - .08 * smooth(p, .65, .35);
  pose(el, clamp(p * 6), `scale(${scale}) rotate(${-4 * (1 - p)}deg)`);
}
function slide(el, t, at, distance = 156) {
  const p = eased(t, at, .24);
  pose(el, clamp(p * 3), `translateX(${distance * (1 - p)}px)`);
}
function drawInk(el, t, at) {
  el.style.strokeDashoffset = 1 - smooth(t, at, .34);
}
function drawSources(active, t) {
  active.el.querySelectorAll('.source').forEach((el, i) => sticker(el, t, timing.chips[i]));
}

function renderFrame(seconds) {
  const t = clamp(Number(seconds) || 0, 0, duration);
  const name = timeline.findLast(([at]) => t >= at)[1];
  const active = scenes[name];
  for (const [key, scene] of Object.entries(scenes)) scene.el.hidden = key !== name;
  const age = t - active.at;
  stage.dataset.color = active.el.dataset.color;
  sticker(active.get('mark'), age, -.08);
  slide(active.camera, age, name === 'hook' ? -.24 : -.06);

  const wipe = smooth(t, timing.reply - .24, .24);
  const wipeEl = $('wipe');
  wipeEl.hidden = wipe === 0 || wipe === 1;
  wipeEl.style.transform = `translateX(${(1 - wipe) * 100}%)`;

  switch (name) {
    case 'hook': {
      const tally = short ? 1.36 : 1.64;
      sticker(active.get('.tally'), t, tally);
      drawInk(active.get('path'), t, tally + .11);
      if (!short) pose(active.get('.thought'), eased(t, 2.1, .18));
      break;
    }
    case 'reply': {
      active.get('.input').hidden = t >= timing.answer;
      active.get('.answer').hidden = t < timing.answer;
      slide(active.get('.answer'), t, timing.answer);
      if (!short) {
        active.get('.sources').hidden = t < timing.chips[0];
        drawSources(active, t);
        active.get('.stamp').hidden = t < timing.approve;
        sticker(active.get('.stamp'), t, timing.approve);
      }
      break;
    }
    case 'proof':
      drawSources(active, t);
      drawInk(active.get('path'), t, timing.approve - .16);
      sticker(active.get('.stamp'), t, timing.approve);
      break;
    case 'review': {
      const handoff = t >= 14.60;
      active.get('.comparison').hidden = handoff;
      active.get('.handoff').hidden = !handoff;
      sticker(active.get('.handoff strong'), t, 14.60);
      drawInk(active.get('path'), t, 14.60);
      break;
    }
    case 'phone': {
      const speaking = t >= 17.3;
      const wave = active.get('.wave');
      wave.hidden = speaking;
      wave.querySelectorAll('i').forEach((bar, i) => {
        bar.style.height = `${24 + 104 * Math.sin(i * .71 + age * 7) ** 2}px`;
      });
      active.get('.voice-answer').hidden = !speaking;
      slide(active.get('.voice-answer'), t, 17.3);
      break;
    }
    case 'faq':
      active.get('.faq-count').hidden = t >= timing.diff;
      active.get('.diff').hidden = t < timing.diff;
      sticker(active.get('.tally'), age, 0);
      drawInk(active.get('path'), age, .04);
      slide(active.get('.diff'), t, timing.diff);
      active.get('.diff-status').textContent = t >= timing.publish ? '反映済み' : '追記案';
      sticker(active.get('.diff-status'), t, t >= timing.publish ? timing.publish : timing.diff);
      break;
    case 'end': {
      const loop = t >= duration - .5;
      active.get('.wordmark').hidden = loop;
      active.get('.loop-inbox').hidden = !loop;
      sticker(active.get('.wordmark > span'), age, 0);
      drawInk(active.get('.logo path'), age, .04);
      slide(active.get('.loop-inbox'), t, duration - .5, -100);
      break;
    }
  }
}

const score = buildScore(duration, timing, rests);
let narration;
const ready = Promise.all([prepareFonts(), loadNarration(duration, starts)]).then(([, clips]) => {
  narration = clips;
  fit();
});

async function prepareFonts() {
  const fonts = ['800 108px "Video Sans", "Hiragino Sans", sans-serif',
    '600 44px "Video Sans", "Hiragino Sans", sans-serif'];
  await Promise.all(fonts.map(font => document.fonts.load(font)));
  await document.fonts.ready;
  for (const font of fonts) {
    if (!document.fonts.check(font)) throw new Error(`フォントを読み込めませんでした — ${font}`);
  }
}

const renders = new Map();
async function renderAudio(sampleRate = 48000) {
  await ready;
  if (!renders.has(sampleRate)) {
    const context = new OfflineAudioContext(2, Math.round(duration * sampleRate), sampleRate);
    synthesize(context, context.destination, score, narration, 0, duration, rests);
    renders.set(sampleRate, context.startRendering());
  }
  return renders.get(sampleRate);
}
window.AnswerLoopVideo = {
  duration, fps:30, width, height, ready, renderFrame, renderAudio,
  async audioWavBase64(sampleRate = 48000) { return wavBase64(await renderAudio(sampleRate)); }
};
window.render = renderFrame;

let current = frame ? clamp(Number(params.get('t')) || 0, 0, duration) : 0;
let playing = false;
let muted = params.get('muted') === '1';
let startedAt = 0;
let animation = 0;
let capture = null;
let requestingCapture = false;
let audio;
let soundRun;
let soundRequest = 0;

function unlockAudio() {
  try {
    if (!audio) {
      const context = new AudioContext();
      const master = context.createGain();
      const output = context.createMediaStreamDestination();
      master.gain.value = muted ? 0 : 1;
      master.connect(context.destination);
      master.connect(output);
      audio = {context, master, output};
    }
    return audio.context.resume().catch(() => {});
  } catch {
    return undefined;
  }
}

function stopSound() {
  soundRequest++;
  if (soundRun) {
    soundRun.disconnect();
    if (soundRun instanceof AudioBufferSourceNode) soundRun.stop();
    soundRun = null;
  }
}

function scheduleSound(offset) {
  stopSound();
  if (audio?.context.state !== 'running' || offset >= duration) return;
  const {context, master} = audio;
  if (offset === 0) {
    const output = context.createGain();
    output.connect(master);
    const startAt = context.currentTime + .035;
    synthesize(context, output, score, narration, startAt, duration, rests);
    startedAt = performance.now() + (startAt - context.currentTime) * 1000;
    soundRun = output;
    return;
  }
  // A seek must retain the in-flight filter, pad and compressor tails.
  const request = soundRequest;
  renderAudio(context.sampleRate).then(buffer => {
    if (request !== soundRequest || !playing) return;
    const position = (performance.now() - startedAt) / 1000;
    if (position >= duration) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(master);
    source.start(0, position);
    soundRun = source;
  }).catch(() => {});
}
function syncControls() {
  $('seek').value = current;
  $('time').value = current.toFixed(2).padStart(5, '0') + ' / ' + duration;
  $('play').textContent = playing ? '一時停止' : '再生';
  $('mute').textContent = muted ? '音 OFF' : '音 ON';
  $('mute').setAttribute('aria-pressed', String(muted));
  poster.hidden = !embed || exporting || playing || frame || Boolean(capture);
  const ended = current >= duration;
  const label = ended ? 'リプレイ' : `再生 0:${duration}`;
  if ($('play-label').textContent !== label || !playCircle.firstChild) {
    $('play-label').textContent = label;
    playCircle.innerHTML = ended ? replayIcon : playIcon;
  }
}
function paint() {
  renderFrame(current);
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
function start({ reset = false } = {}) {
  if (!narration) return;
  cancelAnimationFrame(animation);
  if (reset || current >= duration) current = 0;
  startedAt = performance.now() - current * 1000;
  playing = true;
  paint();
  scheduleSound(current);
  animation = requestAnimationFrame(advance);
}
function startFromGesture(reset = false) {
  const resumed = unlockAudio();
  if (!resumed || audio.context.state === 'running') start({reset});
  else resumed.then(() => { if (!playing && !capture && !requestingCapture) start({reset}); });
}
function togglePlay() {
  if (capture || requestingCapture) return;
  if (playing) {
    current = clamp((performance.now() - startedAt) / 1000, 0, duration);
    halt();
    paint();
  } else startFromGesture();
}
function replay() {
  if (!capture && !requestingCapture) startFromGesture(true);
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
  if (exporting || frame) return;

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

const recordButton = $('record');
const status = $('status');
const supportedCapture = Boolean(navigator.mediaDevices?.getDisplayMedia && window.MediaRecorder);

function downloadVideo(chunks, type) {
  const extension = type.includes('mp4') ? 'mp4' : 'webm';
  const url = URL.createObjectURL(new Blob(chunks, {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `answerloop_${duration}s_${vertical ? 'vertical' : 'horizontal'}.${extension}`;
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

const playbackButtons = [$('play'), $('replay'), overlay, $('seek')];
playbackButtons.forEach(button => { button.disabled = true; });
recordButton.disabled = true;
ready.then(() => {
  playbackButtons.forEach(button => { button.disabled = false; });
  recordButton.disabled = !supportedCapture;
}, error => {
  status.textContent = error.message;
  $('play-label').textContent = error.message;
  overlay.title = error.message;
});
if (!supportedCapture) status.textContent = 'このブラウザまたは接続先ではタブ録画を利用できません。';
recordButton.onclick = async () => {
  if (!narration || !supportedCapture || capture || requestingCapture) return;
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

paint();
if (!exporting && !frame && !embed && params.get('autoplay') === '1') {
  ready.then(() => start(), () => {});
}
