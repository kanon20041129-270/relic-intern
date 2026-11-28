"use strict";

const channelLabels = {email:"メール", form:"フォーム", chat:"チャット", phone:"電話"};
const statusLabels = {all:"すべて", ai:"AI解決", draft:"承認待ち", review:"要確認"};
const chatSamples = ["追加料金はいつ？", "CSVで一括登録できる？", "請求書払いはできる？"];
const phoneSamples = ["ユーザーを追加したら、いつから料金がかかりますか？", "請求書払いはできますか？"];
const instantAnswers = [
  {
    aliases:[chatSamples[0], phoneSamples[0], "追加料金はいつ発生しますか", "ユーザー追加の料金はいつから"],
    lines:["招待されたユーザーが参加した日から課金されます。", "参加日から月末までの料金を日割りで計算します。", "日割り分は次回の請求に加算されます。"],
    refs:["K3","K1","K2"]
  },
  {
    aliases:[chatSamples[1], "CSVで一括登録できますか", "CSVでインポートできますか", "CSVの取り込み上限は"],
    lines:["タスクはCSVで一括登録できます。", "ファイルはUTF-8形式で用意してください。", "一度に最大5,000件まで取り込めます。"],
    refs:["K6"]
  }
];
const normalizeQuestion = (text) => text.normalize("NFKC").toLowerCase().replace(/[\s、。？！,.?!]/g, "");
const isInvoiceQuestion = (text) => /請求書(?:での|で|の)?払/.test(text.normalize("NFKC"));
const invoiceAliases = [...chatSamples.slice(2), phoneSamples[1], "請求書払いに対応していますか"].map(normalizeQuestion);
const minimumMatch = 0.9;

function buildAnswerIndex(records) {
  const approved = new Set(records.filter((item) => !item.conflict).map((item) => item.id));
  const answers = instantAnswers.filter((answer) => answer.refs.every((id) => approved.has(id)));
  for (const item of records) {
    if (item.conflict || !item.matchSubject) continue;
    answers.push({
      aliases:[item.matchSubject, ...(item.resolvesInvoice ? invoiceAliases : [])],
      lines:item.quote.split(/\n+|(?<=。)/u).map((line) => line.trim()).filter(Boolean),
      refs:[item.id], resolvesInvoice:item.resolvesInvoice
    });
  }
  return answers.reverse().map((answer) => ({...answer, keys:answer.aliases.map(normalizeQuestion)}));
}

function lookupAnswer(question, index) {
  const key = normalizeQuestion(question);
  if (key.length < 6) return {reason:"short", refs:[], score:0};
  const invoice = isInvoiceQuestion(key);
  const stem = (value) => value.replace(/(?:できますか|できる|ですか)$/, "");
  let best = {reason:"unmatched", refs:[], score:0};
  for (const answer of index) {
    if (invoice && !answer.resolvesInvoice) continue;
    // Only approved wording and narrowly scoped question-ending variants qualify.
    const score = answer.keys.includes(key) ? 1
      : answer.keys.some((candidate) => stem(candidate).length >= 6 && stem(candidate) === stem(key)) ? 0.92 : 0;
    if (score >= minimumMatch && score > best.score) best = {...answer, lines:answer.lines, score};
  }
  if (invoice && !best.lines && !index.some((answer) => answer.resolvesInvoice)) {
    return {reason:"conflict", refs:["K4","K5"], score:0};
  }
  return best;
}

let channel, channelRun, answerIndex, timings, chat, call, recognizer, chatTimer, interruptSpeech;
const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stopChannelWork() {
  channelRun = (channelRun || 0) + 1;
  clearTimeout(chatTimer);
  if (recognizer) {
    const previous = recognizer;
    recognizer = null;
    previous.abort();
  }
  interruptSpeech?.();
  if (chat) chat.composing = false;
}

function resetChannels() {
  stopChannelWork();
  channel = "chat";
  answerIndex = buildAnswerIndex(knowledge);
  timings = [];
  chat = {text:"", messages:[], composing:false};
  call = {turns:[], refs:[], mic:false, micStatus:""};
}

