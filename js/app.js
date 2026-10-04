// Ljuskällan — delad JS-logik
// Datakällor:
//  - Koranens arabiska text + svensk översättning (Knut Bernström): api.alquran.cloud
//  - Tafsir (122 utgåvor, klassiska och moderna): cdn.jsdelivr.net/gh/spa5k/tafsir_api
//  Ingen nyckel krävs för någon av dessa.

const API_BASE    = "https://api.alquran.cloud/v1";
const TAFSIR_BASE = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir";

async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error("Nätverksfel: " + res.status);
  return res.json();
}

/* ---------- Koranen ---------- */

async function getSurahList(){
  const data = await fetchJSON(`${API_BASE}/surah`);
  return data.data;
}

async function getSurahBilingual(num){
  const data = await fetchJSON(`${API_BASE}/surah/${num}/editions/quran-uthmani,sv.bernstrom`);
  const ar = data.data.find(e => e.edition.identifier === "quran-uthmani");
  const sv = data.data.find(e => e.edition.identifier === "sv.bernstrom");
  return { ar, sv };
}

async function getAyahBilingual(surah, ayah){
  const ref = `${surah}:${ayah}`;
  const data = await fetchJSON(`${API_BASE}/ayah/${ref}/editions/quran-uthmani,sv.bernstrom`);
  const ar = data.data.find(e => e.edition.identifier === "quran-uthmani");
  const sv = data.data.find(e => e.edition.identifier === "sv.bernstrom");
  return { ar, sv };
}

/* ---------- Tafsir ---------- */

/* Enskild utgåva från spa5k/tafsir_api. Returnerar ren text. */
async function getTafsir(editionSlug, surah, ayah){
  const url = `${TAFSIR_BASE}/${editionSlug}/${surah}/${ayah}.json`;
  const data = await fetchJSON(url);
  return data.text || data.tafsir || "";
}

/* al-Jalalayn på arabiska finns direkt som en Koran-"utgåva" hos alquran.cloud */
async function getJalalaynArabic(surah, ayah){
  const ref = `${surah}:${ayah}`;
  const data = await fetchJSON(`${API_BASE}/ayah/${ref}/ar.jalalayn`);
  return data.data.text;
}

/* Hämtar hela listan över tillgängliga tafsir-utgåvor från CDN:en.
   Cachas i minnet så den bara hämtas en gång per sidladdning. */
let _editionsCache = null;
async function loadTafsirEditions(){
  if(_editionsCache) return _editionsCache;
  const url = `${TAFSIR_BASE}/editions.json`;
  const data = await fetchJSON(url);
  _editionsCache = Array.isArray(data) ? data : (data.editions || []);
  return _editionsCache;
}

/* Alias så båda namnen fungerar */
const getAllTafsirEditions = loadTafsirEditions;

/* ---------- Hjälpfunktioner ---------- */

function surahNumberFromQuery(defaultNum = 1){
  const p = new URLSearchParams(location.search);
  const n = parseInt(p.get("sura") || p.get("surah"), 10);
  if(Number.isInteger(n) && n >= 1 && n <= 114) return n;
  return defaultNum;
}

function ayahNumberFromQuery(defaultNum = 1){
  const p = new URLSearchParams(location.search);
  const n = parseInt(p.get("aya") || p.get("ayah"), 10);
  if(Number.isInteger(n) && n >= 1) return n;
  return defaultNum;
}

/* Slug från query, t.ex. ?tafsir=ar-tafsir-ibn-kathir */
function tafsirSlugFromQuery(defaultSlug = "ar-tafsir-ibn-kathir"){
  const p = new URLSearchParams(location.search);
  const s = (p.get("tafsir") || "").trim();
  return s || defaultSlug;
}

function el(tag, attrs = {}, children = []){
  const node = document.createElement(tag);
  for(const [k, v] of Object.entries(attrs)){
    if(k === "class") node.className = v;
    else if(k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if(c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}