/* ============================================================
   tajweed.js — Quran.com tajweed → safe HTML + word timings.
   ============================================================ */

const TJ_API = "https://api.quran.com/api/v4";

/* ---------- Reciter slug → Quran.com recitation ID ---------- */
const RECITER_IDS = {
  "ar.alafasy":             7,
  "ar.abdulbasitmurattal":  2,
  "ar.abdurrahmaansudais":  3,
  "ar.husary":              6,
  "ar.minshawi":            9,
  "ar.shaatree":            4,
  "ar.hudhaify":            5,
  "ar.muhammadayyoub":      1
};

/* ---------- Arabic-Indic digits ---------- */
const AR_DIGITS = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
function toArabicDigits(n){
  return String(n).replace(/\d/g, d => AR_DIGITS[+d]);
}

/* ---------- Basmala detection (mirrors sura.html's stripper, kept
   self-contained here so the tajweed-markup path can use it too) ---------- */
const BM_DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08E1\u08E3-\u08FF]/g;
const BM_ALEF_RE = /[أإٱآ]/g;
const BM_TATWEEL_RE = /\u0640/g;
const BM_NON_BASE_RE = /[^\u0621-\u064A]/g; // keep only bare Arabic letters
const BASMALA_SKELETON = "بسماللهالرحمنالرحيم"; // must match sura.html's inline stripper exactly
const BASMALA_WORD_COUNT = 4; // بِسْمِ · ٱللَّهِ · ٱلرَّحْمَٰنِ · ٱلرَّحِيمِ

/** Strip diacritics/tatweel/alef-variants down to the base skeleton. */
function basmalaSkeleton(str){
  return String(str || "")
    .replace(BM_ALEF_RE, "ا")
    .replace(BM_DIACRITICS_RE, "")
    .replace(BM_TATWEEL_RE, "")
    .replace(BM_NON_BASE_RE, "");
}

/**
 * Walks plain (untagged) ayah text and, if it begins with the basmala,
 * returns { basmala, rest, realCharCount }. Returns null if no basmala.
 */
function detectLeadingBasmala(plainText){
  let skelPos = 0, i = 0;
  for (; i < plainText.length && skelPos < BASMALA_SKELETON.length; i++){
    const ch = plainText[i];
    if (/\s/.test(ch)) continue;
    if (BM_DIACRITICS_RE.test(ch)){ BM_DIACRITICS_RE.lastIndex = 0; continue; }
    const norm = ch.replace(BM_ALEF_RE, "ا");
    if (norm !== BASMALA_SKELETON[skelPos]) return null;
    skelPos++;
  }
  if (skelPos < BASMALA_SKELETON.length) return null;
  while (i < plainText.length && /\s/.test(plainText[i])) i++;
  return {
    basmala: plainText.slice(0, i).trim(),
    rest: plainText.slice(i),
    realCharCount: BASMALA_SKELETON.length
  };
}

/**
 * Counts how many of the leading `realWords` are consumed by the basmala,
 * using the same skeleton normalization as `detectLeadingBasmala`.
 */
function countLeadingBasmalaWords(realWords){
  let skelPos = 0, wordsConsumed = 0;
  for (const w of realWords){
    const text = basmalaSkeleton(w.text_uthmani || "");
    for (const ch of text){
      if (skelPos >= BASMALA_SKELETON.length) return 0; // overshot — not a clean match
      if (ch !== BASMALA_SKELETON[skelPos]) return 0;
      skelPos++;
    }
    wordsConsumed++;
    if (skelPos === BASMALA_SKELETON.length) return wordsConsumed;
  }
  return 0;
}

/**
 * Skips the leading Basmala from a TAGGED tajweed-markup string.
 *
 * The Basmala is always exactly 4 Arabic words, so we count WORD UNITS
 * (not characters) and wait until tag depth returns to 0 after the 4th
 * word has been fully consumed. This never cuts inside an open
 * <tajweed>/<rule> span.
 */
