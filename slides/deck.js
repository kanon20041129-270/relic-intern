"use strict";

const slideElements = [...document.querySelectorAll(".slide")];
const scripts = [...document.getElementById("speaker-notes").content.children].map(note => note.textContent);
const mode = new URLSearchParams(location.search).get("view");
const channel = "answerloop-presenter";

function slideUrl(page, view) {
  const url = new URL(location.href);
  url.search = view ? "?view=" + view : "";
  url.hash = page;
  return url.href;
}

function navigationStep(event) {
  if (event.key === "ArrowLeft") return -1;
  if (event.key === "ArrowRight" || event.code === "Space") return 1;
  return 0;
}

function openPresenterView() {
  document.body.classList.add("presenter");
  document.title = "AnswerLoop｜発表者ビュー";
  document.body.innerHTML = `
    <main>
      <div class="presenter-bar">
        <output id="timer" aria-label="残り時間">4:00</output>
        <button type="button" data-step="-1">← 前へ</button>
        <button type="button" data-step="1">次へ →</button>
      </div>
      <div class="previews">
        <section><h2>現在のスライド</h2><iframe id="current" title="現在のスライド"></iframe></section>
        <section><h2>次のスライド</h2><iframe id="up-next" title="次のスライド"></iframe><div class="end-card" hidden>最後のスライドです</div></section>
      </div>
      <section><h2>スピーカーノート</h2><div class="presenter-notes"></div></section>
    </main>`;

  const timer = document.getElementById("timer");
  const started = performance.now();
  setInterval(() => {
    const seconds = Math.max(0, 240 - Math.floor((performance.now() - started) / 1000));
    timer.textContent = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }, 200);

  const current = document.getElementById("current");
  const next = document.getElementById("up-next");
  const end = document.querySelector(".end-card");
  const notes = document.querySelector(".presenter-notes");

  function render(page) {
    current.src = slideUrl(page, "preview");
    next.hidden = page === slideElements.length;
    end.hidden = !next.hidden;
    if (!next.hidden) next.src = slideUrl(page + 1, "preview");
    notes.textContent = scripts[page - 1];
  }

  function send(message) {
    window.opener?.postMessage({ channel, ...message }, "*");
  }

  addEventListener("message", event => {
    if (event.source !== window.opener || event.data?.channel !== channel) return;
    const page = event.data.page;
    if (Number.isInteger(page) && page >= 1 && page <= slideElements.length) render(page);
  });
  document.querySelectorAll("[data-step]").forEach(button => {
    button.addEventListener("click", () => send({ step: Number(button.dataset.step) }));
  });
  addEventListener("keydown", event => {
    const step = navigationStep(event);
    if (!step || (event.code === "Space" && event.target.closest("button"))) return;
    event.preventDefault();
    send({ step });
  });

  render(readHash());
  send({ ready: true });
}

function readHash() {
  const hash = location.hash.slice(1);
  const page = /^\d+$/.test(hash) ? Number(hash) : 1;
  return Math.min(slideElements.length, Math.max(1, page));
}

function runDeck() {
  const viewport = document.getElementById("viewport");
  const stage = document.getElementById("stage");
  const notes = document.getElementById("notes");
  const preview = mode === "preview";
  let page = 0;
  let presenter;
  const reloadOnReturn = new WeakSet();
  if (preview) document.body.classList.add("preview");

  new ResizeObserver(() => {
    stage.style.setProperty("--scale", Math.min(viewport.clientWidth / 1920, viewport.clientHeight / 1080));
  }).observe(viewport);

  function syncPresenter() {
    if (presenter && !presenter.closed) presenter.postMessage({ channel, page }, "*");
  }

  function pauseFrames(slide) {
    slide.querySelectorAll("iframe[src]").forEach(frame => {
      frame.contentWindow?.postMessage({ type: "pause", action: "pause" }, "*");
      // Unload videos after the fade so playback also stops if the child ignores the message.
      if (!frame.closest(".horizontal, .phone")) return;
      reloadOnReturn.add(frame);
      setTimeout(() => {
        if (!slide.classList.contains("active") && reloadOnReturn.has(frame)) frame.removeAttribute("src");
      }, 250);
    });
  }

  function render() {
    const requestedPage = readHash();
    if (requestedPage === page) return;
    if (page && !preview) pauseFrames(slideElements[page - 1]);
    slideElements.forEach((slide, index) => {
      const active = index === requestedPage - 1;
      slide.classList.toggle("leaving", index < requestedPage - 1);
      slide.classList.toggle("active", active);
      slide.inert = !active;
      slide.setAttribute("aria-hidden", String(!active));
      if (active && !preview) {
        slide.querySelectorAll("iframe[data-src]").forEach(frame => {
          if (reloadOnReturn.delete(frame) || !frame.hasAttribute("src")) {
            frame.src = frame.dataset.src;
          }
        });
      }
    });
    page = requestedPage;
    notes.textContent = scripts[page - 1];
    notes.scrollTop = 0;
    syncPresenter();
  }

  function go(step) {
    const next = Math.min(slideElements.length, Math.max(1, page + step));
    if (next === page) return;
    location.hash = next;
    render();
  }

  function toggleFullscreen() {
    const change = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    change?.catch(() => {});
  }

  function shortcuts(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const target = event.target;
    if (target.isContentEditable || target.closest?.("input, textarea, select, video")) return;
    if (event.code === "Space" && target.closest?.("button, a, [role=button]")) return;

    const step = navigationStep(event);
    if (step) {
      event.preventDefault();
      go(step);
      window.focus();
    } else if (event.key.toLowerCase() === "f") {
      toggleFullscreen();
    } else if (event.key.toLowerCase() === "n") {
      notes.hidden = !notes.hidden;
    } else if (event.key.toLowerCase() === "p") {
      if (presenter && !presenter.closed) {
        presenter.focus();
      } else {
        presenter = open(slideUrl(page, "presenter"), "answerloop-presenter", "popup,width=1200,height=850");
      }
    }
  }

  if (!preview) {
    addEventListener("keydown", shortcuts);
    viewport.addEventListener("click", event => {
      if (!event.target.closest("a, button")) go(1);
    });
    stage.addEventListener("load", event => {
      // Same-origin embeds can pass unhandled shortcuts through after their own handlers.
      if (event.target.tagName === "IFRAME") event.target.contentDocument?.defaultView.addEventListener("keydown", shortcuts);
    }, true);
    addEventListener("message", event => {
      if (event.source !== presenter || event.data?.channel !== channel) return;
      if (event.data.ready) syncPresenter();
      if (event.data.step === 1 || event.data.step === -1) go(event.data.step);
    });
  }
  addEventListener("hashchange", render);
  render();
}

if (mode === "presenter") openPresenterView();
else runDeck();
