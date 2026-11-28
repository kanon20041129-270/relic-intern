"use strict";

const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const originals = [
  ["K1", "料金ページ「プランと料金」", "料金ページ", "Proプランは月額1,200円/ユーザー。月の途中でユーザーを追加した場合、追加日から月末までを日割りで次回請求に加算します。"],
  ["K2", "利用規約 第8条", "利用規約", "請求は毎月1日に確定し、追加ユーザー分は翌月請求に含めます。"],
  ["K3", "FAQ「ユーザーの追加方法」", "FAQ", "設定 → メンバー → 招待。招待したユーザーが参加した時点で課金対象になります。"],
  ["K4", "料金ページ「お支払い方法」", "料金ページ", "クレジットカード・請求書払いに対応。"],
  ["K5", "社内仕様メモ（2026-11）", "社内仕様メモ", "請求書払いはデザイン・実装中。提供開始は未定。"],
  ["K6", "FAQ「タスクの一括インポート」", "FAQ", "CSV（UTF-8）で最大5,000件まで一括取り込み可能。"]
].map(([id, title, type, quote]) => ({
  id, title, type, quote, date: "2026-11-28", conflict: id === "K4" || id === "K5"
}));

const sample = `送信者,件名,本文
株式会社ミナト 佐藤さん,追加料金はいつ発生しますか？,Proプランを利用しています。月の途中でメンバーを招待した場合、追加料金はいつ発生し、いつ請求されますか？
合同会社ノース 田中さん,請求書払いはできますか？,Proプランを検討しています。クレジットカードではなく請求書払いで契約できますか？
株式会社リーフ 鈴木さん,CSVで一括登録できますか？,既存のタスクをCSVから一括でインポートしたいです。取り込める件数も教えてください。
株式会社アオイ 伊藤さん,ユーザー追加の料金を教えてください,Proプランでユーザーを追加する場合の課金について教えてください。
株式会社ハーバー 高橋さん,日割り計算はどうなりますか？,月の途中でメンバーが参加した場合の日割り料金を確認したいです。
株式会社トーン 渡辺さん,法人契約の請求書払いについて,経理の都合により請求書払いにできるか確認したいです。
合同会社ソラ 山本さん,追加ユーザー分は翌月請求ですか？,今月追加したユーザーの料金はいつの請求に入りますか？
株式会社ナギ 中村さん,招待したユーザーの課金タイミング,招待を送った日と参加した日のどちらから料金が発生しますか？`;

const historical = [
  "Proプランで席を増やすといくらですか？", "月末に1名追加した場合の料金",
  "メンバーの途中追加は日割りですか？", "追加分が請求に反映される日",
  "招待が未承諾でも料金がかかりますか？", "追加した2名の利用料について",
  "ユーザーを増やした月の請求額", "月半ばに参加したメンバーの費用",
  "月末に招待したメンバーの次回請求"
];

const icons = {
  inbox: '<path d="M3 12l3-7h12l3 7v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 12h5l2 3h4l2-3h5"/>',
  review: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5m0 3h.01"/>',
  insights: '<path d="M4 19h16M7 15v-4m5 4V7m5 8V4"/>',
  knowledge: '<path d="M12 6c-2-2-5-2-8-1v13c3-1 6-1 8 1 2-2 5-2 8-1V5c-3-1-6-1-8 1v13"/>'
};

const navigation = [["inbox","受信箱"],["review","要確認"],["insights","インサイト"],["knowledge","ナレッジ"]];
const guide = ["回答案を承認", "要確認を確認", "追記候補を見る"];
const draftPricing = "お問い合わせありがとうございます。ユーザーを追加した場合、招待したユーザーが参加した時点で課金対象となり[K3]、追加日から月末までの日割り料金を次回のご請求に加算いたします[K1][K2]。";
const draftImport = "お問い合わせありがとうございます。タスクはCSV（UTF-8）で最大5,000件まで一括取り込み可能です[K6]。";
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const params = new URLSearchParams(location.search);
const intro = Number(params.get("step"));
const embedded = params.get("embed") === "1";
let tickets, knowledge, page, selected, step, completed, generation, ticketId;
let displayed = [86, 100, 7.6];
let metricFrame, toastTimer, audio;
const renderedRows = new WeakMap();
let sound = true;

