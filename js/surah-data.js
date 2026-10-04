// Vägledande svensk betydelse av varje suras namn.
// Detta är beskrivande översättningar av namnet, inte en fullständig
// återgivning av någon specifik översättares förord eller noter.
const SURAH_SV = {
  1:"Öppningen", 2:"Kon", 3:"Imrans familj", 4:"Kvinnorna", 5:"Bordet",
  6:"Boskapen", 7:"Höjderna", 8:"Krigsbytet", 9:"Ånger", 10:"Jona",
  11:"Hud", 12:"Josef", 13:"Åskan", 14:"Abraham", 15:"Hijr",
  16:"Bina", 17:"Nattresan", 18:"Grottan", 19:"Maria", 20:"Ta Ha",
  21:"Profeterna", 22:"Vallfärden", 23:"De troende", 24:"Ljuset", 25:"Urskillningen",
  26:"Poeterna", 27:"Myrorna", 28:"Berättelsen", 29:"Spindeln", 30:"Bysantinerna",
  31:"Luqman", 32:"Prostrationen", 33:"Klanerna", 34:"Saba", 35:"Skaparen",
  36:"Ya Sin", 37:"De sammanslutna leden", 38:"Sad", 39:"Skarorna", 40:"Den Förlåtande",
  41:"Förklarade i detalj", 42:"Rådslaget", 43:"Guldsmycken", 44:"Röken", 45:"Den knäböjande",
  46:"Sandkullarna", 47:"Muhammad", 48:"Segern", 49:"Kamrarna", 50:"Qaf",
  51:"De virvlande vindarna", 52:"Berget", 53:"Stjärnan", 54:"Månen", 55:"Den Nåderike",
  56:"Den stundande händelsen", 57:"Järnet", 58:"Hon som förde sin talan", 59:"Samlingen", 60:"Den prövade kvinnan",
  61:"Slagordningen", 62:"Fredagen", 63:"Hycklarna", 64:"Det ömsesidiga sveket", 65:"Skilsmässan",
  66:"Förbjudandet", 67:"Herraväldet", 68:"Pennan", 69:"Den oundvikliga verkligheten", 70:"Himlastegarna",
  71:"Noa", 72:"Jinnerna", 73:"Den höljde", 74:"Den inswepte", 75:"Uppståndelsen",
  76:"Människan", 77:"De utsända", 78:"Budskapet", 79:"De som rycker ut", 80:"Han rynkade pannan",
  81:"Hoprullandet", 82:"Klyvandet", 83:"Månglarna", 84:"Bristningen", 85:"Stjärnbilderna",
  86:"Nattens besökare", 87:"Den Högste", 88:"Den överväldigande händelsen", 89:"Gryningen", 90:"Staden",
  91:"Solen", 92:"Natten", 93:"Förmiddagen", 94:"Den vidgade bröstkorgen", 95:"Fikonet",
  96:"Levringen", 97:"Allmaktens natt", 98:"Beviset", 99:"Jordbävningen", 100:"De frustande springarna",
  101:"Den förfärliga katastrofen", 102:"Strävan att överträffa varandra", 103:"Den sena eftermiddagen", 104:"Baktalaren", 105:"Elefanten",
  106:"Quraysh", 107:"Det nödvändigaste", 108:"Den rikliga ymnigheten", 109:"Förnekarna", 110:"Hjälpen",
  111:"Fibertågets rep", 112:"Den rena tron", 113:"Den tidiga gryningen", 114:"Människorna"
};

/* ------------------------------------------------------------------
   TAFSIR_EDITIONS — statisk grundlista.

   Innehåller de mest använda utgåvorna med svensk/enkel etikett.
   Den fullständiga listan (122 utgåvor) hämtas dynamiskt via
   loadTafsirEditions() i app.js och slås samman med denna lista.
   ------------------------------------------------------------------ */
const TAFSIR_EDITIONS = [
  /* --- Arabiska, klassiska --- */
  { slug: "ar-tafsir-ibn-kathir",           label: "Ibn Kathir",          labelAr: "تفسير ابن كثير",          lang: "ar", source: "tafsir_api", featured: true  },
  { slug: "ar-tafsir-al-tabari",            label: "al-Tabari",           labelAr: "تفسير الطبري",            lang: "ar", source: "tafsir_api", featured: true  },
  { slug: "ar-tafsir-al-qurtubi",           label: "al-Qurtubi",          labelAr: "تفسير القرطبي",           lang: "ar", source: "tafsir_api", featured: true  },
  { slug: "ar-tafsir-al-baghawi",           label: "al-Baghawi",          labelAr: "تفسير البغوي",            lang: "ar", source: "tafsir_api", featured: true  },
  { slug: "ar-tafsir-al-saddi",             label: "al-Sa'di",            labelAr: "تفسير السعدي",            lang: "ar", source: "tafsir_api", featured: true  },
  { slug: "ar-tafsir-al-wasit",             label: "al-Wasit",            labelAr: "التفسير الوسيط",          lang: "ar", source: "tafsir_api", featured: false },
  { slug: "ar-tafsir-al-muyassar",          label: "al-Muyassar",         labelAr: "التفسير الميسر",          lang: "ar", source: "tafsir_api", featured: true  },
  { slug: "ar-tafsir-al-tahrir-wa-al-tanwir", label: "Ibn Ashur",         labelAr: "التحرير والتنوير",        lang: "ar", source: "tafsir_api", featured: false },

  /* --- Arabiska via alquran.cloud (fallback / kompatibilitet) --- */
  { slug: "ar.jalalayn",                    label: "al-Jalalayn",         labelAr: "تفسير الجلالين",          lang: "ar", source: "alquran",    featured: true  },

  /* --- Engelska --- */
  { slug: "en-tafisr-ibn-kathir",           label: "Ibn Kathir (en)",     labelAr: "Ibn Kathir (EN)",         lang: "en", source: "tafsir_api", featured: true  },
  { slug: "en-al-jalalayn",                 label: "al-Jalalayn (en)",    labelAr: "al-Jalalayn (EN)",        lang: "en", source: "tafsir_api", featured: false },
];

/* Snabbuppslag: slug → utgåva */
const TAFSIR_BY_SLUG = Object.fromEntries(TAFSIR_EDITIONS.map(e => [e.slug, e]));

/* Vilken utgåva som visas om ingen anges i URL:en */
const TAFSIR_DEFAULT_SLUG = "ar-tafsir-ibn-kathir";