function skipLeadingRealChars(raw){
  const tokens = raw.split(/(<[^>]+>)/g);
  let wordCount = 0;
  let depth = 0;
  let inWord = false;
  let cutTokenIdx = -1;
  let cutCharIdx = -1;

  outer:
  for (let ti = 0; ti < tokens.length; ti++){
    const tok = tokens[ti];
    if (tok === "") continue;

    if (tok.startsWith("<")){
      if (/^<\s*\//.test(tok)) depth = Math.max(0, depth - 1);
      else if (!/\/>\s*$/.test(tok)) depth++;
      continue;
    }

    for (let ci = 0; ci < tok.length; ci++){
      const ch = tok[ci];
      const isSpace = /\s/.test(ch);

      if (!isSpace && !inWord){
        wordCount++;
        inWord = true;
      } else if (isSpace){
        inWord = false;
      }

      if (wordCount > BASMALA_WORD_COUNT && depth === 0){
        cutTokenIdx = ti;
        cutCharIdx = ci;
        break outer;
      }
    }
  }

  if (cutTokenIdx === -1) return "";

  const rest = [];
  const partial = tokens[cutTokenIdx].slice(cutCharIdx);
  if (partial) rest.push(partial);
  for (let ti = cutTokenIdx + 1; ti < tokens.length; ti++) rest.push(tokens[ti]);

  return rest.join("").replace(/^\s+/, "");
}

/* ---------- Fetch one surah ---------- */

async function getSurahWithTajweed(surahNumber, translationId = 159){
  const url = `${TJ_API}/verses/by_chapter/${surahNumber}`
            + `?fields=text_uthmani_tajweed,text_uthmani`
            + `&translations=${translationId}`
            + `&per_page=300`
            + `&words=true`
            + `&word_fields=text_uthmani,audio_url`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Kunde inte hämta sura " + surahNumber);
  const data = await res.json();

  let surahBasmala = null;

  const verses = (data.verses || []).map(v => {
    let tjRaw = v.text_uthmani_tajweed || v.text_uthmani || "";
    let plainText = v.text_uthmani || "";

    // Only char_type_name === "word" entries are real, clickable,
    // audible words. "end" (ayah-end marker) and "pause" (waqf marks)
    // are recitation furniture, not words — excluding them keeps this
    // array's length exactly matching the .w spans tajweedToHtml emits.
    let realWords = (v.words || []).filter(w => w.char_type_name === "word");

    // On surah-opening verses (except 1 and 9) Quran.com puts the
    // basmala in words[]. We strip it out of the displayed text and
    // render it separately via the `basmala` field instead.
    let forceFallback = false;

    if (surahNumber !== 1 && surahNumber !== 9 && v.verse_number === 1){
      const detected = detectLeadingBasmala(plainText);
      if (detected){
        surahBasmala = detected.basmala;
        plainText = detected.rest;
        tjRaw = skipLeadingRealChars(tjRaw);
        forceFallback = true;
      }
    }

    // wordAudios used to pass Quran.com's per-word audio_url straight
    // through for non-basmala verses. That field is NOT reliably
    // aligned to the visible word order — confirmed shifted/garbage on
    // plenty of ordinary ayahs, not just basmala-led ones. We now
    // always emit an empty array here so playVerseWordByWord's own
    // fallback (wordAudioUrl(surah, ayah, i), plain 1-based numbering
    // over the *visible* words) is the only path, everywhere. That
    // fallback is the one that's actually verified correct.
    const wordAudios = [];
    void forceFallback; // kept only for clarity/future debugging

    return {
      numberInSurah: v.verse_number,
      plain:         plainText,
      tajweedHtml:   tajweedToHtml(tjRaw, v.verse_number),
      wordAudios,
      sv:            stripFootnotes(
        (v.translations && v.translations[0] && v.translations[0].text) || ""
      )
    };
  });

  return { verses, basmala: surahBasmala };
}

/* ---------- Word timings ---------- */

const _timingsCache = new Map();

async function getVerseTimings(reciterSlug, surah, ayah){
  const reciterId = RECITER_IDS[reciterSlug];
  if (!reciterId) return null;

  const key = `${reciterId}:${surah}:${ayah}`;
  if (_timingsCache.has(key)) return _timingsCache.get(key);

  try {
    const url = `${TJ_API}/recitations/${reciterId}/by_ayah/${surah}:${ayah}`;
    const res = await fetch(url);
    if (!res.ok){ _timingsCache.set(key, null); return null; }
    const data = await res.json();

    const file = (data.audio_files && data.audio_files[0]) || null;
    const segs = (file && file.segments) || [];
    const timings = segs
      .filter(s => Array.isArray(s) && s.length >= 3)
      .map(s => ({ index: s[0], start: s[1], end: s[2] }));

    const result = (timings.length && file && file.url)
      ? { timings, audioUrl: wordAudioUrlFromApi(file.url) }
      : null;

    _timingsCache.set(key, result);
    return result;
  } catch {
    _timingsCache.set(key, null);
    return null;
  }
}

/* ---------- Markup → safe HTML ---------- */

function tajweedToHtml(raw, verseNumber){
  if (!raw) return "";
  let html = String(raw);

  /* 1. Strip any literal ayah-end ornament so it doesn't glue itself to
        the last word. We render our own medallion afterwards. */
  html = html
    .replace(/<span\s+class=(["']?)(?:end|pause)\1\s*>[\s\S]*?<\/span>/gi, "")
    .replace(/\u06DD\s*[\u0660-\u0669]+/g, "")
    .replace(/\uFD3F\s*[\u0660-\u0669\u06F0-\u06F9]+\s*\uFD3E/g, "")
    .replace(/[\u0660-\u0669]+\s*$/, "")
    .replace(/\u06DE/g, "")
    .trim();

  /* 2. Normalise tajweed tags to spans. */
  const normalised = normaliseRuleTags(html);

  /* 3. Wrap every word. */
  let wrapped = wrapWords(normalised);

  /* 4. Append the medallion after the last word — its own element,
        not part of any .w span. */
  if (verseNumber){
    const numArabic = toArabicDigits(verseNumber);
    wrapped += ` <span class="ayah-end-marker" aria-hidden="true">${ayahEndOrnamentSvg(numArabic)}</span>`;
  }

  return wrapped;
}

/* ---------- Ayah-end ornament (SVG cartouche, image-4 style) ---------- */
function ayahEndOrnamentSvg(digits){
  return `<svg class="ayah-end-badge" viewBox="0 0 64 64" width="1.3em" height="1.3em" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" stroke-width="2">
      <ellipse cx="32" cy="32" rx="19" ry="23"/>
      <path d="M32 2 C 26 8, 38 8, 32 14" stroke-width="1.6"/>
      <path d="M32 62 C 26 56, 38 56, 32 50" stroke-width="1.6"/>
      <path d="M9 20 C 4 24, 4 30, 9 32" stroke-width="1.4"/>
      <path d="M55 20 C 60 24, 60 30, 55 32" stroke-width="1.4"/>
      <path d="M9 32 C 4 34, 4 40, 9 44" stroke-width="1.4"/>
      <path d="M55 32 C 60 34, 60 40, 55 44" stroke-width="1.4"/>
    </g>
    <text x="32" y="39" text-anchor="middle" font-size="20" fill="currentColor" stroke="none">${digits}</text>
  </svg>`;
}

function normaliseRuleTags(input){
  let out = "";
  let i = 0;
  const n = input.length;

  while (i < n){
    const ch = input[i];

    if (ch === "<"){
      const rest = input.slice(i);

      const closeMatch = rest.match(/^<\s*\/\s*(rule|tajweed)\s*>/i);
      if (closeMatch){
        out += "</span>";
        i += closeMatch[0].length;
        continue;
      }

      const openMatch = rest.match(/^<\s*(rule|tajweed)(\s[^>]*)?>/i);
      if (openMatch){
        const attrs = openMatch[2] || "";
        const classMatch = attrs.match(/class\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const cls = classMatch
          ? (classMatch[2] || classMatch[3] || classMatch[4] || "")
          : "";
        out += cls ? `<span class="rule-${cls}">` : `<span>`;
        i += openMatch[0].length;
        continue;
      }

      const anyTag = rest.match(/^<[^>]*>/);
      if (anyTag){
        out += anyTag[0];
        i += anyTag[0].length;
        continue;
      }

      out += "&lt;";
      i++;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

// A chunk that, once tags are stripped away, is made up ENTIRELY of
// combining diacritics / Quranic annotation-and-pause signs (no base
// letter at all) is not a word — it's typographic decoration like
// the small-high-three-dots optional-pause mark (\u06DB) that sits
// between two words in Quran.com's Uthmani markup as its own
// whitespace-delimited token. If wrapWords gave that its own .w
// slot, every real word after it would drift one index too high and
// end up requesting a wbw audio file past the real word count —
// which is exactly what produced the "no sound" words upstream.
const QURANIC_MARK_ONLY_RE = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08E1\u08E3-\u08FF\u0660-\u0669\u06F0-\u06F9]+$/;

function wrapWords(html){
  const tokens = html.split(/(<[^>]+>)/g);

  // Pass 1: split into whitespace-delimited chunks, keeping any inline
  // tajweed-rule <span> tags attached to whichever chunk they land in.
  // Each chunk also carries its own plain (tag-stripped) text so we
  // can tell "real word" from "mark-only" without being fooled by the
  // markup around it.
  const chunks = [];
  let curHtml = "", curText = "";
  const flush = () => {
    if (curHtml !== "") chunks.push({ html: curHtml, text: curText });
    curHtml = ""; curText = "";
  };
  for (const tok of tokens){
    if (tok === "") continue;
    if (tok.startsWith("<")){
      curHtml += tok;
      continue;
    }
    for (const ch of tok){
      if (/\s/.test(ch)){
        flush();
        chunks.push({ html: ch, text: null }); // whitespace, passed through as-is
      } else {
        curHtml += ch;
        curText += ch;
      }
    }
  }
  flush();

  // Pass 2: fold mark-only chunks into the nearest real word instead
  // of letting them consume their own slot. A mark like ۛ follows the
  // word it applies to in the source text ("رَيْبَ ۛ"), so prefer
  // attaching it to the word just emitted; if none has been emitted
  // yet (mark appears before any real word), hold it and prefix it
  // onto the next real word instead.
  const words = []; // { html, isReal: true | null(whitespace) }
  let pendingPrefix = "";
  for (const c of chunks){
    if (c.text === null){ words.push({ html: c.html, isReal: null }); continue; }

    if (QURANIC_MARK_ONLY_RE.test(c.text)){
      let attached = false;
      for (let i = words.length - 1; i >= 0; i--){
        if (words[i].isReal === null) continue; // skip back over whitespace
        if (words[i].isReal){ words[i].html += c.html; attached = true; }
        break;
      }
      if (!attached) pendingPrefix += c.html;
      continue;
    }

    words.push({ html: pendingPrefix + c.html, isReal: true });
    pendingPrefix = "";
  }

  // Pass 3: emit, numbering only the real words.
  let wordIndex = 0;
  let out = "";
  for (const w of words){
    if (!w.isReal){ out += w.html; continue; }
    wordIndex++;
    out += `<span class="w" data-w="${wordIndex}">${w.html}</span>`;
  }
  return out;
}

/* ---------- Misc ---------- */

function stripFootnotes(html){
  return String(html || "").replace(/<sup[^>]*>.*?<\/sup>/g, "").trim();
}

/* ---------- Audio URL builders ---------- */

function pad3(n){
  return String(n).padStart(3, "0");
}

function wordAudioUrlFromApi(apiPath){
  if (!apiPath) return "";
  if (/^https?:\/\//i.test(apiPath)) return apiPath;
  return `https://audio.qurancdn.com/${apiPath.replace(/^\/+/, "")}`;
}

function wordAudioUrl(surah, ayah, wordIndex){
  return `https://audio.qurancdn.com/wbw/${pad3(surah)}_${pad3(ayah)}_${pad3(wordIndex)}.mp3`;
}

function ayahAudioUrl(reciter, globalAyah){
  return `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyah}.mp3`;
}

/* ---------- Word-audio existence check (graceful 404 handling) ---------- */

const _audioCheckCache = new Map(); // url -> boolean | Promise<boolean>
function checkWordAudio(url){
  if (!url) return Promise.resolve(false);
  if (_audioCheckCache.has(url)){
    const v = _audioCheckCache.get(url);
    return typeof v === "boolean" ? Promise.resolve(v) : v;
  }
  const p = fetch(url, { method: "HEAD" })
    .then(r => { _audioCheckCache.set(url, r.ok); return r.ok; })
    .catch(() => { _audioCheckCache.set(url, false); return false; });
  _audioCheckCache.set(url, p);
  return p;
}

/* ---------- Follow-the-reader: play words sequentially ---------- */

function playVerseWordByWord(ayahEl, onWord, startAt = 1){
  const audio = new Audio();
  audio.preload = "auto";

  // wordAudios is always [] now (see getSurahWithTajweed), so this
  // branch is effectively always taken — kept as a guard in case
  // something upstream ever starts populating it again.
  let urls;
  try { urls = JSON.parse(ayahEl.dataset.wordAudios || "[]"); }
  catch { urls = []; }
  urls = urls.map(u => wordAudioUrlFromApi(u));

  if (!urls.some(Boolean)){
    // Build wbw URLs ourselves: plain 1-based numbering over the
    // *visible* .w words (verified correct on 12:1 and consistent with
    // how wbw files are actually named). Missing slots 404 and are
    // skipped silently by the `audio.play().catch(...)` below.
    const surah = Number(ayahEl.dataset.surah);
    const ayah  = Number(ayahEl.dataset.ayah);
    const count = ayahEl.querySelectorAll(".ayah-ar .w").length;
    urls = [];
    for (let i = 1; i <= count; i++){
      urls.push(wordAudioUrl(surah, ayah, i));
    }
  }

  let i = Math.max(0, (startAt || 1) - 1);
  let stopped = false;

  function next(){
    if (stopped) return;
    while (i < urls.length && !urls[i]) i++;   // skip empty slots
    if (i >= urls.length){
      onWord(0, null);
      return;
    }
    i++;
    const wordEl = ayahEl.querySelector(`.ayah-ar .w[data-w="${i}"]`);
    onWord(i, wordEl);
    audio.src = urls[i - 1];
    audio.play().catch(() => next());          // 404 → skip silently
  }

  audio.addEventListener("ended", next);
  audio.addEventListener("error", next);
  next();

  return {
    stop(){
      stopped = true;
      audio.pause();
      audio.removeEventListener("ended", next);
      audio.removeEventListener("error", next);
      onWord(0, null);
    }
  };
}

window.Tajweed = {
  RECITER_IDS,
  getSurahWithTajweed,
  getVerseTimings,
  tajweedToHtml,
  stripFootnotes,
  wordAudioUrl,
  wordAudioUrlFromApi,
  _detectLeadingBasmala: detectLeadingBasmala,
  ayahAudioUrl,
  checkWordAudio,
  playVerseWordByWord
};