function parseCSV(raw) {
  const input = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows = [];
  let row = [], cell = "", quoted = false, closed = false;
  function endCell() {
    row.push(cell);
    cell = "";
    closed = false;
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else cell += char;
    } else if (char === "," || char === "\n") {
      endCell();
      if (char === "\n") {
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
      }
    } else if (char === '"' && !cell && !closed) {
      quoted = true;
    } else {
      if (closed || char === '"') throw new Error("CSVの引用符を確認してください");
      cell += char;
    }
  }
  if (quoted) throw new Error("CSVの引用符が閉じていません");
  endCell();
  if (row.some((value) => value.trim())) rows.push(row);
  const header = rows.shift() || [];
  const columns = ["送信者", "件名", "本文"].map((name) => header.findIndex((col) => col.trim() === name));
  if (header.length !== 3 || columns.includes(-1) || !rows.length) {
    throw new Error("列名を「送信者、件名、本文」にし、問い合わせを1件以上入力してください");
  }
  return rows.map((fields, i) => {
    if (fields.length !== 3 || columns.some((col) => !fields[col].trim())) {
      throw new Error(`データ行 ${i + 1} の送信者・件名・本文を確認してください`);
    }
    return columns.map((col) => fields[col].trim());
  });
}

function classify(subject, body) {
  const text = subject + "\n" + body;
  if (/請求書[\sでの]*払/.test(text)) {
    const confirmed = knowledge.findLast((item) => item.resolvesInvoice);
    return confirmed
      ? { category:"お金回り", status:"draft", response:`${confirmed.quote}[${confirmed.id}]`, refs:[confirmed.id] }
      : { category:"お金回り", status:"review", refs:["K4","K5"], conflict:true };
  }
  if (/(追加|招待|参加|席を増|ユーザーを増)/.test(text) && /料金|課金|日割り|請求|費用|利用料/.test(text)) {
    return { category:"お金回り", status:"draft", response:draftPricing, refs:["K1","K3","K2"] };
  }
  if (/CSV/i.test(text) && /一括|インポート|取り込|取込|登録/.test(text)) {
    return { category:"プロダクト仕様", status:"draft", response:draftImport, refs:["K6"] };
  }
  const category = /不具合|エラー|動かない/.test(text) ? "不具合"
    : /ログイン|パスワード|アカウント/.test(text) ? "会員情報"
    : /料金|請求|領収書|課金/.test(text) ? "お金回り"
    : /仕様|設定|機能/.test(text) ? "プロダクト仕様" : "その他";
  const confirmed = knowledge.findLast((item) => item.matchSubject === subject.trim());
  if (confirmed) return { category, status:"draft", response:`${confirmed.quote}[${confirmed.id}]`, refs:[confirmed.id] };
  return { category, status:"review", refs:[] };
}

function loadRows(rows, animate = true) {
  const batch = rows.map(([sender, subject, body]) => ({
    sender, subject, body, id: ++ticketId, ...classify(subject, body),
    pending: animate, visible: !animate
  }));
  tickets.push(...batch);
  if (!selected) selected = batch[0].id;
  if (!animate) return;
  page = "inbox";
  render();
  const current = generation;
  const duration = reduced.matches ? 0 : 1000;
  batch.forEach((ticket, i) => {
    const delay = reduced.matches ? 0 : i * 60;
    setTimeout(() => {
      if (current !== generation) return;
      if (ticket.visible) return;
      ticket.visible = true;
      if (page === "inbox" || page === "review") renderList(ticket.id);
      renderNav();
    }, delay);
    setTimeout(() => {
      if (current !== generation) return;
      if (!ticket.pending) return;
      ticket.pending = false;
      if (page === "inbox" || page === "review") {
        renderList();
        if (selected === ticket.id) renderDetail();
      }
      renderNav();
    }, delay + duration);
  });
}

