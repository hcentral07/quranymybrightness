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

  const verses = (data.verses || []).map(v => {
    const tjRaw = v.text_uthmani_tajweed || v.text_uthmani || "";
    const wordAudios = (v.words || [])
      .filter(w => w.char_type_name !== "end")
      .map(w => w.audio_url || "");

    return {
      numberInSurah: v.verse_number,
      plain:         v.text_uthmani || "",
      tajweedHtml:   tajweedToHtml(tjRaw, v.verse_number),
      wordAudios,
      sv:            stripFootnotes(
        (v.translations && v.translations[0] && v.translations[0].text) || ""
      )
    };
  });

  return { verses };
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
    // ۝١ style
    .replace(/\u06DD\s*[\u0660-\u0669]+/g, "")
    // ﴿١﴾ ornate parentheses
    .replace(/\uFD3F\s*[\u0660-\u0669\u06F0-\u06F9]+\s*\uFD3E/g, "")
    // lone Arabic-Indic digit clusters at end of string
    .replace(/[\u0660-\u0669]+\s*$/, "")
    // ۞ rub-el-hizb (rare, but strip if any)
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
    wrapped += ` <span class="ayah-end-marker" aria-hidden="true">${numArabic}</span>`;
  }

  return wrapped;
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

/**
 * Wrap each word (with all its diacritics) in
 * <span class="w" data-w="N">…</span>.
 */
function wrapWords(html){
  const tokens = html.split(/(<[^>]+>)/g);
  const out = [];
  let wordIndex = 0;
  let inWord = false;
  const isSpace = (c) => /\s/.test(c);

  for (const tok of tokens){
    if (tok === "") continue;

    if (tok.startsWith("<")){
      out.push(tok);
      continue;
    }

    let buf = "";
    for (const ch of tok){
      if (isSpace(ch)){
        if (inWord){ buf += "</span>"; inWord = false; }
        buf += ch;
      } else {
        if (!inWord){
          wordIndex++;
          buf += `<span class="w" data-w="${wordIndex}">`;
          inWord = true;
        }
        buf += ch;
      }
    }
    out.push(buf);
  }
  if (inWord) out.push("</span>");

  return out.join("");
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

/* ---------- Follow-the-reader: play words sequentially ---------- */

function playVerseWordByWord(ayahEl, onWord){
  const audio = new Audio();
  audio.preload = "auto";

  let urls;
  try { urls = JSON.parse(ayahEl.dataset.wordAudios || "[]"); }
  catch { urls = []; }
  urls = urls.map(u => wordAudioUrlFromApi(u)).filter(Boolean);

  if (!urls.length){
    const surah = Number(ayahEl.dataset.surah);
    const ayah  = Number(ayahEl.dataset.ayah);
    const count = ayahEl.querySelectorAll(".ayah-ar .w").length;
    for (let i = 1; i <= count; i++){
      urls.push(wordAudioUrl(surah, ayah, i));
    }
  }

  let i = 0;
  let stopped = false;

  function next(){
    if (stopped) return;
    if (i >= urls.length){
      onWord(0, null);
      return;
    }
    i++;
    const wordEl = ayahEl.querySelector(`.ayah-ar .w[data-w="${i}"]`);
    onWord(i, wordEl);
    audio.src = urls[i - 1];
    audio.play().catch(()=> next());
  }

  audio.addEventListener("ended", next);
  next();

  return {
    stop(){
      stopped = true;
      audio.pause();
      audio.removeEventListener("ended", next);
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
  ayahAudioUrl,
  playVerseWordByWord
};