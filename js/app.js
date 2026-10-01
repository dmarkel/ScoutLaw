(function () {
  const LAWS = window.SCOUT_LAWS;
  const $ = (sel) => document.querySelector(sel);

  const stage = $("#stage");
  const scenes = { splash: $("#splash"), intro: $("#intro"), board: $("#board") };
  const host = $("#host");
  const slotsEl = $("#slots");
  const foundEl = $("#foundCount");
  const reveal = $("#reveal");
  const card = $("#lawCard");
  const finale = $("#finale");
  const help = $("#help");
  const strikeEl = $("#strike");
  const musicBtn = document.querySelector('[data-action="music"]');

  const opened = LAWS.map(() => false);
  let current = "splash";
  let busy = false;
  let finaleShown = false;
  let finaleDone = false;
  let timers = [];

  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // ---------- Build the board ----------
  const slots = LAWS.map((law, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot";
    b.setAttribute("aria-label", `Slot ${i + 1}`);
    b.innerHTML = `
      <span class="slot-inner">
        <span class="face face-front"><span class="num-oval">${i + 1}</span></span>
        <span class="face face-back">
          <span class="answer">${law.name}</span>
          <span class="answer-icon">${law.icon}</span>
        </span>
      </span>`;
    b.addEventListener("click", () => revealLaw(i));
    slotsEl.appendChild(b);
    return b;
  });

  const cheat = $("#cheat");
  LAWS.forEach((l) => {
    const li = document.createElement("li");
    li.textContent = l.name;
    cheat.appendChild(li);
  });

  const finaleWords = $("#finaleWords");
  LAWS.forEach((l) => {
    const li = document.createElement("li");
    li.textContent = l.name;
    finaleWords.appendChild(li);
  });

  // ---------- Marquee bulbs ----------
  function roundedRectPoints(w, h, r, step) {
    const pts = [];
    const straightW = w - 2 * r, straightH = h - 2 * r;
    const arc = (Math.PI / 2) * r;
    const total = 2 * (straightW + straightH) + 4 * arc;
    const n = Math.max(8, Math.round(total / step));
    for (let k = 0; k < n; k++) {
      let d = (k / n) * total;
      // top edge, then corner, right edge, corner, bottom, corner, left, corner
      const segs = [
        [straightW, (t) => [r + t, 0]],
        [arc, (t) => corner(w - r, r, -Math.PI / 2 + t / r)],
        [straightH, (t) => [w, r + t]],
        [arc, (t) => corner(w - r, h - r, t / r)],
        [straightW, (t) => [w - r - t, h]],
        [arc, (t) => corner(r, h - r, Math.PI / 2 + t / r)],
        [straightH, (t) => [0, h - r - t]],
        [arc, (t) => corner(r, r, Math.PI + t / r)]
      ];
      for (const [len, fn] of segs) {
        if (d <= len) { pts.push(fn(d)); break; }
        d -= len;
      }
    }
    function corner(cx, cy, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
    return pts;
  }

  function ellipsePoints(w, h, pad, step) {
    const rx = w / 2 - pad, ry = h / 2 - pad;
    const perim = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const n = Math.round(perim / step);
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      pts.push([w / 2 + rx * Math.cos(a), h / 2 + ry * Math.sin(a)]);
    }
    return pts;
  }

  function placeBulbs(container, pts, size) {
    container.innerHTML = "";
    container.style.setProperty("--bulb-size", size + "px");
    const frag = document.createDocumentFragment();
    pts.forEach(([x, y]) => {
      const b = document.createElement("span");
      b.className = "bulb";
      b.style.left = x + "px";
      b.style.top = y + "px";
      frag.appendChild(b);
    });
    container.appendChild(frag);
  }

  function layoutBulbs() {
    const vmin = Math.min(innerWidth, innerHeight) / 100;
    const frame = $(".frame-bulbs");
    const fw = frame.clientWidth, fh = frame.clientHeight;
    if (fw && fh) placeBulbs(frame, roundedRectPoints(fw, fh, innerHeight * 0.03, vmin * 3.4), vmin * 1.3);
    const badge = $(".badge-bulbs");
    const bw = badge.clientWidth, bh = badge.clientHeight;
    if (bw && bh) placeBulbs(badge, ellipsePoints(bw, bh, vmin * 2.2, vmin * 3.6), vmin * 1.6);
  }

  function flashBulbs(ms = 1600) {
    stage.classList.add("flash");
    setTimeout(() => stage.classList.remove("flash"), ms);
  }

  // ---------- Scenes ----------
  function show(name) {
    current = name;
    Object.entries(scenes).forEach(([k, el]) => el.classList.toggle("is-active", k === name));
  }

  // ---------- Host poses ----------
  const poses = {};
  host.querySelectorAll(".pose").forEach((img) => { poses[img.dataset.pose] = img; });
  let poseTimer;

  function setPose(name, motion) {
    Object.entries(poses).forEach(([k, img]) => img.classList.toggle("is-shown", k === name));
    const img = poses[name];
    img.classList.remove("pop");
    void img.offsetWidth;
    img.classList.add("pop");
    host.classList.remove("hop", "shake");
    if (motion) {
      void host.offsetWidth;
      host.classList.add(motion);
    }
  }

  // Show a pose; after `ms` (if given) go back to standing with the mic.
  function hostDo(name, ms, motion) {
    clearTimeout(poseTimer);
    setPose(name, motion);
    if (ms) poseTimer = setTimeout(() => setPose("idle"), ms);
  }

  function resetHost() {
    host.style.transition = "none";
    host.className = "host";
    hostDo("idle");
    void host.offsetWidth;
    host.style.transition = "";
  }

  // ---------- Opening ----------
  function startIntro() {
    clearTimers();
    closeAll();
    resetHost();
    scenes.intro.className = "scene";
    stage.classList.add("lights");
    stage.classList.remove("playing");
    show("intro");
    layoutBulbs();

    Sound.playTheme();
    at(80, () => scenes.intro.classList.add("step-1"));
    at(640, () => { scenes.intro.classList.add("step-2"); flashBulbs(900); });
    at(3300, () => host.classList.add("at-intro", "walking"));
    at(4900, () => { host.classList.remove("walking"); hostDo("wave"); });
    at(8200, () => Sound.ooh());
    at(10200, () => Sound.applause(0, 6, 0.55));
    at(13400, () => goToBoard(false));
  }

  function goToBoard(skipped) {
    if (current === "board") return;
    clearTimers();
    if (skipped) Sound.stopMusic(1.2);
    scenes.intro.classList.add("step-4");
    hostDo("idle");
    host.classList.remove("at-intro");
    host.classList.add("at-board", "walking");
    at(700, () => {
      show("board");
      stage.classList.remove("lights");
      stage.classList.add("playing");
      layoutBulbs();
    });
    at(1700, () => host.classList.remove("walking"));
    at(2000, () => hostDo("wave", 2200));
  }

  // ---------- Revealing a law ----------
  function updateCount() {
    const n = opened.filter(Boolean).length;
    foundEl.textContent = n;
    const score = foundEl.parentElement;
    score.classList.remove("bump");
    void score.offsetWidth;
    score.classList.add("bump");
  }

  function revealLaw(i) {
    if (current !== "board" || busy || help.classList.contains("is-open") || finale.classList.contains("is-open")) return;
    if (reveal.classList.contains("is-open")) {
      closeCard();
      setTimeout(() => revealLaw(i), 380);
      return;
    }
    const slot = slots[i];
    if (opened[i]) {
      Sound.ding();
      hostDo("present", 1400);
      openCard(i);
      return;
    }
    busy = true;
    opened[i] = true;
    Sound.flip();
    hostDo("present");
    slot.classList.add("is-open", "just-opened");
    slot.setAttribute("aria-label", `Slot ${i + 1}: ${LAWS[i].name}`);
    setTimeout(() => {
      Sound.ding();
      Sound.cheer();
      flashBulbs();
      updateCount();
      const r = slot.getBoundingClientRect();
      Confetti.burst(r.left + r.width / 2, r.top + r.height / 2, 90);
    }, 330);
    setTimeout(() => hostDo("cheer", 1800, "hop"), 650);
    setTimeout(() => slot.classList.remove("just-opened"), 1800);
    setTimeout(() => { openCard(i); busy = false; }, 1500);
  }

  function openCard(i) {
    const law = LAWS[i];
    $("#cardIcon").textContent = law.icon;
    $("#cardNum").textContent = `#${i + 1} of 12`;
    $("#cardName").textContent = law.name;
    $("#cardMeaning").textContent = law.meaning;
    $("#cardExample").textContent = law.example;

    reveal.classList.add("is-open");
    Sound.whoosh();

    // Grow the card out of its slot.
    const from = slots[i].getBoundingClientRect();
    card.classList.remove("animating");
    card.style.transform = "none";
    const to = card.getBoundingClientRect();
    card.style.transform =
      `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    card.classList.add("from-slot");
    void card.offsetWidth;
    card.classList.add("animating");
    card.classList.remove("from-slot");
    card.style.transform = "none";
  }

  function closeCard() {
    if (!reveal.classList.contains("is-open")) return;
    reveal.classList.remove("is-open");
    if (!finaleShown && opened.every(Boolean)) {
      finaleShown = true;
      setTimeout(startFinale, 700);
    }
  }

  // ---------- Wrong answer ----------
  let strikes = 0;
  let strikeTimer;
  function strike() {
    if (current !== "board") return;
    strikes = Math.min(3, strikes + 1);
    strikeEl.innerHTML = "";
    for (let k = 0; k < strikes; k++) {
      const x = document.createElement("div");
      x.className = "x-box";
      x.textContent = "X";
      strikeEl.appendChild(x);
    }
    Sound.buzzer();
    Sound.aww();
    hostDo("oops", 1700, "shake");
    clearTimeout(strikeTimer);
    strikeTimer = setTimeout(() => {
      strikeEl.querySelectorAll(".x-box").forEach((x) => x.classList.add("out"));
      setTimeout(() => { strikeEl.innerHTML = ""; }, 380);
      strikes = 0;
    }, 1700);
  }

  // ---------- Finale ----------
  function startFinale() {
    finaleDone = false;
    finale.classList.remove("show-banner");
    const items = [...finaleWords.children];
    items.forEach((li) => li.classList.remove("on", "lit"));
    finale.classList.add("is-open");
    host.classList.add("on-top");
    hostDo("thumbs");
    Sound.ooh();
    items.forEach((li, k) => {
      at(700 + k * 420, () => {
        li.classList.add("on", "lit");
        Sound.sparkle(0, 79 + (k % 6) * 2);
        at(380, () => li.classList.remove("lit"));
      });
    });
    const end = 700 + items.length * 420 + 400;
    at(end, () => {
      finale.classList.add("show-banner");
      items.forEach((li) => li.classList.add("lit"));
      Sound.playTheme();
      Sound.cheer();
      Sound.applause(0.4, 6, 1);
      flashBulbs(4000);
      hostDo("cheer", 0, "hop");
      at(2600, () => hostDo("thumbs"));
      Confetti.rain(7000);
    });
    at(end + 1500, () => { finaleDone = true; });
  }

  function closeFinale() {
    if (!finaleDone) return;
    finale.classList.remove("is-open");
    host.classList.remove("on-top");
    hostDo("idle");
    Sound.stopMusic(1.5);
  }

  // ---------- Misc controls ----------
  function closeAll() {
    host.classList.remove("on-top");
    reveal.classList.remove("is-open");
    finale.classList.remove("is-open");
    help.classList.remove("is-open");
  }

  function resetBoard() {
    opened.fill(false);
    finaleShown = false;
    slots.forEach((s, i) => {
      s.classList.remove("is-open", "just-opened");
      s.setAttribute("aria-label", `Slot ${i + 1}`);
    });
    foundEl.textContent = "0";
    closeAll();
    Sound.whoosh(0, false);
  }

  function toggleMusic() {
    if (Sound.isMusicPlaying()) Sound.stopMusic(0.8);
    else Sound.startLoop();
    musicBtn.setAttribute("aria-pressed", String(Sound.isMusicPlaying()));
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function toggleHelp() { help.classList.toggle("is-open"); }

  // ---------- Input ----------
  $("#startBtn").addEventListener("click", async () => {
    await Sound.init();
    document.documentElement.requestFullscreen?.().catch(() => {});
    startIntro();
  });

  scenes.intro.addEventListener("click", () => goToBoard(true));
  reveal.addEventListener("click", closeCard);
  finale.addEventListener("click", closeFinale);
  help.addEventListener("click", (e) => { if (e.target === help) toggleHelp(); });

  document.querySelectorAll(".dock button").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.currentTarget.blur();
      const a = b.dataset.action;
      if (a === "strike") strike();
      if (a === "music") toggleMusic();
      if (a === "fullscreen") toggleFullscreen();
      if (a === "help") toggleHelp();
    });
  });

  const KEY_TO_SLOT = { "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6, "8": 7, "9": 8, "0": 9, "-": 10, "=": 11 };

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;

    if (current === "splash") {
      if (k === "Enter" || k === " ") { e.preventDefault(); $("#startBtn").click(); }
      return;
    }
    if (k === "?" || k === "h" || k === "H") { toggleHelp(); return; }
    if (help.classList.contains("is-open")) {
      if (k === "Escape" || k === " " || k === "Enter") { e.preventDefault(); toggleHelp(); }
      return;
    }
    if (k === " " || k === "Enter" || k === "Escape") {
      e.preventDefault();
      if (reveal.classList.contains("is-open")) closeCard();
      else if (finale.classList.contains("is-open")) closeFinale();
      else if (current === "intro") goToBoard(true);
      return;
    }
    if (k in KEY_TO_SLOT) { revealLaw(KEY_TO_SLOT[k]); return; }
    switch (k) {
      case "x": case "X": strike(); break;
      case "m": case "M": toggleMusic(); break;
      case "f": case "F": toggleFullscreen(); break;
      case "a": case "A": Sound.applause(0, 3.5, 1); break;
      case "o": case "O": Sound.ooh(); break;
      case "i": case "I": startIntro(); break;
      case "R": if (e.shiftKey) resetBoard(); break;
    }
  });

  let resizeT;
  addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { layoutBulbs(); Confetti.resize(); }, 120);
  });
  document.fonts?.ready.then(layoutBulbs);
  layoutBulbs();

  // ---------- Confetti ----------
  const Confetti = (() => {
    const cv = $("#confetti");
    const cx = cv.getContext("2d");
    const COLORS = ["#ffc934", "#ffffff", "#5b93ff", "#1a4fd8", "#e61e2b", "#fff3c4"];
    let parts = [];
    let running = false;
    let rainUntil = 0;
    let dpr = 1;

    function resize() {
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = innerWidth * dpr;
      cv.height = innerHeight * dpr;
    }
    resize();

    function make(x, y, vx, vy) {
      return {
        x, y, vx, vy,
        w: 8 + Math.random() * 10,
        h: 5 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0
      };
    }

    function burst(x, y, n = 80) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const s = 6 + Math.random() * 12;
        parts.push(make(x, y, Math.cos(a) * s, Math.sin(a) * s - 6));
      }
      go();
    }

    function rain(ms) {
      rainUntil = performance.now() + ms;
      go();
    }

    function go() {
      if (running) return;
      running = true;
      requestAnimationFrame(tick);
    }

    function tick(now) {
      if (now < rainUntil) {
        for (let k = 0; k < 6; k++) {
          parts.push(make(Math.random() * innerWidth, -20, (Math.random() - 0.5) * 3, 2 + Math.random() * 4));
        }
      }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter((p) => p.y < innerHeight + 40 && p.life < 600);
      for (const p of parts) {
        p.life++;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.35;
        p.x += p.vx + Math.sin(p.life / 12) * 0.6;
        p.y += p.vy;
        p.rot += p.vr;
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        cx.scale(1, Math.cos(p.life / 6));
        cx.fillStyle = p.c;
        cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cx.restore();
      }
      if (parts.length || now < rainUntil) requestAnimationFrame(tick);
      else { running = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
    }

    return { burst, rain, resize };
  })();
})();