function renderNav() {
  const focused = document.activeElement?.dataset.page;
  $("#nav").innerHTML = navigation.map(([id, label]) => {
    const count = id === "inbox" ? tickets.filter((t) => t.visible).length
      : tickets.filter((t) => t.visible && !t.pending && t.status === "review").length;
    return `<button class="nav-button" data-page="${id}" ${page === id ? 'aria-current="page"' : ""}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id]}</svg>
      ${label}${id === "inbox" || id === "review" ? `<span class="count badge ${id === "review" ? "orange" : ""}">${count}</span>` : ""}</button>`;
  }).join("");
  if (focused) $(`[data-page="${focused}"]`)?.focus({preventScroll:true});
}

function renderGuide() {
  const current = document.activeElement?.dataset.step;
  $("#steps").innerHTML = guide.map((label, index) => {
    const number = index + 1;
    return `<button data-step="${number}" ${number === step ? 'aria-current="step"' : ""}>${completed.has(number) ? "✓" : number} ${label}</button>`;
  }).join("");
  if (current) $(`[data-step="${current}"]`)?.focus({preventScroll:true});
}

const badge = (label, style = "") => `<span class="badge ${style}">${label}</span>`;
const heading = (title, label = "", action = "") => `<div class="page-head"><div>${label ? `<p class="section-label">${label}</p>` : ""}<h1>${title}</h1></div>${action}</div>`;
const button = (action, label, primary = false) => `<button data-action="${action}"${primary ? ' class="primary"' : ""}>${label}</button>`;

function render() {
  renderNav();
  renderGuide();
  const main = $("#main");
  if (page === "insights") { renderInsights(); return; }
  if (page === "knowledge") { renderKnowledge(); return; }
  const review = page === "review";
  const title = review ? "要確認" : "受信箱";
  if (!tickets.length && !review) {
    main.innerHTML = heading(title, "根拠付きの回答案") + `<section class="card empty"><div>
      <h2>受信箱は空です</h2><p class="muted">サンプルCSVから問い合わせを取り込めます。</p>
      <div class="actions">${button("sample","問い合わせCSVを取り込む",true)}${button("file","CSVファイルを選択")}</div>
    </div></section>`;
    return;
  }
  main.innerHTML = heading(title, review ? "要確認は人へ" : "根拠付きの回答案", button("file","CSVファイルを選択")) + `
    <div class="columns"><section class="card" aria-label="問い合わせ一覧"><div class="card-title"><h3>問い合わせ一覧</h3><small id="list-count"></small></div><div class="list"></div></section>
    <section class="card" id="detail" aria-label="問い合わせ詳細"></section></div>`;
  renderList();
  renderDetail();
}

function renderList(entering) {
  const list = $(".list");
  if (!list) return;
  const focused = document.activeElement?.dataset.ticket;
  const visible = tickets.filter((ticket) => ticket.visible && (page === "inbox" || (!ticket.pending && ticket.status === "review")));
  $("#list-count").textContent = `${visible.length}件`;
  const existing = new Map(Array.from(list.children, (row) => [Number(row.dataset.ticket), row]));
  if (!visible.length) {
    list.innerHTML = '<div class="panel muted">該当する問い合わせはありません。</div>';
    return;
  }
  for (const child of Array.from(list.children)) {
    if (!visible.some((ticket) => ticket.id === Number(child.dataset.ticket))) child.remove();
  }
  visible.forEach((ticket, index) => {
    const state = ticket.pending ? badge("根拠を検索中","searching")
      : ticket.sending ? badge("送信中","blue")
      : ticket.status === "sent" ? badge("送信済み","green")
      : ticket.status === "review" ? badge("要確認","orange") : badge("回答案あり","blue");
    const row = existing.get(ticket.id) || document.createElement("button");
    const content = `
      <span class="ticket-top">${badge(escape(ticket.category))}<span class="sender">${escape(ticket.sender)}</span></span>
      <span class="ticket-title"><span class="subject">${escape(ticket.subject)}</span>${state}</span>
    `;
    if (!existing.has(ticket.id)) {
      row.className = entering === ticket.id ? "ticket enter" : "ticket";
      row.dataset.ticket = ticket.id;
    }
    if (renderedRows.get(row) !== content) {
      row.innerHTML = content;
      renderedRows.set(row, content);
    }
    if (selected === ticket.id) row.setAttribute("aria-current","true");
    else row.removeAttribute("aria-current");
    if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
  });
  if (focused) $(`[data-ticket="${focused}"]`)?.focus({preventScroll:true});
}