function sourceChips(refs) {
  return refs.map((id) => {
    const item = knowledge.find((entry) => entry.id === id);
    return `<details class="ref-chip"><summary>${id} · ${escape(item.type)}</summary>
      <div class="ref-quote"><strong>${escape(item.title)}</strong><p>${escape(item.quote)}</p></div></details>`;
  }).join("");
}

function renderChannels() {
  $("#main").innerHTML = heading("チャネル") + `
    <div class="segments channel-tabs" aria-label="チャネルの切り替え">
      <button data-channel="chat" aria-pressed="${channel === "chat"}">チャット（顧客側）</button>
      <button data-channel="phone" aria-pressed="${channel === "phone"}">電話（模擬通話）</button>
    </div>` + (channel === "chat" ? `
    <section class="card customer-site">
      <header class="customer-nav"><strong><span class="nest-mark">T</span> TaskNest</strong><span>ヘルプセンター / プランと料金</span></header>
      <div class="customer-layout">
        <div class="help-copy">
          <p class="section-label">TaskNest ヘルプセンター</p>
          <h2>プランと料金</h2>
          <p>チームのタスクを、ひとつの場所で。</p>
          <div class="pricing"><span class="badge blue">TaskNest Proプラン</span><div><strong>1,200円</strong> / ユーザー・月</div>
            <p>タスク管理、メンバー招待、CSVインポート</p></div>
          <div class="help-links"><h3>よくある質問</h3>
            <p>メンバーの招待と権限</p><p>タスクの一括インポート</p></div>
        </div>
        <section class="widget card" aria-label="TaskNest サポートチャット">
          <header class="widget-head"><div><h2>TaskNest サポート</h2><p>入力中に、AIが承認済みの回答を検索</p></div>
            <div class="timing" id="local-timing"></div></header>
          <div class="widget-body">
            <h3>送信前に、根拠つきの答えが出る</h3>
            <div class="sample-chips">${chatSamples.map((question, i) => `<button type="button" data-question="${i}">${question}</button>`).join("")}</div>
            <div id="chat-messages" aria-live="polite"></div>
            <div id="chat-answer" aria-live="polite"></div>
            <form id="chat-form"><input id="chat-input" aria-label="質問" placeholder="質問を入力してください" maxlength="500" value="${escape(chat.text)}">
              <button class="primary" type="submit">送信</button></form>
            <small>送信後のAI生成による回答は将来機能</small>
          </div>
        </section>
      </div>
    </section>` : `
    <section class="card call-stage">
      <div class="call-controls">
        <p class="section-label">ブラウザ上の模擬通話</p>
        <div class="handset">
          <div class="speaker"></div><div class="caller-icon">${icon("phone",32)}</div>
          <h2>TaskNest サポート</h2><p>090-0000-0000（架空番号）</p>
          <div class="call-caption" id="call-caption" aria-live="polite"></div>
        </div>
        <div class="actions">
          <button class="primary" data-call="0">サンプル通話を再生</button>
          <button data-call="1">請求書払いの通話を再生</button>
        </div>
        <label class="mic-toggle"><input type="checkbox" id="mic" ${call.mic ? "checked" : ""}> マイクで話す（実験・既定オフ）</label>
        <div id="mic-panel"></div>
      </div>
      <section class="call-log" aria-label="通話の文字起こし"><h2>通話の文字起こし</h2>
        <div id="call-transcript" aria-live="polite"></div>
        <div class="call-evidence"><h3>参照した根拠</h3><div id="call-refs"></div></div>
      </section>
    </section>`);
  if (channel === "chat") {
    bindChat();
    renderChatMessages();
    renderTiming();
    renderChatAnswer(lookupAnswer(chat.text, answerIndex), false);
  } else {
    $("#mic").addEventListener("change", toggleMic);
    renderCall();
  }
}

function chooseChannel(next) {
  stopChannelWork();
  channel = next;
  call.mic = false;
  call.micStatus = "";
  changePage("channels");
}

const timingRuns = 50;

function formatTiming(ms) {
  if (ms >= 1) return `${ms.toFixed(1)} ms`;
  return `${((Math.floor(ms * 10) + 1) / 10).toFixed(1)} ms未満`;
}

