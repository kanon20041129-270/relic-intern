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
  answer: ['参加した時点で課金対象。', '追加日から月末まで日割り。', '次回の請求に加算します。'],
  evidence: ['料金ページ', 'FAQ', '利用規約']
};
const starts = short ? [.25, 3, 6.1, 9.4, 12.3] : [.25, 4.9, 10.8, 15.9, 20.6, 27];
const timing = short
  ? {wipe:2.4, reply:2.9, answer:3.8, proof:6, chips:[6.43, 6.76, 7.10], approve:7.70, faq:9.2, diff:9.8, publish:11.83, end:12}
  : {wipe:4.5, reply:4.95, answer:5.9, proof:6.7, chips:[7.2, 7.55, 7.9], approve:9.15, review:10, phone:15.5, faq:20, diff:20.5, publish:24.55, end:26.5};
const rests = short ? [] : [[14.10, 14.60]];
const app = (label, body) => `<article class="app"><header class="chrome"><b>TaskNest</b><span>${label}</span></header><div class="content">${body}</div></article>`;
const question = (label, attrs = '') => `<div class="question" ${attrs}><strong>${billing.question}</strong><small>${label}</small></div>`;
const caption = (lines, mode = 'long') => `<h1 class="${mode}">${lines.map(line =>
  `<span class="line">${mode === 'blur' ? [...line].map(char => `<span class="glyph">${char}</span>`).join('') : line}</span>`).join('')}</h1><i class="underline"></i>`;
const scene = (name, copy, body) => `<section class="scene ${name}" hidden><div class="copy">${copy}</div><div class="camera">${body}</div></section>`;
const inbox = `<div class="mail-stack">
  ${question('受信', 'data-mail="0"')}${question('受信', 'data-mail="1"')}${question('受信', 'data-mail="2"')}
  <div class="question mail-count"><span>同じ料金質問</span><b><span class="count number">0</span> 件</b></div>
</div>`;
const logo = `<svg viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1"
  d="M79 34a33 33 0 1 0 2 29 M80 19v16H64 M39 39h22a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7H48l-11 8v-9a7 7 0 0 1-5-7v-9a7 7 0 0 1 7-7Z"/></svg>`;

$('identity').textContent = 'AnswerLoop';
$('scenes').innerHTML = [
  scene('hook', caption(['また、同じ料金の質問。'], 'hero') +
    (short ? '' : '<p class="thought">前の返信、どこだっけ。</p>'), app('受信箱', inbox)),
  scene('reply', caption(short ? ['送信する前に、', 'もう答えが出てる。'] :
    ['アンサーループなら、送信する前に、', '根拠つきで答えが出ます。']), app('ヘルプチャット', `
    ${question('未送信', 'data-input')}<div class="draft"><b class="badge">承認済みの回答</b>
    ${billing.answer.map(line => `<p class="answer-line">${line}</p>`).join('')}</div>
    <div class="chips">${billing.evidence.map((label, i) => `<span class="chip"><b>K${[1,3,2][i]}</b>${label}</span>`).join('')}</div>${short ? '' : '<div class="approval"><span class="approve-status"></span><span class="stamp"></span></div>'}`)),
  ...(short ? [scene('proof', caption(['根拠を見て、', '承認するだけ。'], 'blur'), app('担当者の確認履歴', `
    <div class="question"><strong>${billing.question}</strong><small>回答</small></div>
    <div class="draft"><b class="badge">顧客への表示前</b><p>追加日から月末まで日割り。</p></div>
    <div class="chips">${billing.evidence.map((label, i) => `<span class="chip"><b>K${[1,3,2][i]}</b>${label}</span>`).join('')}</div>
    <div class="approval"><span class="approve-status">承認を記録</span><span class="stamp">✓</span></div>`))] : []),
  ...(short ? [] : [
    scene('review', caption(['資料が食い違えば、', 'AIは答えず、人へ。']), app('受信箱', `
      <div class="question"><strong>請求書払いはできますか？</strong><small>受信</small></div>
      <div class="comparison"><div class="tile"><b>K4　料金ページ</b><p>対応済み</p></div>
      <div class="tile"><b>K5　社内メモ</b><p>提供時期は未定</p></div></div>
      <div class="handoff"><b class="badge warning">要確認 → 経理担当</b><p>要約　請求書払いの提供状況を確認</p></div>`)),
    scene('phone', caption(['電話でも、同じ根拠で、', 'その場で答えます。']), app('ブラウザ上の模擬通話', `
      <div class="question"><strong>${billing.question}</strong><small>通話</small></div>
      <div class="wave" aria-hidden="true">${'<i></i>'.repeat(31)}</div>
      <div class="draft"><b class="badge">承認済みの回答</b><p>日割り分を次回請求に加算。</p><small>K1 料金ページ · K3 FAQ · K2 利用規約</small></div>`))
  ]),
  scene('faq', caption(short ? ['よく来る質問は、', 'ページに追記。'] :
    ['よく来る質問は、ページに追記して、', '根本から減らす。'], short ? 'blur' : 'long'), app('料金ページ', `
    <div class="summary"><span>同じ料金質問 <small>架空データ</small></span><b><span class="count number">0</span> 件</b></div>
    <div class="diff"><b class="badge diff-status">追記案</b><strong>＋ ユーザーを追加したときの料金</strong>
    <p>参加時に課金。月末までの日割り分を次回請求に加算します。</p></div>`)),
  scene('end', caption(['デモは、', 'プロフィールから。'], 'hero') +
    '<p class="credits">声：VOICEVOX:No.7<br>デモ用の架空データ</p>',
    `<div class="wordmark">${logo}<b>AnswerLoop</b></div><div class="loop-inbox">${app('受信箱', question('受信'))}</div>`)
].join('');

