// Ljuskällan — sökning i Koranen
// Använder alquran.cloud:s /search-endpoint. Ingen nyckel krävs.

const SEARCH_BASE = "https://api.alquran.cloud/v1/search";

/* Matchar "2:255" eller "2.255" eller "2 255" → { sura, ayah } */
function parseAyahRef(q){
  const m = String(q).trim().match(/^(\d{1,3})\s*[:.\s]\s*(\d{1,3})$/);
  if(!m) return null;
  const s = parseInt(m[1], 10), a = parseInt(m[2], 10);
  if(s < 1 || s > 114 || a < 1) return null;
  return { sura: s, ayah: a };
}

/* Söker ett ord/fras i den svenska tolkningen OCH den arabiska texten.
   Returnerar en normaliserad lista av matchningar. */
async function searchQuran(query){
  const q = String(query || "").trim();
  if(!q) return { query: q, matches: [], ref: null };

  // Explicit sura:vers-hänvisning
  const ref = parseAyahRef(q);
  if(ref){
    try{
      const res  = await fetch(`https://api.alquran.cloud/v1/ayah/${ref.sura}:${ref.ayah}/editions/quran-uthmani,sv.bernstrom`);
      const data = await res.json();
      const ar   = data.data.find(e => e.edition.identifier === "quran-uthmani");
      const sv   = data.data.find(e => e.edition.identifier === "sv.bernstrom");
      return {
        query: q,
        ref,
        matches: [{
          sura: ar.surah.number,
          suraName: ar.surah.englishName,
          suraNameAr: ar.surah.name,
          suraNameSv: (typeof SURAH_SV !== "undefined" && SURAH_SV[ar.surah.number]) || ar.surah.englishNameTranslation,
          ayah: ar.numberInSurah,
          ar: ar.text,
          sv: sv ? sv.text : "",
        }]
      };
    }catch(err){
      return { query: q, ref, matches: [], error: err.message };
    }
  }

  // Fritextsökning: kör svenska och arabiska parallellt
  const [svRes, arRes] = await Promise.allSettled([
    fetch(`${SEARCH_BASE}/${encodeURIComponent(q)}/sv.bernstrom`).then(r => r.json()),
    fetch(`${SEARCH_BASE}/${encodeURIComponent(q)}/ar`).then(r => r.json()),
  ]);

  const byAyah = new Map(); // key "sura:ayah" → match

  function ingest(payload, lang){
    if(!payload || payload.code !== 200 || !payload.data) return;
    (payload.data.matches || []).forEach(m => {
      const key = `${m.surah.number}:${m.numberInSurah}`;
      const existing = byAyah.get(key) || {
        sura: m.surah.number,
        suraName: m.surah.englishName,
        suraNameAr: m.surah.name,
        suraNameSv: (typeof SURAH_SV !== "undefined" && SURAH_SV[m.surah.number]) || m.surah.englishNameTranslation,
        ayah: m.numberInSurah,
        ar: "",
        sv: "",
      };
      if(lang === "ar") existing.ar = m.text;
      else existing.sv = m.text;
      byAyah.set(key, existing);
    });
  }

  if(svRes.status === "fulfilled") ingest(svRes.value, "sv");
  if(arRes.status === "fulfilled") ingest(arRes.value, "ar");

  const matches = Array.from(byAyah.values())
    .sort((a, b) => a.sura - b.sura || a.ayah - b.ayah);

  return { query: q, ref: null, matches };
}

/* Markerar sökordet i en text med <mark>. Escape:ar HTML först. */
function highlightMatch(text, query){
  const safe = String(text || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if(!query) return safe;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try{
    return safe.replace(new RegExp(`(${q})`, "gi"), "<mark>$1</mark>");
  }catch{
    return safe;
  }
}