function renderDetail() {
  const detail = $("#detail");
  if (!detail) return;
  const ticket = tickets.find((item) => item.id === selected);
  if (!ticket) {
    detail.innerHTML = '<div class="panel muted">問い合わせを選択してください。</div>';
    return;
  }
  detail.innerHTML = `<div class="card-title"><div><small>${escape(ticket.sender)}</small><h2>${escape(ticket.subject)}</h2></div>${ticket.status === "sent" ? badge("送信済み","green") : ""}</div>
    <div class="detail"><div><h3>問い合わせ本文</h3><p class="message">${escape(ticket.body)}</p></div>
    ${ticket.pending ? '<div class="draft searching" role="status">根拠を検索中</div>' : ticket.status === "review" ? reviewContent(ticket) : draftContent(ticket)}</div>`;
}

function draftContent(ticket) {
  const parts = ticket.response.split(/(\[K\d+\])/g);
  const response = parts.map((part) => ticket.refs.includes(part.slice(1,-1)) && /^\[K\d+\]$/.test(part)
    ? `<button class="chip" data-cite="${part.slice(1,-1)}" aria-pressed="false" aria-controls="source-${part.slice(1,-1)}">${part}</button>`
    : escape(part)).join("");
  const sources = ticket.refs.map((id) => {
    const item = knowledge.find((record) => record.id === id);
    const quote = id === "K1" ? item.quote.slice(item.quote.indexOf("。") + 1)
      : id === "K3" ? item.quote.slice(item.quote.indexOf("。") + 1) : item.quote;
    return `<div class="source" id="source-${id}"><strong>${id} · ${escape(item.title)}</strong><span>${escape(quote)}</span></div>`;
  }).join("");
  const editor = `<label for="edit-text">回答案を編集</label><textarea id="edit-text">${escape(ticket.response)}</textarea><div class="actions">${button("save","編集を保存",true)}${button("cancel-edit","キャンセル")}</div>`;
  return `<div class="draft"><div class="draft-head"><h3>${ticket.status === "sent" ? "送信した回答" : "AI回答案"} ${badge("AI生成","blue")}</h3><small>信頼度 <strong>高</strong></small></div>
    ${ticket.editing ? editor : `<p class="message">${response}</p>`}</div>
    <div><div class="evidence-head"><h3>根拠</h3><small>${ticket.refs.length}件</small></div><div class="evidence">${sources}</div></div>
    ${ticket.sending ? '<div class="actions"><button class="primary enter" disabled>送信中…</button></div>'
      : ticket.status === "draft" && !ticket.editing ? `<div class="actions">${button("send","承認して送信",true)}${button("edit","編集")}${button("handoff","人に回す")}</div>` : ""}`;
}