function renderTiming() {
  const sorted = [...timings].sort((a,b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  $("#local-timing").innerHTML = timings.length
    ? `ローカル検索（この端末で実測）<br><strong>${formatTiming(timings[timings.length - 1])}</strong>（同じ入力で${timingRuns}回の平均）<br>中央値 ${formatTiming(median)}（直近${timings.length}測定）`
    : "ローカル検索（この端末で実測）<br>入力時に計測";
}

function searchChat() {
  const start = performance.now();
  let result = lookupAnswer(chat.text, answerIndex);
  for (let run = 1; run < timingRuns; run++) {
    result = lookupAnswer(chat.text, answerIndex);
  }
  timings.push((performance.now() - start) / timingRuns);
  if (timings.length > 20) timings.shift();
  renderTiming();
  renderChatAnswer(result);
  return result;
}

function renderChatAnswer(result, audible = true) {
  const panel = $("#chat-answer");
  const key = result.lines ? result.refs.join() : "";
  panel.dataset.question = normalizeQuestion(chat.text);
  if ((panel.dataset.answer || "") === key) return;
  panel.dataset.answer = key;
  panel.innerHTML = result.lines ? `<div class="instant-answer"><h3>AIの回答 · 承認済みナレッジ</h3>
    <div class="answer-lines">${result.lines.map((line) => `<p>${escape(line)}</p>`).join("")}</div>
    <div class="refs">${sourceChips(result.refs)}</div></div>` : "";
  if (result.lines && audible) play("land");
  if (result.lines && step === 1) {
    completed.add(1);
    renderGuide();
  }
}

function renderChatMessages() {
  $("#chat-messages").innerHTML = chat.messages.map(({question, reply}) =>
    `<div class="chat-exchange"><p class="outgoing">${escape(question)}</p><p>${escape(reply)}</p></div>`).join("");
  $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
}

function bindChat() {
  const field = $("#chat-input");
  const update = () => {
    chat.text = field.value;
    clearTimeout(chatTimer);
    if (chat.composing) return;
    if ($("#chat-answer").dataset.question !== normalizeQuestion(field.value)) renderChatAnswer({});
    chatTimer = setTimeout(searchChat, 120);
  };
  field.addEventListener("compositionstart", () => {
    chat.composing = true;
    channelRun++;
    clearTimeout(chatTimer);
    renderChatAnswer({});
  });
  field.addEventListener("compositionend", () => {
    chat.composing = false;
    update();
  });
  field.addEventListener("input", (event) => {
    if (event.isComposing) return;
    channelRun++;
    update();
  });
  $("#chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (chat.composing || !field.value.trim()) return;
    channelRun++;
    clearTimeout(chatTimer);
    chat.text = field.value.trim();
    const result = searchChat();
    const ticket = recordInteraction("chat", chat.text, result);
    chat.messages.push({question:chat.text, reply:result.lines ? result.lines.join("\n") : "担当者に確認してご連絡します（デモ例）"});
    renderChatMessages();
    field.value = chat.text = "";
    renderChatAnswer({});
    if (ticket.status === "review") notify("要確認に引き継ぎました");
  });
}

async function typeQuestion(question) {
  const field = $("#chat-input");
  const run = ++channelRun;
  clearTimeout(chatTimer);
  field.value = chat.text = "";
  renderChatAnswer({});
  if (reduced.matches) {
    field.value = chat.text = question;
    searchChat();
    return;
  }
  for (const char of question) {
    await waitFor(50);
    if (run !== channelRun || !field.isConnected) return;
    field.value += char;
    chat.text = field.value;
    play("type");
  }
  chatTimer = setTimeout(searchChat, 120);
}

function recordInteraction(source, question, result) {
  const ticket = {
    id:++ticketId, channel:source, visible:true, pending:false,
    sender:source === "chat" ? "チャットのお客様" : "模擬通話のお客様",
    subject:question, body:question,
    category:isInvoiceQuestion(question) || result.refs.includes("K1") ? "お金回り" : result.refs.includes("K6") ? "プロダクト仕様" : "その他",
    status:result.lines ? "ai" : "review", conflict:result.reason === "conflict",
    refs:result.refs, response:result.lines?.join("\n")
  };
  tickets.unshift(ticket);
  renderNav();
  return ticket;
}

function renderCall() {
  const end = call.turns[call.turns.length - 1];
  $("#call-caption").textContent = end ? end.text : "サンプル通話を選択";
  $("#call-transcript").innerHTML = call.turns.length ? call.turns.map(({role,text}) =>
    `<div class="call-turn"><h3>${role}</h3><p>${escape(text)}</p></div>`).join("")
    : '<p class="muted">通話を再生すると、ここに会話が表示されます。</p>';
  $("#call-refs").innerHTML = call.refs.length ? `<div class="refs">${sourceChips(call.refs)}</div>` : '<p class="muted">通話で参照した資料が表示されます。</p>';
  $("#mic").checked = call.mic;
  $("#mic-panel").innerHTML = (call.mic || call.micStatus ? '<p class="muted">Chromeの音声認識を使います。音声はブラウザ提供元で処理される場合があります。料金はかかりません。</p>' : "") +
    (call.mic && !call.micStatus ? '<button data-listen="true">認識を開始</button>' : "") +
    (call.micStatus ? `<p role="status">${escape(call.micStatus)}</p>` : "");
}

function speakLocal(text) {
  const synth = window.speechSynthesis;
  const voice = synth?.getVoices().find((item) => item.localService === true && /^ja(?:[-_]|$)/i.test(item.lang));
  if (!voice || !window.SpeechSynthesisUtterance) return waitFor(reduced.matches ? 0 : 950);
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.voice = voice;
    const finish = () => {
      clearTimeout(timer);
      if (interruptSpeech === interrupt) interruptSpeech = null;
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    const interrupt = () => { finish(); synth.cancel(); };
    const timer = setTimeout(interrupt, 12000);
    interruptSpeech = interrupt;
    try { synth.speak(utterance); } catch { finish(); }
  });
}

