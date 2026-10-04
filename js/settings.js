/* ============================================================
   settings.js — user accounts (localStorage) + preferences
   ============================================================ */

const SETTINGS_KEY = "ljuskallan.settings.v1";
const USERS_KEY    = "ljuskallan.users.v1";
const SESSION_KEY  = "ljuskallan.session.v1";

/* ---------- Defaults ---------- */
const DEFAULT_SETTINGS = {
  tajweedEnabled: false,
  tajweedPalette: "classic",     // classic | muted | highcontrast
  qari: "ar.alafasy",            // see QARIS below
  reciterAutoplay: false,
  showTranslation: true,
  showTransliteration: false,
  arabicFontSize: 100,           // percent
  theme: "paper"                 // paper | night
};

const QARIS = [
  { id: "ar.alafasy",         name: "Mishary Rashid Alafasy" },
  { id: "ar.abdulbasitmurattal", name: "Abdul Basit (Murattal)" },
  { id: "ar.abdurrahmaansudais", name: "Abdur-Rahman As-Sudais" },
  { id: "ar.husary",          name: "Mahmoud Khalil Al-Husary" },
  { id: "ar.minshawi",        name: "Mohamed Siddiq El-Minshawi" },
  { id: "ar.shaatree",        name: "Abu Bakr Ash-Shaatree" },
  { id: "ar.hudhaify",        name: "Ali Al-Hudhaify" },
  { id: "ar.muhammadayyoub",  name: "Muhammad Ayyoub" }
];

/* ---------- Low-level helpers ---------- */
function _read(key, fallback){
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function _write(key, val){
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ---------- Settings ---------- */
function getSettings(){
  return Object.assign({}, DEFAULT_SETTINGS, _read(SETTINGS_KEY, {}));
}
function saveSettings(patch){
  const next = Object.assign(getSettings(), patch);
  _write(SETTINGS_KEY, next);
  applySettingsToDOM(next);
  return next;
}
function resetSettings(){
  _write(SETTINGS_KEY, DEFAULT_SETTINGS);
  applySettingsToDOM(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

/* ---------- Users (localStorage; NOT secure, demo only) ---------- */
function getUsers(){ return _read(USERS_KEY, {}); }

// Very small non-cryptographic hash — clearly marked demo-only.
function _hash(str){
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function registerUser(email, password, name){
  email = String(email || "").trim().toLowerCase();
  if (!email || !password) throw new Error("E-post och lösenord krävs.");
  if (password.length < 6) throw new Error("Lösenordet måste vara minst 6 tecken.");
  const users = getUsers();
  if (users[email]) throw new Error("Ett konto med den e-postadressen finns redan.");
  users[email] = {
    email,
    name: name || email.split("@")[0],
    pass: _hash(password),
    created: Date.now()
  };
  _write(USERS_KEY, users);
  _write(SESSION_KEY, { email, since: Date.now() });
  return users[email];
}

function loginUser(email, password){
  email = String(email || "").trim().toLowerCase();
  const users = getUsers();
  const u = users[email];
  if (!u || u.pass !== _hash(password)) throw new Error("Fel e-post eller lösenord.");
  _write(SESSION_KEY, { email, since: Date.now() });
  return u;
}

function logoutUser(){ localStorage.removeItem(SESSION_KEY); }

function currentUser(){
  const s = _read(SESSION_KEY, null);
  if (!s) return null;
  return getUsers()[s.email] || null;
}

/* ---------- Apply settings to the DOM ---------- */
function applySettingsToDOM(s = getSettings()){
  const html = document.documentElement;
  html.dataset.tajweed = s.tajweedEnabled ? "on" : "off";
  html.dataset.tajweedPalette = s.tajweedPalette;
  html.dataset.theme = s.theme;
  html.dataset.showTranslation = s.showTranslation ? "on" : "off";
  html.dataset.showTranslit = s.showTransliteration ? "on" : "off";
  html.style.setProperty("--arabic-scale", (s.arabicFontSize / 100).toString());
}

/* ---------- Exports ---------- */
window.LJ = {
  QARIS,
  getSettings, saveSettings, resetSettings,
  registerUser, loginUser, logoutUser, currentUser,
  applySettingsToDOM
};

// Apply immediately on load so markup doesn't flash unstyled
applySettingsToDOM();