function reviewContent(ticket) {
  const alert = ticket.conflict ? "AIは回答しません：資料間で記載が食い違っています"
    : ticket.manual ? "担当者による確認が必要です" : "AIは回答しません：回答を裏付ける資料が見つかりません";
  const comparison = ticket.conflict ? `<div class="comparison">
    <div><h3>K4 · 料金ページ「お支払い方法」</h3><p>クレジットカード・<mark>請求書払いに対応</mark>。</p></div>
    <div><h3>K5 · 社内仕様メモ（2026-11）</h3><p>請求書払いは<mark>デザイン・実装中。提供開始は未定。</mark></p></div></div>` : "";
  const checked = ticket.conflict ? "K4 料金ページ、K5 社内仕様メモ"
    : ticket.refs.length ? ticket.refs.join("、") : "該当資料なし";
  const editor = `<div class="draft"><label for="confirmed">担当者が確定した回答</label><textarea id="confirmed" placeholder="確認した回答を入力"></textarea><div class="actions">${button("confirm","ナレッジに追加",true)}${button("cancel-confirm","キャンセル")}</div></div>`;
  return `<p class="alert">${alert}</p>${comparison}
    <div class="handoff"><h3>担当者への引き継ぎメモ</h3><dl>
      <dt>質問の要約</dt><dd>${ticket.conflict ? "Proプランで請求書払いを利用できるか。" : escape(ticket.subject)}</dd>
      <dt>確認済みの資料</dt><dd>${checked}</dd><dt>確認すべき人</dt><dd>${ticket.conflict ? "経理 / プロダクト担当" : "プロダクト担当"}</dd>
    </dl></div>
    ${ticket.added ? '<p class="badge green">次回から自動で回答案を作れます</p>' : ""}
    ${ticket.confirming ? editor : `<div class="actions">${ticket.assigned ? badge(`${ticket.conflict ? "経理 / " : ""}プロダクト担当に割り当て済み`,"green") : button("assign","担当者に割り当て",true)}
    ${ticket.added ? button("knowledge","ナレッジを見る") : button("add","確定した回答をナレッジに追加")}</div>`}`;
}

function renderInsights() {
  const ranking = [["ユーザー追加時の料金",14],["請求書払い",9],["CSVインポート",6],["ログインできない",4],["領収書の発行",3]];
  const related = [...parseCSV(sample).filter((row) => classify(row[1],row[2]).response === draftPricing).map((row) => row[1]), ...historical];
  $("#main").innerHTML = heading("インサイト","FAQ改善ループ") + `<div class="columns insights">
    <section class="card panel enter"><h2>今月の頻出質問</h2><ol class="ranking">${ranking.map(([label,count],i) => `
    <li><div class="rank-label"><strong>${label}</strong><span>${count}件</span></div>
    <div class="track" aria-hidden="true"><div class="bar" style="width:${count / 14 * 100}%;animation-delay:${i * 45}ms"></div></div></li>`).join("")}</ol></section>
    <section class="card panel enter"><div><p class="section-label">追記候補</p><h2>料金ページに「ユーザーを追加したときの料金」節を追加</h2></div>
    <div><p class="section-label">差分プレビュー</p><div class="diff"><strong>＋ ユーザーを追加したときの料金</strong><p>招待したユーザーが参加した時点で課金対象になります。参加日から月末までの日割り料金を次回のご請求に加算します。</p></div></div>
    <details><summary>根拠の問い合わせ 14件を見る</summary><ol>${related.map((subject) => `<li>${escape(subject)}</li>`).join("")}</ol></details>
    <div class="effect"><h3>ページ改善後の効果測定</h3><small>ページ閲覧1,000回あたりの該当問い合わせ</small><div class="effect-values">4.2件 <span aria-hidden="true">→</span> <span class="badge green">目標</span> 2.0件</div></div>
    </section></div>`;
}

function renderKnowledge() {
  $("#main").innerHTML = heading("ナレッジ","FAQ改善ループ") + `<div class="knowledge">${knowledge.map((item) => `
    <article class="card"><div class="draft-head"><h3>${item.id} · ${escape(item.title)}</h3>${item.conflict ? badge("要確認","orange") : badge("確定","green")}</div>
    <small>出典の種類 ${escape(item.type)}　最終確認日 ${item.date}</small><p>${escape(item.quote)}</p></article>`).join("")}</div>`;
}

function changePage(next) {
  page = next;
  if (page === "inbox" || page === "review") {
    const eligible = (ticket) => ticket.visible && (page === "inbox" || (!ticket.pending && ticket.status === "review"));
    if (!tickets.some((ticket) => eligible(ticket) && ticket.id === selected)) {
      selected = tickets.find(eligible)?.id ?? null;
    }
  }
  if (page === "review") {
    step = 2;
    if (selected) completed.add(2);
  }
  if (page === "insights") {
    step = 3;
    completed.add(3);
  }
  render();
}