async function runCall(question, run, speakQuestion = true) {
  call.turns = [{role:"お客様", text:question}];
  call.refs = [];
  renderCall();
  if (speakQuestion) await speakLocal(question);
  if (run !== channelRun) return;
  const result = lookupAnswer(question, answerIndex);
  const reply = result.lines?.join("\n") || "担当者から折り返します（デモ例）";
  call.turns.push({role:result.lines ? "AIサポート" : "担当者へ引き継ぎ", text:reply});
  call.refs = result.refs;
  recordInteraction("phone", question, result);
  renderCall();
  await speakLocal(reply);
  if (run !== channelRun) return;
  if (step === 2) { completed.add(2); renderGuide(); }
}

async function startSample(which, both = false) {
  stopChannelWork();
  call.mic = false;
  call.micStatus = "";
  const run = channelRun;
  await runCall(phoneSamples[which], run);
  if (both && run === channelRun) {
    await waitFor(reduced.matches ? 0 : 600);
    if (run === channelRun) await runCall(phoneSamples[1], run);
  }
}

function toggleMic(event) {
  stopChannelWork();
  call.mic = event.target.checked;
  call.micStatus = "";
  if (call.mic && !window.webkitSpeechRecognition) {
    call.mic = false;
    call.micStatus = "このブラウザは音声認識に対応していません。";
  }
  renderCall();
}

function listen() {
  if (!call.mic || recognizer) return;
  function fail(reason) {
    recognizer = null;
    call.mic = false;
    call.micStatus = reason;
    renderCall();
  }
  try {
    const active = new window.webkitSpeechRecognition();
    recognizer = active;
    call.micStatus = "聞き取り中…";
    active.lang = "ja-JP";
    active.onresult = (event) => {
      if (recognizer !== active) return;
      recognizer = null;
      call.mic = false;
      call.micStatus = "";
      runCall(event.results[0][0].transcript, ++channelRun, false);
    };
    active.onerror = (event) => {
      if (recognizer !== active) return;
      const reasons = {"not-allowed":"マイクの利用が許可されていません。", network:"音声認識サービスに接続できません。", "no-speech":"音声を聞き取れませんでした。", "audio-capture":"マイクを利用できません。"};
      fail(reasons[event.error] || "音声認識を続けられませんでした。");
    };
    active.onend = () => {
      if (recognizer === active) fail("認識できる音声がありませんでした。");
    };
    active.start();
    renderCall();
  } catch {
    fail("音声認識を開始できませんでした。");
  }
}
