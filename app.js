// Mohidoi v2 — kana charts, word list and practice. Plain JS, no dependencies, no network calls
// beyond this site's own files. Recordings: Fukujinzuke via Lingua Libre / Wikimedia Commons (CC BY 4.0).
(function () {
  "use strict";

  const { romaji, toHiragana, toKatakana } = window.Kana;
  const WORDS = Array.isArray(window.WORDS) ? window.WORDS : [];
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.append(kid);
    return n;
  };
  const PLAY_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.8v12.4L14 8z"/></svg>';

  // ---------- storage (optional: everything works without it) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = window.localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* private mode / storage blocked: ignore */
      }
    },
    remove(key) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        /* ignore */
      }
    },
  };

  // ---------- audio ----------
  // Native kana clips (audio/<hiragana>.wav). に uses the speaker's ニ recording (same sound).
  const KANA_WAV = new Set("あいうえおかがきくけこごさしじすせそぞただちつてでとどなにぬねのはばひびふへほまみむめもやゆよらりるれろわをん");
  const WORD_BY_TEXT = new Map();
  for (const w of WORDS) if (!WORD_BY_TEXT.has(w.w)) WORD_BY_TEXT.set(w.w, w);

  function clipFor(text) {
    const h = toHiragana(text);
    if (h.length === 1 && KANA_WAV.has(h)) return `audio/${h}.wav`;
    const w = WORD_BY_TEXT.get(text) || WORD_BY_TEXT.get(h) || WORD_BY_TEXT.get(toKatakana(h));
    return w ? `audio/words/${w.id}.ogg` : null;
  }

  const player = new Audio();
  player.preload = "auto";
  let synthVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = window.speechSynthesis.getVoices();
    synthVoice = vs.find((v) => v.lang && v.lang.toLowerCase().startsWith("ja")) || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
  }

  function speakSynth(text, rate) {
    if (!("speechSynthesis" in window)) return false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = rate;
    if (synthVoice) u.voice = synthVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return true;
  }
  // Play a clip (or the device voice). Returns "native", "synth" or "none".
  function play(src, fallbackText, slow) {
    try {
      player.pause();
    } catch (e) {
      /* ignore */
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (src) {
      player.src = src;
      player.preservesPitch = true;
      player.mozPreservesPitch = true;
      player.webkitPreservesPitch = true;
      player.playbackRate = slow ? 0.6 : 1;
      const p = player.play();
      if (p && p.catch) p.catch(() => {});
      return "native";
    }
    if (fallbackText && speakSynth(fallbackText, slow ? 0.5 : 0.9)) return "synth";
    return "none";
  }

  let npTimer = null;
  function nowPlaying(jp, latin, how) {
    const np = $("#nowplaying");
    np.textContent = "";
    np.append(el("span", { class: "jp", lang: "ja", text: jp }), latin || "");
    const note = { native: "", synth: " · device voice", none: " · no Japanese voice on this device" }[how] || "";
    if (note) np.append(note);
    np.hidden = false;
    clearTimeout(npTimer);
    npTimer = setTimeout(() => (np.hidden = true), 2600);
  }

  // ---------- kana data ----------
  const BASIC = [
    ["", "あいうえお"], ["K", "かきくけこ"], ["S", "さしすせそ"], ["T", "たちつてと"], ["N", "なにぬねの"],
    ["H", "はひふへほ"], ["M", "まみむめも"], ["Y", "や・ゆ・よ"], ["R", "らりるれろ"], ["W", "わ・・・を"], ["", "ん・・・・"],
  ];
  const DAKUTEN = [["G", "がぎぐげご"], ["Z", "ざじずぜぞ"], ["D", "だぢづでど"], ["B", "ばびぶべぼ"]];
  const HANDAKUTEN = [["P", "ぱぴぷぺぽ"]];
  const YOON = [
    ["KY", "き"], ["SH", "し"], ["CH", "ち"], ["NY", "に"], ["HY", "ひ"], ["MY", "み"], ["RY", "り"],
    ["GY", "ぎ"], ["J", "じ"], ["BY", "び"], ["PY", "ぴ"],
  ].map(([l, c]) => [l, [c + "ゃ", c + "ゅ", c + "ょ"]]);
  const SOKUON = { hira: ["がっこう", "いっぱい", "あっさり", "いっそ"], kata: ["ベッド", "サッカー", "インターネット", "バスケットボール"] };
  const LONG = { hira: ["ああ", "いい", "うう", "ええ", "おお", "えい", "おう"], kata: ["アー", "イー", "ウー", "エー", "オー", "コーヒー", "ケーキ"] };

  const tileRomaji = (k) => (toHiragana(k) === "を" ? "wo" : romaji(k));
  const conv = (s, script) => (script === "kata" ? toKatakana(s) : s);

  // ---------- easter egg state ----------
  const COW = "🐄";
  let muCount = 0;
  let cowMode = false;

  function triggerCow() {
    cowMode = true;
    $$(".brand-name").forEach((n) => (n.textContent = "Moohidoi"));
    const logo = $(".logo");
    logo.textContent = COW;
    logo.setAttribute("aria-label", "Say Moohidoi");
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) {
      icon.setAttribute("href", "images/moojito-icon.png");
      icon.setAttribute("type", "image/png");
    }
    document.title = "Moohidoi";
    $$('.tile[data-r="mu"]').forEach(makeCowTile);
  }
  function makeCowTile(t) {
    t.classList.add("cow");
    t.querySelector(".k").textContent = COW;
    t.querySelector(".r").textContent = "moo";
    t.setAttribute("aria-label", "moo");
  }

  // ---------- kana charts ----------
  let kanaScript = store.get("mohidoi.script", "hira") === "kata" ? "kata" : "hira";
  let lastTap = null;
  let slowNext = false;

  function kanaTile(kana, opts) {
    if (!kana) return el("span", { class: "tile empty", "aria-hidden": "true" });
    const src = clipFor(kana);
    const r = tileRomaji(kana);
    const t = el(
      "button",
      { type: "button", class: "tile" + (opts && opts.wide ? " wide" : ""), "data-k": kana, "data-r": r, "aria-label": `${kana} ${r}${src ? ", recorded" : ""}` },
      el("span", { class: "k", lang: "ja", text: kana }),
      el("span", { class: "r", text: r }),
      src ? el("span", { class: "dot", "aria-hidden": "true" }) : null
    );
    if (cowMode && r === "mu") makeCowTile(t);
    return t;
  }

  function chart(title, sub, cols, rows, cls) {
    const g = el("div", { class: "grid" + (cls ? " " + cls : "") });
    if (cols) {
      g.append(el("span", { class: "collabel" }));
      cols.forEach((c) => g.append(el("span", { class: "collabel", text: c })));
    }
    rows.forEach(([label, cells]) => {
      g.append(el("span", { class: "rowlabel", text: label }));
      Array.from(cells).forEach((c) => g.append(kanaTile(c === "・" ? null : conv(c, kanaScript))));
    });
    return el("div", { class: "chart" }, el("h3", { text: title }), sub ? el("p", { class: "sub", text: sub }) : null, g);
  }

  function renderKana() {
    const root = $("#kana-charts");
    root.textContent = "";
    const name = kanaScript === "kata" ? "Katakana" : "Hiragana";
    root.append(
      chart(`${name}: basic sounds`, null, ["A", "I", "U", "E", "O"], BASIC),
      chart("Dakuten", "Two small marks ( ゛) make the sound voiced: k→g, s→z, t→d, h→b.", ["A", "I", "U", "E", "O"], DAKUTEN),
      chart("Handakuten", "A small circle ( ゜) turns h into p.", ["A", "I", "U", "E", "O"], HANDAKUTEN),
      chart("Combinations (yōon)", "A small ゃ, ゅ or ょ after an i-sound blends the two into one beat.", ["YA", "YU", "YO"], YOON, "three")
    );
    const sok = SOKUON[kanaScript];
    const long = LONG[kanaScript];
    const sokNote = kanaScript === "kata" ? "A small ッ doubles the next consonant: a short pause before it." : "A small っ doubles the next consonant: a short pause before it.";
    const longNote = kanaScript === "kata" ? "In katakana a long vowel is written with a bar: ー." : "Two vowels in a row are held for twice as long. えい and おう usually sound like ee and oo.";
    root.append(
      el("div", { class: "chart" }, el("h3", { text: kanaScript === "kata" ? "Small ッ" : "Small っ" }), el("p", { class: "sub", text: sokNote }),
        el("div", { class: "grid four" }, sok.map((k) => kanaTile(k, { wide: true })))),
      el("div", { class: "chart" }, el("h3", { text: "Long vowels" }), el("p", { class: "sub", text: longNote }),
        el("div", { class: "grid four" }, long.map((k) => kanaTile(k, { wide: true }))))
    );
    $$("[data-script]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.script === kanaScript)));
  }

  function onKanaTap(t) {
    const kana = t.dataset.k;
    const r = t.dataset.r;
    slowNext = lastTap === t.dataset.k + kanaScript ? !slowNext : false;
    lastTap = t.dataset.k + kanaScript;
    $$(".tile.playing").forEach((x) => x.classList.remove("playing"));
    t.classList.add("playing");
    if (t.classList.contains("cow")) {
      speakSynth("moooooo", 0.9);
      nowPlaying(COW, " moooooo", "native");
    } else {
      const how = play(clipFor(kana), kana, slowNext);
      nowPlaying(kana, ` ${r}${slowNext ? " · slower" : ""}`, how);
    }
    if (r === "mu" && !cowMode) {
      muCount++;
      if (muCount >= 5) {
        muCount = 0;
        triggerCow();
      }
    }
  }

  // ---------- words ----------
  const CATS = [
    ["all", "All"],
    ["phrases", "Greetings & phrases"],
    ["nouns", "Nouns"],
    ["verbs", "Verbs"],
    ["adjectives", "Adjectives"],
    ["numbers", "Numbers & time"],
    ["places", "Countries & languages"],
    ["elements", "Chemical elements"],
    ["other", "Other"],
    ["kana", "Single kana"],
  ];
  const CAT_LABEL = Object.fromEntries(CATS);
  const hasKanji = (s) => /[㐀-鿿々]/.test(s);

  for (const w of WORDS) {
    w.ro = w.ro || (w.r ? romaji(w.r) : "");
    const parts = [w.w, w.k, w.r, w.r && toHiragana(w.r), toHiragana(w.w), w.ro, w.ro.replace(/'/g, ""), (w.m || []).join(" ; ")];
    if (w.alt) w.alt.forEach((a) => parts.push(a.k, a.g));
    if (w.parts) w.parts.forEach((p) => parts.push(p.w, p.g));
    w._hay = parts.filter(Boolean).join("\n").toLowerCase();
  }

  const PAGE = 60;
  let wordCat = "all";
  let wordQuery = "";
  let wordShown = PAGE;
  let wordLastId = null;
  let wordSlow = false;

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Latin queries match at the start of a word (so "cat" finds "cat", not "location");
  // kana/kanji queries match anywhere. Exact matches are listed first.
  function filteredWords() {
    const q = wordQuery.trim().toLowerCase();
    const inCat = WORDS.filter((w) => wordCat === "all" || w.cat === wordCat);
    if (!q) return inCat;
    const latin = /^[a-z0-9' ,;()-]+$/.test(q);
    const qh = toHiragana(q);
    const re = latin ? new RegExp("(^|[^a-z])" + escapeRe(q)) : null;
    const ranked = [];
    for (const w of inCat) {
      let hit = latin ? re.test(w._hay) : w._hay.includes(q) || w._hay.includes(qh);
      if (!hit) continue;
      let rank = 2;
      if (latin) {
        if (w.ro === q || (w.m || []).some((g) => g.toLowerCase() === q || g.toLowerCase() === "to " + q)) rank = 0;
        else if ((w.m || []).some((g) => g.toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").trim() === q)) rank = 0;
        else if (w.ro.startsWith(q) || (w.m && new RegExp("^(to )?" + escapeRe(q)).test(w.m[0].toLowerCase()))) rank = 1;
      } else if (w.w === q || toHiragana(w.w) === qh || (w.r && toHiragana(w.r) === qh)) rank = 0;
      else if (toHiragana(w.w).startsWith(qh) || (w.r && toHiragana(w.r).startsWith(qh))) rank = 1;
      ranked.push([rank, w]);
    }
    ranked.sort((a, b) => a[0] - b[0]);
    return ranked.map((x) => x[1]);
  }

  function wordRow(w) {
    const showRead = w.r && w.r !== w.w;
    const meta = [];
    meta.push(el("span", { class: "tag", text: CAT_LABEL[w.cat] || w.cat }));
    if (w.pos && w.pos.length) meta.push(el("span", { class: "tag", text: w.pos.join(", ") }));
    if (w.c) meta.push(el("span", { class: "tag", text: "common word" }));
    if (w.k) meta.push(el("span", { class: "tag" }, "usually written ", el("span", { lang: "ja", text: w.k })));
    let meaning;
    if (w.m) {
      meaning = el("p", { class: "w-mean", text: w.m.join("; ") });
    } else if (w.cat === "kana") {
      meaning = el("p", { class: "w-mean w-none", text: "The sound of this kana." });
    } else {
      meaning = el("p", { class: "w-mean w-none", text: "No dictionary entry for this exact word." });
    }
    const extra = [];
    if (w.alt) {
      extra.push(el("p", { class: "w-meta" }, "Same sound as: ", w.alt.map((a, i) => [i ? ", " : "", el("span", { lang: "ja", text: a.k }), ` ${a.g}`])));
    }
    if (w.parts) {
      extra.push(el("p", { class: "w-meta" }, "Parts: ", w.parts.map((p, i) => [i ? "; " : "", el("span", { lang: "ja", text: p.w }), ` ${p.g}`])));
    }
    if (w.rg) extra.push(el("p", { class: "w-meta", text: "Reading put together from the parts." }));
    const btn = el("button", { type: "button", class: "play", "aria-label": `Play ${w.w}`, "data-id": w.id });
    btn.innerHTML = PLAY_SVG;
    return el(
      "li",
      { class: "word", "data-id": w.id },
      btn,
      el("div", { class: "w-main" },
        el("span", { class: "w-word", lang: "ja", text: w.w }),
        showRead ? el("span", { class: "w-read", lang: "ja", text: w.r }) : null,
        w.ro ? el("span", { class: "w-ro", text: w.ro }) : null),
      meaning,
      el("p", { class: "w-meta" }, meta),
      extra
    );
  }

  function renderWords() {
    const list = filteredWords();
    const ol = $("#word-list");
    ol.textContent = "";
    if (!list.length) {
      ol.append(el("li", { class: "empty-note", text: "No words match. Try kana (ねこ), romaji (neko) or English (cat)." }));
    } else {
      const frag = document.createDocumentFragment();
      list.slice(0, wordShown).forEach((w) => frag.append(wordRow(w)));
      ol.append(frag);
    }
    $("#word-more").hidden = list.length <= wordShown;
    $("#word-count").textContent = `${list.length} of ${WORDS.length} words`;
    $$("#word-cats button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === wordCat)));
  }

  function setupWords() {
    const counts = {};
    WORDS.forEach((w) => (counts[w.cat] = (counts[w.cat] || 0) + 1));
    const box = $("#word-cats");
    CATS.forEach(([key, label]) => {
      const n = key === "all" ? WORDS.length : counts[key] || 0;
      if (!n) return;
      box.append(el("button", { type: "button", "data-cat": key, "aria-pressed": "false" }, label, el("span", { class: "n", text: String(n) })));
    });
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-cat]");
      if (!b) return;
      wordCat = b.dataset.cat;
      wordShown = PAGE;
      renderWords();
    });
    let t = null;
    $("#word-search").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        wordQuery = e.target.value;
        wordShown = PAGE;
        renderWords();
      }, 120);
    });
    $("#word-more").addEventListener("click", () => {
      wordShown += PAGE * 2;
      renderWords();
    });
    $("#word-list").addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const li = e.target.closest("li.word");
      if (!li) return;
      const w = WORDS.find((x) => x.id === li.dataset.id);
      if (!w) return;
      wordSlow = wordLastId === w.id ? !wordSlow : false;
      wordLastId = w.id;
      $$(".play.playing").forEach((x) => x.classList.remove("playing"));
      const b = li.querySelector(".play");
      b.classList.add("playing");
      const how = play(`audio/words/${w.id}.ogg`, w.w, wordSlow);
      nowPlaying(w.w, ` ${w.ro || ""}${wordSlow ? " · slower" : ""}`, how);
    });
    player.addEventListener("ended", () => $$(".play.playing, .tile.playing").forEach((x) => x.classList.remove("playing")));
    renderWords();
  }

  // ---------- practice ----------
  const PROGRESS_KEY = "mohidoi.v2.progress";
  const progress = store.get(PROGRESS_KEY, null) || { items: {}, log: [] };
  if (!progress.items) progress.items = {};
  if (!Array.isArray(progress.log)) progress.log = [];
  const saveProgress = () => store.set(PROGRESS_KEY, progress);

  const MODES = [
    { id: "kana-listen", kind: "kana", ic: "♪", title: "Hear → pick the kana", desc: "Recorded kana sounds" },
    { id: "kana-read", kind: "kana", ic: "あ", title: "See kana → pick romaji", desc: "Reading practice" },
    { id: "word-listen", kind: "word", ic: "♪", title: "Hear a word → pick the meaning", desc: "Listening practice" },
    { id: "word-meaning", kind: "word", ic: "猫", title: "See a word → pick the meaning", desc: "Vocabulary" },
    { id: "word-reading", kind: "word", ic: "よ", title: "See kanji → pick the reading", desc: "Kanji words only" },
  ];
  const settings = Object.assign(
    { mode: "kana-listen", script: "hira", dakuten: true, yoon: false, cat: "all", common: false, len: 10 },
    store.get("mohidoi.v2.settings", {})
  );
  const saveSettings = () => store.set("mohidoi.v2.settings", settings);

  function kanaPool() {
    const rows = BASIC.concat(settings.dakuten ? DAKUTEN.concat(HANDAKUTEN) : []);
    const chars = [];
    rows.forEach(([, cells]) => Array.from(cells).forEach((c) => c !== "・" && chars.push(c)));
    if (settings.yoon) YOON.forEach(([, cells]) => chars.push(...cells));
    const scripts = settings.script === "both" ? ["hira", "kata"] : [settings.script];
    const items = [];
    for (const s of scripts)
      for (const c of chars) {
        const k = conv(c, s);
        items.push({ key: "k:" + k, kana: k, ro: tileRomaji(k), script: s, src: clipFor(k) });
      }
    if (settings.mode === "kana-listen") return items.filter((i) => i.src);
    return items;
  }

  function wordPool() {
    return WORDS.filter((w) => {
      if (!w.m || w.alt || w.cat === "kana") return false;
      if (settings.cat !== "all" && w.cat !== settings.cat) return false;
      if (settings.common && !w.c) return false;
      if (settings.mode === "word-reading") return hasKanji(w.w) && w.r;
      return true;
    }).map((w) => ({ key: "w:" + w.id, word: w }));
  }

  const pool = () => (settings.mode.startsWith("kana") ? kanaPool() : wordPool());
  const weight = (key) => {
    const p = progress.items[key];
    if (!p) return 3;
    return [6, 4, 2.5, 1.5, 1, 0.6][Math.min(p.b, 5)];
  };

  function weightedSample(items, n) {
    const left = items.slice();
    const out = [];
    while (out.length < n && left.length) {
      const total = left.reduce((s, i) => s + weight(i.key), 0);
      let x = Math.random() * total;
      let idx = 0;
      for (; idx < left.length - 1; idx++) {
        x -= weight(left[idx].key);
        if (x <= 0) break;
      }
      out.push(left.splice(idx, 1)[0]);
    }
    return out;
  }
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const meaningText = (w) => w.m.slice(0, 2).join("; ");

  // label shown on an option; also the identity used to keep options distinct
  function optionLabel(item) {
    switch (settings.mode) {
      case "kana-listen": return item.kana;
      case "kana-read": return item.ro;
      case "word-reading": return item.word.r;
      default: return meaningText(item.word);
    }
  }

  function buildOptions(item, all) {
    const right = optionLabel(item);
    const seen = new Set([right.toLowerCase()]);
    const sameSound = (o) => {
      if (settings.mode === "kana-listen" || settings.mode === "kana-read") return o.ro === item.ro;
      const a = item.word, b = o.word;
      return (a.r && b.r && toHiragana(a.r) === toHiragana(b.r)) || (a.m[0] || "").toLowerCase() === (b.m[0] || "").toLowerCase();
    };
    let cands = all.filter((o) => o.key !== item.key && !sameSound(o));
    if (settings.mode === "kana-listen") cands = cands.filter((o) => o.script === item.script);
    if (item.word) {
      const same = cands.filter((o) => o.word.cat === item.word.cat);
      if (same.length >= 6) cands = same;
    }
    shuffle(cands);
    const picks = [];
    for (const o of cands) {
      const lab = optionLabel(o);
      if (seen.has(lab.toLowerCase())) continue;
      seen.add(lab.toLowerCase());
      picks.push(lab);
      if (picks.length === 3) break;
    }
    return shuffle([right, ...picks]);
  }

  let session = null;

  function startSession() {
    const items = pool();
    if (items.length < 4) {
      $("#setup-note").textContent = "Not enough items for these settings. Choose a bigger category or turn off “Only common words”.";
      return;
    }
    let queue = weightedSample(items, settings.len);
    while (queue.length < settings.len) queue = queue.concat(weightedSample(items, settings.len - queue.length));
    session = { mode: settings.mode, queue, all: items, i: 0, score: 0, firstTry: 0, missed: [], retried: new Set(), answered: false };
    $("#practice-setup").hidden = true;
    $("#result").hidden = true;
    $("#quiz").hidden = false;
    showQuestion(true);
  }

  function playItem(item, slow) {
    if (item.word) return play(`audio/words/${item.word.id}.ogg`, item.word.w, slow);
    return play(item.src, item.kana, slow);
  }

  function replayButton(item, label) {
    let slow = false;
    const b = el("button", { type: "button", class: "btn btn-quiet replay" });
    b.innerHTML = PLAY_SVG;
    b.append(label || "Play again");
    b.addEventListener("click", () => {
      playItem(item, slow);
      slow = !slow;
    });
    return b;
  }

  function showQuestion(fromTap) {
    const s = session;
    const item = s.queue[s.i];
    s.answered = false;
    const total = s.queue.length;
    $("#quiz-pos").textContent = `Question ${s.i + 1} of ${total}`;
    $("#quiz-meter").style.width = `${(s.i / total) * 100}%`;
    const prompt = $("#quiz-prompt");
    prompt.textContent = "";
    const mode = s.mode;
    let question = "";
    if (mode === "kana-listen" || mode === "word-listen") {
      prompt.append(el("p", { class: "hint", text: "Listen" }), replayButton(item, "Play sound"));
      question = mode === "kana-listen" ? "Which kana did you hear?" : "What does this word mean?";
      if (fromTap) playItem(item, false);
    } else if (mode === "kana-read") {
      prompt.append(el("span", { class: "big", lang: "ja", text: item.kana }));
      question = "How is this read?";
    } else {
      const w = item.word;
      prompt.append(el("span", { class: "big" + (w.w.length > 4 ? " long" : ""), lang: "ja", text: w.w }));
      question = mode === "word-reading" ? "How is this word read?" : "What does this word mean?";
    }
    $("#quiz-question").textContent = question;
    const opts = $("#quiz-options");
    opts.textContent = "";
    const jpOpts = mode === "kana-listen" || mode === "word-reading";
    opts.className = "options" + (jpOpts ? "" : " text");
    buildOptions(item, s.all).forEach((label, n) => {
      opts.append(el("button", { type: "button", class: "opt" + (jpOpts ? " jp-opt" : ""), "data-label": label, lang: jpOpts ? "ja" : null, "aria-keyshortcuts": String(n + 1), text: label }));
    });
    $("#quiz-feedback").textContent = "";
    $("#quiz-next").hidden = true;
    if (s.i > 0) $("#quiz").scrollIntoView({ block: "start" });
  }

  function answer(btn) {
    const s = session;
    if (!s || s.answered) return;
    s.answered = true;
    const item = s.queue[s.i];
    const right = optionLabel(item);
    const ok = btn.dataset.label === right;
    $$(".opt", $("#quiz-options")).forEach((b) => {
      b.disabled = true;
      if (b.dataset.label === right) {
        b.classList.add("right");
        b.append(el("span", { class: "mark", text: "Correct answer" }));
      } else if (b === btn) {
        b.classList.add("wrong");
        b.append(el("span", { class: "mark", text: "Your answer" }));
      }
    });
    const isRetry = s.retried.has(item.key) && s.queue.indexOf(item) !== s.i;
    const rec = progress.items[item.key] || { b: 0, n: 0, ok: 0 };
    rec.n++;
    rec.t = Date.now();
    if (ok) {
      rec.ok++;
      if (!isRetry) {
        rec.b = Math.min(rec.b + 1, 5);
        s.score++;
      }
    } else {
      rec.b = 0;
      if (!s.retried.has(item.key)) {
        s.retried.add(item.key);
        s.missed.push(item);
        // missed items come back a few questions later in this session
        s.queue.splice(Math.min(s.i + 3, s.queue.length), 0, item);
      }
    }
    progress.items[item.key] = rec;
    saveProgress();

    const fb = $("#quiz-feedback");
    fb.textContent = "";
    fb.append(el("span", { class: ok ? "ok" : "no", text: ok ? "Correct." : "Not quite." }));
    const detail = el("span", { class: "detail" });
    if (item.word) {
      const w = item.word;
      detail.append(el("span", { lang: "ja", text: w.w }), w.r && w.r !== w.w ? el("span", { lang: "ja", text: ` (${w.r})` }) : "", ` ${w.ro} = ${meaningText(w)}`);
    } else {
      detail.append(el("span", { lang: "ja", text: item.kana }), ` = ${item.ro}`);
    }
    fb.append(detail);
    if (!ok && !isRetry) fb.append(el("span", { class: "detail muted", text: "It will come back in a moment." }));
    if ((item.word || item.src) && !s.mode.endsWith("listen")) fb.append(replayButton(item, "Hear it"));
    const next = $("#quiz-next");
    next.textContent = s.i + 1 >= s.queue.length ? "See results" : "Next";
    next.hidden = false;
    next.focus({ preventScroll: true });
  }

  function nextQuestion() {
    const s = session;
    if (!s || !s.answered) return;
    s.i++;
    if (s.i >= s.queue.length) return finishSession();
    showQuestion(true);
  }

  function finishSession() {
    const s = session;
    const uniq = s.queue.length - s.missed.length;
    progress.log.push({ t: Date.now(), mode: s.mode, score: s.score, total: uniq });
    if (progress.log.length > 200) progress.log = progress.log.slice(-200);
    saveProgress();
    $("#quiz").hidden = true;
    $("#result").hidden = false;
    $("#result-score").textContent = `${s.score} of ${uniq} right first time`;
    $("#result-text").textContent = s.missed.length
      ? "These will turn up more often next time:"
      : "No misses this session.";
    const ul = $("#result-missed");
    ul.textContent = "";
    s.missed.forEach((item) => {
      if (item.word) ul.append(el("li", {}, el("span", { lang: "ja", text: item.word.w }), ` ${item.word.ro} = ${meaningText(item.word)}`));
      else ul.append(el("li", {}, el("span", { lang: "ja", text: item.kana }), ` = ${item.ro}`));
    });
    session = null;
    renderSummary();
  }

  function renderSummary() {
    const box = $("#progress-summary");
    box.textContent = "";
    if (!progress.log.length) return;
    const rows = MODES.map((m) => {
      const logs = progress.log.filter((l) => l.mode === m.id);
      if (!logs.length) return null;
      const last = logs[logs.length - 1];
      const prefix = m.kind === "kana" ? "k:" : "w:";
      const keys = Object.keys(progress.items).filter((k) => k.startsWith(prefix));
      const strong = keys.filter((k) => progress.items[k].b >= 3).length;
      return el("tr", {}, el("th", { text: m.title }), el("td", { text: `${logs.length} session${logs.length > 1 ? "s" : ""}` }), el("td", { text: `last ${last.score}/${last.total}` }), el("td", { text: `${strong} of ${keys.length} ${m.kind === "kana" ? "kana" : "words"} known well` }));
    }).filter(Boolean);
    box.append(el("h3", { text: "Your progress" }), el("table", {}, el("tbody", {}, rows)));
  }

  function setupPractice() {
    const modes = $("#practice-modes");
    MODES.forEach((m) => {
      modes.append(el("button", { type: "button", class: "mode", "data-mode": m.id, "aria-pressed": "false" },
        el("span", { class: "ic", lang: "ja", "aria-hidden": "true", text: m.ic }),
        el("span", {}, el("b", { text: m.title }), el("small", { text: m.desc }))));
    });
    const catSel = $("#opt-cat");
    CATS.filter(([k]) => k !== "kana").forEach(([k, label]) => catSel.append(el("option", { value: k, text: label })));

    function sync() {
      $$(".mode").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === settings.mode)));
      $$("[data-pscript]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pscript === settings.script)));
      $$("[data-len]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.len) === settings.len)));
      $("#opt-dakuten").checked = settings.dakuten;
      $("#opt-yoon").checked = settings.yoon;
      $("#opt-cat").value = settings.cat;
      $("#opt-common").checked = settings.common;
      const kana = settings.mode.startsWith("kana");
      $("#opt-kana").hidden = !kana;
      $("#opt-words").hidden = kana;
      const n = pool().length;
      let note = settings.mode.endsWith("listen")
        ? "The sound plays when you press Start or Next. You can replay it as often as you like."
        : "Each question has four answers. Wrong ones come back later in the session.";
      if (settings.mode === "kana-listen") note += " Listening uses the recorded kana only.";
      $("#setup-note").textContent = `${note} ${n} ${kana ? "kana" : "words"} in this set.`;
      saveSettings();
    }
    modes.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]");
      if (b) {
        settings.mode = b.dataset.mode;
        sync();
      }
    });
    $$("[data-pscript]").forEach((b) => b.addEventListener("click", () => ((settings.script = b.dataset.pscript), sync())));
    $$("[data-len]").forEach((b) => b.addEventListener("click", () => ((settings.len = Number(b.dataset.len)), sync())));
    $("#opt-dakuten").addEventListener("change", (e) => ((settings.dakuten = e.target.checked), sync()));
    $("#opt-yoon").addEventListener("change", (e) => ((settings.yoon = e.target.checked), sync()));
    $("#opt-cat").addEventListener("change", (e) => ((settings.cat = e.target.value), sync()));
    $("#opt-common").addEventListener("change", (e) => ((settings.common = e.target.checked), sync()));
    $("#practice-setup").addEventListener("submit", (e) => {
      e.preventDefault();
      startSession();
    });
    $("#quiz-options").addEventListener("click", (e) => {
      const b = e.target.closest(".opt");
      if (b) answer(b);
    });
    $("#quiz-next").addEventListener("click", nextQuestion);
    $("#quiz-stop").addEventListener("click", () => {
      session = null;
      $("#quiz").hidden = true;
      $("#practice-setup").hidden = false;
      renderSummary();
    });
    $("#result-again").addEventListener("click", startSession);
    $("#result-setup").addEventListener("click", () => {
      $("#result").hidden = true;
      $("#practice-setup").hidden = false;
    });
    document.addEventListener("keydown", (e) => {
      if (!session || $("#quiz").hidden || e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^[1-4]$/.test(e.key) && !session.answered) {
        const b = $$(".opt", $("#quiz-options"))[Number(e.key) - 1];
        if (b) answer(b);
      }
    });
    $("#reset-progress").addEventListener("click", () => {
      if (!window.confirm("Reset all practice progress on this device?")) return;
      progress.items = {};
      progress.log = [];
      store.remove(PROGRESS_KEY);
      $("#reset-note").textContent = "Progress reset.";
      renderSummary();
    });
    sync();
    renderSummary();
  }

  // ---------- tabs ----------
  const TABS = ["kana", "words", "practice", "about"];
  function showTab(name) {
    if (!TABS.includes(name)) name = "kana";
    TABS.forEach((t) => ($("#" + t).hidden = t !== name));
    $$(".tabs a").forEach((a) => {
      if (a.dataset.tab === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    store.set("mohidoi.tab", name);
  }
  function fromHash() {
    const h = location.hash.replace("#", "");
    showTab(TABS.includes(h) ? h : store.get("mohidoi.tab", "kana"));
  }
  window.addEventListener("hashchange", () => {
    fromHash();
    window.scrollTo(0, 0);
  });
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function stickyOffset() {
    const h = $(".masthead").getBoundingClientRect().height;
    document.documentElement.style.setProperty("--sticky-top", `${Math.round(h)}px`);
  }

  // ---------- boot ----------
  $(".logo").addEventListener("click", () => speakSynth(cowMode ? "Moohidoi" : "Mouhidoi", 0.9));
  $("#kana-charts").addEventListener("click", (e) => {
    const t = e.target.closest(".tile:not(.empty)");
    if (t) onKanaTap(t);
  });
  $$("[data-script]").forEach((b) =>
    b.addEventListener("click", () => {
      kanaScript = b.dataset.script;
      store.set("mohidoi.script", kanaScript);
      renderKana();
    })
  );
  renderKana();
  setupWords();
  setupPractice();
  fromHash();
  stickyOffset();
  window.scrollTo(0, 0);
  window.addEventListener("resize", stickyOffset);
})();