const timeline = [[0,'hook'], [timing.reply,'reply'],
  ...(short ? [[timing.proof,'proof']] : [[timing.review,'review'], [timing.phone,'phone']]),
  [timing.faq,'faq'], [timing.end,'end']];
const scenes = Object.fromEntries(timeline.map(([at, name]) => {
  const el = document.querySelector('.scene.' + name);
  return [name, {
    at, el, camera:el.querySelector('.camera'), glyphs:el.querySelectorAll('.glyph'),
    underline:el.querySelector('.underline'), get:selector => el.querySelector(selector)
  }];
}));

const count = age => [0, 4, 9, 14][Math.min(3, Math.floor(Math.max(0, age) * 10 + 1e-8))];
const clip = (el, p) => { el.style.clipPath = `inset(0 ${100 * (1 - p)}% 0 0)`; };
const mismatch = 14.10;
function drawProof(active, t) {
  active.el.querySelectorAll('.chip').forEach((chip, i) => {
    const p = eased(t, timing.chips[i] - .2, .2);
    pose(chip, p, `translateX(${45 * (1 - p)}px)`);
  });
}
function drawApproval(active, t) {
  const approved = t >= timing.approve;
  active.get('.approve-status').textContent = approved ? '事前に承認した回答' : '事前承認の履歴';
  const stamp = active.get('.stamp');
  const press = phase(t, timing.approve - .10, .10);
  stamp.textContent = approved ? '✓' : '承認';
  stamp.classList.toggle('is-done', approved);
  stamp.style.transform = `scale(${approved ? 1 : 1 - .07 * press})`;
}