function goStep(next, keyboard = false) {
  step = next;
  if (!tickets.length) loadRows(parseCSV(sample), false);
  if (next !== 3) {
    for (const ticket of tickets) {
      ticket.visible = true;
      ticket.pending = false;
    }
  }
  if (next === 2 && keyboard && !completed.has(1) && !tickets.some((ticket) => ticket.sending)) {
    const first = tickets.find((ticket) => ticket.response === draftPricing && ticket.status === "draft" && !ticket.pending);
    if (first) approve(first);
  }
  if (next === 1) selected = tickets.find((ticket) => ticket.response === draftPricing && !ticket.pending)?.id ?? null;
  if (next === 2) selected = tickets.find((ticket) => ticket.conflict && ticket.status === "review" && !ticket.pending)?.id ?? null;
  changePage(["inbox","review","insights"][next - 1]);
}

function reset() {
  generation = (generation || 0) + 1;
  ticketId = 0;
  tickets = [];
  knowledge = originals.map((item) => ({...item}));
  selected = null;
  step = 0;
  page = "inbox";
  completed = new Set();
  clearTimeout(toastTimer);
  $("#toast").textContent = "";
  updateMetrics(false);
  render();
}

function updateMetrics(animate = true) {
  cancelAnimationFrame(metricFrame);
  const sent = tickets.filter((ticket) => ticket.status === "sent").length;
  const target = [Math.min(100,86 + sent), Math.max(72,100 - sent * 2), 7.6 + sent / 10];
  const from = displayed.slice();
  const start = performance.now();
  function draw(now) {
    const progress = !animate || reduced.matches ? 1 : Math.min(1,(now - start) / 275);
    displayed = target.map((value,i) => from[i] + (value - from[i]) * (1 - (1 - progress) ** 3));
    const seconds = Math.round(displayed[1]);
    $("#rate").textContent = Math.round(displayed[0]) + "%";
    $("#average").textContent = `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    $("#saved").textContent = displayed[2].toFixed(1) + "時間";
    if (progress < 1) metricFrame = requestAnimationFrame(draw);
  }
  draw(start);
}

function notify(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  toastTimer = setTimeout(() => { $("#toast").textContent = ""; }, 3800);
}

function play(kind = "click") {
  if (!sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ||= new Audio();
    if (audio.state === "suspended") audio.resume().catch(() => {});
    const notes = kind === "send" ? [520, 720] : [390];
    notes.forEach((frequency, i) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + i * .075;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(kind === "send" ? .04 : .022,start + .009);
      gain.gain.exponentialRampToValueAtTime(.0001,start + .085);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + .09);
    });
  } catch {
    // Audio is optional on browsers with playback restrictions.
  }
}

function approve(ticket) {
  if (ticket.sending || ticket.status !== "draft" || ticket.pending) return;
  ticket.sending = true;
  const current = generation;
  renderList();
  renderDetail();
  setTimeout(() => {
    if (current !== generation) return;
    ticket.sending = false;
    ticket.status = "sent";
    completed.add(1);
    play("send");
    renderList();
    if (selected === ticket.id) {
      renderDetail();
      $("#detail")?.classList.add("sent-flash");
      $("#detail")?.addEventListener("animationend", (event) => {
        event.currentTarget.classList.remove("sent-flash");
      }, {once:true});
    }
    renderGuide();
    updateMetrics();
    notify("送信しました｜対応時間 1分12秒");
  }, reduced.matches ? 0 : 260);
}

function highlight(chip) {
  const selectedChip = $('[data-cite][aria-pressed="true"]');
  const id = chip?.dataset.cite || selectedChip?.dataset.cite;
  document.querySelectorAll(".source").forEach((source) => {
    source.classList.toggle("active", source.id === `source-${id}`);
  });
}

function action(name) {
  if (name === "sample") {
    step = 1;
    loadRows(parseCSV(sample));
    return;
  }
  if (name === "file") { $("#csv").click(); return; }
  if (name === "knowledge") { changePage("knowledge"); return; }
  const ticket = tickets.find((item) => item.id === selected);
  if (!ticket) return;
  switch (name) {
    case "send": approve(ticket); return;
    case "edit": ticket.editing = true; break;
    case "cancel-edit": ticket.editing = false; break;
    case "save": {
      const text = $("#edit-text").value.trim();
      if (!text) { notify("回答案を入力してください"); return; }
      ticket.response = text;
      ticket.editing = false;
      break;
    }
    case "handoff":
      ticket.status = "review";
      ticket.manual = true;
      break;
    case "assign":
      ticket.assigned = true;
      notify("担当者に割り当てました");
      break;
    case "add": ticket.confirming = true; break;
    case "cancel-confirm": ticket.confirming = false; break;
    case "confirm": {
      const quote = $("#confirmed").value.trim();
      if (!quote) { notify("確定した回答を入力してください"); return; }
      knowledge.push({
        id:`K${knowledge.length + 1}`, title:ticket.subject, type:"担当者の確定回答",
        quote, date:"2026-11-28", conflict:false, resolvesInvoice:ticket.conflict, matchSubject:ticket.subject
      });
      ticket.confirming = false;
      ticket.added = true;
      notify("次回から自動で回答案を作れます");
      break;
    }
  }
  renderNav();
  renderList();
  renderDetail();
  if (name === "edit") $("#edit-text").focus();
  if (name === "add") $("#confirmed").focus();
}

document.addEventListener("click", (event) => {
  const control = event.target.closest("button,summary");
  if (!control) return;
  if (control.id === "sound") {
    sound = !sound;
    control.setAttribute("aria-pressed", String(sound));
    control.textContent = `操作音 ${sound ? "ON" : "OFF"}`;
    play();
    return;
  }
  play();
  const {page: nextPage, step: nextStep, ticket, cite, action: name} = control.dataset;
  if (nextPage) changePage(nextPage);
  if (nextStep) goStep(Number(nextStep));
  if (ticket) {
    selected = Number(ticket);
    if (tickets.find((item) => item.id === selected)?.conflict && page === "review") completed.add(2);
    renderList();
    renderDetail();
    renderGuide();
    if (!embedded && matchMedia("(max-width: 930px)").matches) {
      $("#detail").scrollIntoView({behavior:reduced.matches ? "auto" : "smooth",block:"start"});
    }
  }
  if (cite) {
    const next = control.getAttribute("aria-pressed") !== "true";
    document.querySelectorAll("[data-cite]").forEach((chip) => chip.setAttribute("aria-pressed", String(next && chip === control)));
    highlight();
  }
  if (name) action(name);
});

for (const [eventName, show] of [["pointerover",true],["pointerout",false],["focusin",true],["focusout",false]]) {
  document.addEventListener(eventName, (event) => {
    const chip = event.target.closest("[data-cite]");
    if (chip) highlight(show ? chip : null);
  });
}

$("#csv").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  event.target.value = "";
  const current = generation;
  if (!file) return;
  try {
    const rows = parseCSV(new TextDecoder("utf-8",{fatal:true}).decode(await file.arrayBuffer()));
    if (current !== generation) return;
    step = 1;
    loadRows(rows);
  } catch (error) {
    if (current === generation) notify(`CSVを取り込めませんでした｜${error.message}`);
  }
});

document.addEventListener("keydown",(event) => {
  if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey ||
      event.target.closest("textarea,input,[contenteditable]") || event.repeat) return;
  if (event.key === "ArrowRight" && step < 3) {
    event.preventDefault();
    play();
    goStep(step + 1, true);
  }
  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    play();
    reset();
  }
});

if (embedded) {
  const root = document.documentElement;
  root.classList.add("embedded");
  const fitCanvas = () => {
    const scale = Math.min(root.clientWidth / document.body.offsetWidth,
      root.clientHeight / document.body.offsetHeight);
    document.body.style.setProperty("--canvas-scale", scale);
  };
  window.addEventListener("resize", fitCanvas);
  fitCanvas();
}

reset();
if ([1,2,3].includes(intro)) goStep(intro);
