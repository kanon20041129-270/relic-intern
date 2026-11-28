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
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h4"/>',
  chat: '<path d="M20 11a8 8 0 0 1-8 8H4l1.5-4A8 8 0 1 1 20 11Z"/><path d="M8 11h8"/>',
  phone: '<path d="M7 4h3l1.5 4-2.3 2a13 13 0 0 0 4.8 4.8l2-2.3 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 5 6.2 2 2 0 0 1 7 4Z"/>',
  channels: '<circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 11 8-4m-8 6 8 4"/>',
  inbox: '<path d="M3 12l3-7h12l3 7v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 12h5l2 3h4l2-3h5"/>',
  review: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5m0 3h.01"/>',
  insights: '<path d="M4 19h16M7 15v-4m5 4V7m5 8V4"/>',
  knowledge: '<path d="M12 6c-2-2-5-2-8-1v13c3-1 6-1 8 1 2-2 5-2 8-1V5c-3-1-6-1-8 1v13"/>'
};

const icon = (name, size = 17, label = "") => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${label ? 'role="img" aria-label="' + label + '"' : 'aria-hidden="true"'}>${label ? '<title>' + label + '</title>' : ''}${icons[name]}</svg>`;
const navigation = [["inbox","受信箱"],["review","要確認"],["channels","チャネル"],["insights","インサイト"],["knowledge","ナレッジ"]];
const guide = ["チャットで即答", "電話（模擬）", "要確認を人へ", "追記候補を承認", "人の回答→ナレッジ自動更新"];
const invoiceReply = "請求書払いは現在準備中です。提供開始が決まり次第ご案内します。";
const invoiceApprover = "経理／プロダクト担当";
const invoiceArticleTitle = "請求書払いは利用できますか？";
const invoiceArticle = "現在、請求書払いはご利用いただけません。提供に向けて準備を進めており、開始時期が決まり次第、ヘルプセンターでお知らせします。";
const canSendInvoice = (ticket) => ticket?.conflict && !ticket.pending && !ticket.added && ticket.status === "review";
const draftPricing = "お問い合わせありがとうございます。ユーザーを追加した場合、招待したユーザーが参加した時点で課金対象となり[K3]、追加日から月末までの日割り料金を次回のご請求に加算いたします[K1][K2]。";
const draftImport = "お問い合わせありがとうございます。タスクはCSV（UTF-8）で最大5,000件まで一括取り込み可能です[K6]。";
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const params = new URLSearchParams(location.search);
const intro = Number(params.get("step"));
const embedded = params.get("embed") === "1";
let tickets, knowledge, page, selected, step, completed, generation, ticketId;
let inboxFilter, proposalApproved, knowledgeHistory;
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
  if (isInvoiceQuestion(text.replace(/\s/g, ""))) {
    const confirmed = knowledge.findLast((item) => item.resolvesInvoice && !item.indexPending);
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
  const confirmed = knowledge.findLast((item) => item.matchSubject && normalizeQuestion(item.matchSubject) === normalizeQuestion(subject));
  if (confirmed) return { category, status:"draft", response:`${confirmed.quote}[${confirmed.id}]`, refs:[confirmed.id] };
  return { category, status:"review", refs:[] };
}

function loadRows(rows, animate = true, fixture = false) {
  const batch = rows.map(([sender, subject, body], index) => ({
    sender, subject, body, id: ++ticketId, ...classify(subject, body),
    channel:fixture && index % 3 === 2 ? "form" : "email", sample:fixture, pending: animate, visible: !animate
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
      if (page === "insights") renderBreakdown();
      if (page === "inbox" || page === "review") renderList(ticket.id);
      renderNav();
    }, delay);
    setTimeout(() => {
      if (current !== generation) return;
      if (!ticket.pending) return;
      ticket.pending = false;
      if (page === "insights") renderBreakdown();
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
  if (page === "channels") { renderChannels(); return; }
  if (page === "insights") { renderInsights(); return; }
  if (page === "knowledge") { renderKnowledge(); return; }
  const review = page === "review";
  const title = review ? "要確認" : "受信箱";
  const filters = review ? "" : segments(statusLabels, inboxFilter, "filter");
  if (!tickets.length && !review) {
    main.innerHTML = heading(title, "根拠付きの回答案") + filters + `<section class="card empty"><div>
      <h2>受信箱は空です</h2><p class="muted">サンプルCSVから問い合わせを取り込めます。</p>
      <div class="actions">${button("sample","問い合わせCSVを取り込む",true)}${button("file","CSVファイルを選択")}</div>
    </div></section>`;
    return;
  }
  main.innerHTML = heading(title, review ? "要確認は人へ" : "根拠付きの回答案", button("file","CSVファイルを選択")) + filters + `
    <div class="columns"><section class="card" aria-label="問い合わせ一覧"><div class="card-title"><h3>問い合わせ一覧</h3><small id="list-count"></small></div><div class="list"></div></section>
    <section class="card" id="detail" aria-label="問い合わせ詳細"></section></div>`;
  renderList();
  renderDetail();
}

function segments(labels, current, type) {
  return `<div class="segments" aria-label="受信箱の絞り込み">${Object.entries(labels).map(([key,label]) =>
    `<button data-${type}="${key}" aria-pressed="${key === current}">${label}</button>`).join("")}</div>`;
}

function visibleTickets() {
  return tickets.filter((ticket) => ticket.visible && (page === "review" ? !ticket.pending &&
    (ticket.status === "review" || (ticket.id === selected && ticket.knowledgeUpdate))
    : inboxFilter === "all" || (!ticket.pending && ticket.status === inboxFilter)));
}

function renderList(entering) {
  const list = $(".list");
  if (!list) return;
  const focused = document.activeElement?.dataset.ticket;
  const visible = visibleTickets();
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
      : ticket.status === "ai" ? badge("AI解決","green")
      : ticket.status === "sent" ? badge("送信済み","green")
      : ticket.status === "review" ? badge("要確認","orange") : badge("回答案あり","blue");
    const row = existing.get(ticket.id) || document.createElement("button");
    const content = `
      <span class="ticket-top">${icon(ticket.channel,17,channelLabels[ticket.channel])}${badge(escape(ticket.category))}<span class="sender">${escape(ticket.sender)}</span></span>
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
  const ticket = visibleTickets().find((item) => item.id === selected);
  if (!ticket) {
    detail.innerHTML = '<div class="panel muted">問い合わせを選択してください。</div>';
    return;
  }
  detail.innerHTML = `<div class="card-title"><div><small>${escape(ticket.sender)}</small><h2>${escape(ticket.subject)}</h2></div>${ticket.knowledgeUpdate ? badge("送信済み（デモ）","green") : ticket.status === "sent" ? badge("送信済み","green") : ticket.status === "ai" ? badge("AI解決","green") : ""}</div>
    <div class="${ticket.knowledgeUpdate ? "update-layout" : ""}">
    <div class="detail"><div><h3>問い合わせ本文</h3><p class="message">${escape(ticket.body)}</p></div>
    ${ticket.knowledgeUpdate ? `<div class="draft"><h3>担当者が送信した回答</h3><p>${invoiceReply}</p></div>`
      : ticket.pending ? '<div class="draft searching" role="status">根拠を検索中</div>' : ticket.status === "review" ? reviewContent(ticket) : draftContent(ticket)}</div>
    ${ticket.knowledgeUpdate ? '<section class="update-panel" aria-label="ナレッジ自動更新"><h2>ナレッジ自動更新</h2><small>デモ用の架空データ</small><p class="visually-hidden" role="status"></p><ol class="update-timeline"></ol><div class="update-result"></div></section>' : ""}</div>`;
  if (ticket.knowledgeUpdate) renderKnowledgeUpdate(ticket.knowledgeUpdate);
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
  return `<div class="draft"><div class="draft-head"><h3>${ticket.status === "ai" ? "承認済みナレッジから回答" : (ticket.status === "sent" ? "送信した回答" : "AI回答案") + " " + badge("AI生成","blue")}</h3><small>信頼度 <strong>高</strong></small></div>
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
  const editor = `<div class="draft"><label for="confirmed">担当者が確定した回答</label><textarea id="confirmed" placeholder="確認した回答を入力"></textarea><div class="actions">${button("confirm","確定した回答をナレッジに追加",true)}${button("cancel-confirm","キャンセル")}</div></div>`;
  return `<p class="alert">${alert}</p>${comparison}
    <div class="handoff"><h3>${ticket.channel === "phone" ? "通話要約 · 担当者への引き継ぎ" : "担当者への引き継ぎメモ"}</h3><dl>
      <dt>質問の要約</dt><dd>${ticket.conflict ? "請求書払いを利用できるか。" : escape(ticket.subject)}</dd>
      <dt>確認済みの資料</dt><dd>${checked}</dd><dt>確認すべき人</dt><dd>${ticket.conflict ? "経理 / プロダクト担当" : "プロダクト担当"}</dd>
    </dl></div>
    ${ticket.added ? '<p class="badge green">次回からチャットと電話でも即答できます</p>' : ""}
    ${ticket.confirming ? editor : `<div class="actions">${ticket.assigned ? badge(`${ticket.conflict ? "経理 / " : ""}プロダクト担当に割り当て済み`,"green") : button("assign","担当者に割り当て",true)}
    ${ticket.added ? button("knowledge","ナレッジを見る") + button("try-answer","チャットで同じ質問を試す") : button("add","確定した回答をナレッジに追加")}</div>`}
    ${canSendInvoice(ticket) && !ticket.confirming ? `<div class="draft"><h3>担当者の回答（デモ）</h3><p>${invoiceReply}</p>
    <div class="actions">${button("send-invoice","回答して送信",true)}</div></div>` : ""}`;
}

function renderKnowledgeUpdate(update) {
  const stages = [
    ["問い合わせを取り込み、候補に追加", "新しい有人対応の問い合わせを検出しました。"],
    ["社内ルールで掲載を判定", `同種の問い合わせが${update.related}件。料金・契約に関わり、個別事情に依存しないため掲載対象です。`],
    ["資料を調査・整理", "料金ページは「対応」、社内仕様メモと過去の返信は「準備中」。利用規約には提供時期の記載がなく、担当者に確認します。"],
    ["担当者に確認を依頼", `確認先：${invoiceApprover} → 確定済み`],
    ["回答例と記事を作成・掲載", "承認済みナレッジに記録しました。"],
    ["チャット・電話の索引を更新しました", "次回は承認済みの回答を即答できます。"]
  ];
  const preview = `<div class="update-preview"><h3>回答例</h3><p>${invoiceReply}</p>
    <h3>ヘルプセンター掲載（デモ）</h3><strong>${invoiceArticleTitle}</strong><p>${invoiceArticle}</p></div>`;
  $(".update-timeline").innerHTML = stages.map(([label, description], index) => {
    const done = index < update.progress;
    const active = index === update.progress;
    return `<li class="${done ? "checked" : ""}" ${active ? 'aria-current="step"' : ""}><span class="update-mark" aria-hidden="true">${done ? "✓" : index + 1}</span>
      <div><strong>${index === 5 && !done ? "チャット・電話の索引を更新" : label}</strong>${done ? `<p>${description}</p>${index === 4 ? preview : ""}` : ""}</div></li>`;
  }).join("");
  $(".update-panel [role=status]").textContent = update.progress ? stages[update.progress - 1][0] : "ナレッジ自動更新を開始しました";
  if (update.progress === stages.length) {
    $(".update-result").innerHTML = `<div class="actions">${button("try-invoice","チャットで同じ質問を試す",true)}${button("knowledge","更新履歴を見る")}</div>`;
  }
}

async function sendInvoice(ticket, autoChat = false) {
  if (!canSendInvoice(ticket) || ticket.confirming) return;
  // The demo includes one earlier case about the same payment method.
  const related = 1 + tickets.filter((item) => item.visible && !item.pending && item.conflict).length;
  const update = ticket.knowledgeUpdate = {progress:0, related, autoChat};
  const current = generation;
  ticket.status = "sent";
  ticket.response = invoiceReply;
  play("send");
  renderNav();
  renderList();
  renderDetail();
  if (!embedded && matchMedia("(max-width: 930px)").matches) {
    $(".update-panel").scrollIntoView({behavior:reduced.matches ? "auto" : "smooth", block:"nearest"});
  }
  updateMetrics();
  for (let stage = 1; stage <= 6; stage++) {
    await waitFor(500);
    if (current !== generation) return;
    update.progress = stage;
    if (stage === 5) {
      const now = new Date();
      update.record = {
        id:`K${knowledge.length + 1}`,
        title:invoiceArticleTitle, type:"担当者の確定回答", quote:invoiceReply,
        date:now.toLocaleDateString("sv-SE"), conflict:false, resolvesInvoice:true,
        matchSubject:chatSamples[2], article:invoiceArticle, indexPending:true
      };
      knowledge.push(update.record);
      knowledgeHistory.unshift({time:now, subject:ticket.subject, approver:invoiceApprover});
      if (page === "knowledge") renderKnowledge();
      const helpArticle = $("#help-article");
      if (helpArticle) helpArticle.innerHTML = renderHelpArticle();
    }
    if (stage === 6) {
      update.record.indexPending = false;
      answerIndex = buildAnswerIndex(knowledge);
      completed.add(5);
      renderGuide();
      if (page === "channels" && channel === "chat" && chat.text && !chat.composing) searchChat();
    }
    play("land");
    if (selected === ticket.id && $(".update-timeline")) renderKnowledgeUpdate(update);
  }
  if (update.autoChat) {
    await waitFor(750);
    if (current === generation && step === 5 && page === "review" && selected === ticket.id) tryInvoice();
  }
}

function tryInvoice() {
  chooseChannel("chat");
  typeQuestion(chatSamples[2]);
}

const monthlyDemoCounts = {
  channel: {email:26, form:9, chat:18, phone:7},
  status: {ai:31, draft:6, review:3, sent:20}
};

function renderBreakdown() {
  const breakdown = (labels, field) => {
    const counts = {...monthlyDemoCounts[field]};
    for (const ticket of tickets) {
      if (ticket.visible && (field !== "status" || !ticket.pending)) counts[ticket[field]]++;
    }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return Object.entries(counts).map(([key,count]) => `
      <li><div class="rank-label"><span>${labels[key]}</span><strong>${count}件</strong></div>
      <div class="track" aria-hidden="true"><div class="bar" style="width:${count / total * 100}%"></div></div></li>`).join("");
  };
  $(".breakdown").innerHTML = `<div><h3>チャネル別件数</h3><ul>${breakdown(channelLabels,"channel")}</ul></div>
    <div><h3>対応状況</h3><ul>${breakdown({...statusLabels, sent:"送信済み"},"status")}</ul></div>`;
}

function renderInsights() {
  const ranking = [["ユーザー追加時の料金",14],["請求書払い",9],["CSVインポート",6],["ログインできない",4],["領収書の発行",3]];
  const related = [...parseCSV(sample).filter((row) => classify(row[1],row[2]).response === draftPricing).map((row) => row[1]), ...historical];
  $("#main").innerHTML = heading("インサイト","FAQ改善ループ") + `<div class="columns insights">
    <section class="card panel enter"><h2>今月の頻出質問</h2><ol class="ranking">${ranking.map(([label,count],i) => `
    <li><div class="rank-label"><strong>${label}</strong><span>${count}件</span></div>
    <div class="track" aria-hidden="true"><div class="bar" style="width:${count / 14 * 100}%;animation-delay:${i * 45}ms"></div></div></li>`).join("")}</ol>
    <div><small>今月の累計（架空データ）</small><div class="breakdown"></div></div></section>
    <section class="card panel enter"><div><p class="section-label">追記候補</p><h2>料金ページに<wbr>「ユーザーを<wbr>追加したときの<wbr>料金」節を追加</h2></div>
    <div><p class="section-label">差分プレビュー</p><div class="diff"><strong>＋ ユーザーを追加したときの料金</strong><p>招待したユーザーが参加した時点で課金対象になります。参加日から月末までの日割り料金を次回のご請求に加算します。</p></div></div>
    <details><summary>根拠の問い合わせ 14件を見る</summary><ol>${related.map((subject) => `<li>${escape(subject)}</li>`).join("")}</ol></details>
    <div class="actions">${proposalApproved ? badge("承認済み","green") : button("approve-proposal","追記案を承認",true)}</div>
    <div class="effect"><h3>ページ改善後の効果測定</h3><p class="muted">架空データによる計測例</p><small>ページ閲覧1,000回あたりの該当問い合わせ</small><div class="effect-values">4.2件 <span aria-hidden="true">→</span> <span class="badge green">目標</span> 2.0件</div></div>
    </section></div>`;
  renderBreakdown();
}

function renderKnowledge() {
  const history = knowledgeHistory.length ? `<ul>${knowledgeHistory.map(({time, subject, approver}) => `
    <li><time datetime="${time.toISOString()}">${time.toLocaleString("ja-JP")}</time>
    <strong>${escape(subject)}</strong><span>確定担当：${approver}</span></li>`).join("")}</ul>`
    : '<p class="muted">更新履歴はまだありません。</p>';
  $("#main").innerHTML = heading("ナレッジ","FAQ改善ループ") + `
    <section class="card panel update-history"><div><h2>更新履歴</h2><small>デモ用の架空データ</small></div>${history}</section>
    <div class="knowledge">${knowledge.map((item) => `
    <article class="card"><div class="draft-head"><h3>${item.id} · ${escape(item.title)}</h3>${item.conflict ? badge("要確認","orange") : badge("確定","green")}</div>
    <small>出典の種類 ${escape(item.type)}　最終確認日 ${item.date}</small><p>${escape(item.quote)}</p></article>`).join("")}</div>`;
}

function changePage(next) {
  if (page === "channels" && next !== "channels") {
    stopChannelWork();
    call.mic = false;
    call.micStatus = "";
  }
  page = next;
  if ((page === "inbox" || page === "review") && !visibleTickets().some((ticket) => ticket.id === selected)) {
    selected = visibleTickets()[0]?.id ?? null;
  }
  render();
}

function goStep(next) {
  step = next;
  if (!tickets.some((ticket) => ticket.sample)) loadRows(parseCSV(sample), false, true);
  if (next === 1) {
    chooseChannel("chat");
    typeQuestion(chatSamples[0]);
  } else if (next === 2) {
    chooseChannel("phone");
    startSample(0, true);
  } else if (next === 3) {
    const forwarded = tickets.find((ticket) => ticket.channel === "phone" && ticket.status === "review");
    const result = lookupAnswer(phoneSamples[1], answerIndex);
    selected = forwarded?.id ?? (!result.lines ? recordInteraction("phone", phoneSamples[1], result).id : null);
    changePage("review");
    if (selected) completed.add(3);
    renderGuide();
  } else if (next === 4) {
    changePage("insights");
  } else {
    const invoice = tickets.find((ticket) => ticket.knowledgeUpdate)
      ?? tickets.find((ticket) => ticket.id === selected && canSendInvoice(ticket))
      ?? tickets.find((ticket) => ticket.sample && canSendInvoice(ticket))
      ?? tickets.find(canSendInvoice);
    selected = invoice?.id ?? null;
    changePage("review");
  }
}

function runStepFive() {
  let ticket = tickets.find((item) => item.id === selected);
  if (page !== "review" || (!ticket?.knowledgeUpdate && !canSendInvoice(ticket))) {
    goStep(5);
    ticket = tickets.find((item) => item.id === selected);
  }
  if (ticket?.knowledgeUpdate?.progress === 6 || (!ticket?.knowledgeUpdate && !canSendInvoice(ticket) && lookupAnswer(chatSamples[2], answerIndex).lines)) {
    tryInvoice();
  } else if (ticket?.knowledgeUpdate) {
    ticket.knowledgeUpdate.autoChat = true;
  } else if (canSendInvoice(ticket)) {
    ticket.confirming = false;
    sendInvoice(ticket, true);
  }
}

function reset() {
  generation = (generation || 0) + 1;
  ticketId = 0;
  tickets = [];
  knowledge = originals.map((item) => ({...item}));
  knowledgeHistory = [];
  resetChannels();
  inboxFilter = "all";
  proposalApproved = false;
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
    const notes = kind === "send" ? [520, 720] : kind === "land" ? [590, 790] : kind === "type" ? [310] : [390];
    notes.forEach((frequency, i) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + i * .075;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(kind === "send" ? .04 : kind === "type" ? .008 : .022,start + .009);
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
    if (page === "insights") renderBreakdown();
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
    notify("送信しました");
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
    loadRows(parseCSV(sample), true, true);
    return;
  }
  if (name === "file") { $("#csv").click(); return; }
  if (name === "approve-proposal") {
    proposalApproved = true;
    completed.add(4);
    play("send");
    render();
    notify("追記案を承認しました");
    return;
  }
  if (name === "knowledge") { changePage("knowledge"); return; }
  if (name === "try-invoice") { tryInvoice(); return; }
  const ticket = tickets.find((item) => item.id === selected);
  if (!ticket) return;
  switch (name) {
    case "try-answer":
      chooseChannel("chat");
      typeQuestion(ticket.subject);
      return;
    case "send": approve(ticket); return;
    case "send-invoice": sendInvoice(ticket); return;
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
      answerIndex = buildAnswerIndex(knowledge);
      ticket.confirming = false;
      ticket.added = true;
      notify("確定した回答を追加しました");
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
  const {channel:nextChannel, filter, question, call:sampleCall, listen:micStart} = control.dataset;
  if (nextChannel && nextChannel !== channel) {
    chooseChannel(nextChannel);
    $(`[data-channel="${nextChannel}"]`).focus();
  }
  if (filter) {
    inboxFilter = filter;
    changePage("inbox");
    $(`[data-filter="${filter}"]`).focus();
  }
  if (question !== undefined) typeQuestion(chatSamples[Number(question)]);
  if (sampleCall !== undefined) startSample(Number(sampleCall));
  if (micStart) listen();
  if (ticket) {
    selected = Number(ticket);
    if (tickets.find((item) => item.id === selected && item.status === "review")?.conflict && page === "review") completed.add(3);
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
    if (page === "channels") stopChannelWork();
    loadRows(rows);
  } catch (error) {
    if (current === generation) notify(`CSVを取り込めませんでした｜${error.message}`);
  }
});

document.addEventListener("keydown",(event) => {
  if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey ||
      event.target.closest("textarea,input,[contenteditable]") || event.repeat) return;
  if (event.key === "ArrowRight" && (step < guide.length || (step === 5 && page !== "channels"))) {
    event.preventDefault();
    play();
    if (step < guide.length) goStep(step + 1);
    if (step === 5) runStepFive();
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
if (Number.isInteger(intro) && intro >= 1 && intro <= guide.length) goStep(intro);