function renderFrame(seconds) {
  const t = clamp(Number(seconds) || 0, 0, duration);
  const name = timeline.findLast(([at]) => t >= at)[1];
  const active = scenes[name];
  for (const [key, scene] of Object.entries(scenes)) scene.el.hidden = key !== name;
  const age = t - active.at;
  active.glyphs.forEach((glyph, i) => {
    const p = eased(age, i * .033, .167);
    glyph.style.opacity = p;
    glyph.style.filter = `blur(${6 * (1 - p)}px)`;
  });
  active.underline.style.transform = `scaleX(${smooth(age, .13, .4)})`;

  // A single rising navy sheet crosses the cut while the question stays registered.
  const wipe = phase(t, timing.wipe, timing.reply - timing.wipe);
  const wipeEl = $('wipe');
  wipeEl.hidden = wipe === 0 || wipe === 1;
  wipeEl.style.transform = `translateY(${(1 - smooth(wipe, 0, 1)) * 112}%)`;

  switch (name) {
    case 'hook': {
      active.el.querySelectorAll('[data-mail]').forEach((card, i) => {
        const p = i === 0 ? 1 : eased(t, .18 + (i - 1) * .29, .467);
        const settle = smooth(t, short ? 1.84 : 3.47, .24);
        const depth = (i === 0 ? 0 : i - 2) * (1 - settle);
        pose(card, p, `translate(${depth * 12}px,${depth * -29 + (1 - p) * (i === 2 ? 80 : 30)}px)`);
      });
      const tally = short ? 1.36 : 1.64;
      pose(active.get('.mail-count'), eased(t, tally - .16, .16), `translateY(${100 * (1 - smooth(t, 1.9, .24))}px)`);
      active.get('.count').textContent = count(t - tally);
      if (!short) pose(active.get('.thought'), eased(t, 2.1, .18));
      break;
    }
    case 'reply': {
      const converting = t >= timing.reply + .15 && t < timing.reply + .40;
      active.get('[data-input]').classList.toggle('converting', converting);
      active.get('[data-input] small').textContent = converting ? '変換中' : '未送信';
      const draft = active.get('.draft');
      pose(draft, t < timing.answer ? 0 : 1);
      active.el.querySelectorAll('.answer-line').forEach((line, i) => clip(line, eased(t, timing.answer + i * .05, .233)));
      drawProof(active, t);
      if (!short) {
        const zoom = .15 * smooth(t, timing.proof, .5) + .035 * eased(t, timing.chips[0], .15);
        pose(active.camera, 1, `scale(${1 + zoom * (1 - smooth(t, 9.50, .5))})`);
        pose(active.get('.approval'), eased(t, 8.85, .16));
        drawApproval(active, t);
      }
      break;
    }
    case 'proof': {
      drawProof(active, t);
      drawApproval(active, t);
      const zoom = .15 * smooth(t, timing.proof, .5) + .035 * eased(t, timing.chips[0], .15);
      pose(active.camera, 1, `scale(${1 + zoom})`);
      break;
    }
    case 'review':
      active.el.querySelectorAll('.tile').forEach((tile, i) => {
        pose(tile, eased(age, .25 + i * .25, .22));
        tile.classList.toggle('conflict', t >= mismatch);
      });
      clip(active.get('.handoff'), eased(t, 14.60, .24));
      break;
    case 'phone': {
      const wave = active.get('.wave');
      const bars = wave.querySelectorAll('i');
      bars.forEach((bar, i) => {
        bar.style.height = `${8 + 57 * Math.sin(i * .76) ** 2 * (1 - .6 * i / bars.length)}px`;
      });
      clip(wave, smooth(age, .12, .70));
      clip(active.get('.draft'), eased(t, 17.3, .25));
      break;
    }
    case 'faq':
      active.get('.count').textContent = count(age);
      clip(active.get('.diff'), smooth(t, timing.diff, .45));
      active.get('.diff-status').textContent = t >= timing.publish ? '反映済み' : '追記案';
      if (short) pose(active.camera, 1, `scale(${1 + .185 * (1 - smooth(age, 0, .5))})`);
      break;
    case 'end': {
      const wordmark = active.get('.wordmark');
      const loop = smooth(t, duration - .5, .5);
      const entry = eased(age, 0, .32);
      pose(wordmark, entry * (1 - loop), `translateX(${24 * (1 - entry - loop)}px)`);
      pose(active.get('.loop-inbox'), loop);
      active.get('path').style.strokeDashoffset = 1 - smooth(age, 0, .72);
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
  const fonts = [
    '600 80px "Video Mincho", "Hiragino Mincho ProN", serif',
    '600 52px "Video Sans", "Hiragino Sans", sans-serif',
    '300 30px "Video Sans", "Hiragino Sans", sans-serif',
    '600 48px "Inter", "Video Sans", "Hiragino Sans", sans-serif'
  ];
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
