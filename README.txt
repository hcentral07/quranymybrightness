LJUSKÄLLAN — Koranen på svenska med tafsir och tajwid
========================================================

Vad det här är
---------------
En fristående, statisk webbplats (ren HTML/CSS/JS, inga ramverk, ingen server
eller databas krävs) för att läsa Koranen på arabiska och svenska, med
klassisk tafsir vers för vers och en genomgång av tajwid-läran. Namnet,
designen och koden är egna — inget är kopierat från quranpedia.app eller
någon annan sajt.

Hur du kör det
---------------
Det här är bara filer. Du kan antingen:

1. Öppna index.html direkt i en webbläsare (fungerar oftast, men vissa
   webbläsare blockerar fetch() för lokala file://-sidor — se nedan).
2. Starta en enkel lokal server i mappen, t.ex.:
       python3 -m http.server 8000
   och öppna http://localhost:8000 i webbläsaren.
3. Ladda upp hela mappen till valfri statisk webbhotell/host
   (GitHub Pages, Netlify, Cloudflare Pages, en vanlig webbserver, osv).
   Inga miljövariabler eller API-nycklar behövs.

Om fetch() inte fungerar lokalt: öppna sidan via en lokal server (punkt 2)
istället för att dubbelklicka på filen, annars blockerar webbläsaren
nätverksanropen.

Mappstruktur
------------
index.html      Startsida
quran.html      Lista över alla 114 suror (hämtas live från API)
sura.html       Läs en hel sura, arabiska + svenska (?sura=NUMMER)
tafsir.html     Tafsir för en enskild vers (?sura=NUMMER&aya=NUMMER)
tajwid.html     Genomgång av Tuhfat al-Atfal och al-Jazariyya
om.html         Källor, licenser och ärliga begränsningar
css/style.css   Allt utseende
js/surah-data.js   Svenska namnöversättningar för alla 114 suror
js/app.js       All logik för att hämta och visa data från API:erna

Datakällor (alla fria, ingen nyckel krävs)
-------------------------------------------
- Koranens arabiska text + Bernströms svenska översättning:
  https://api.alquran.cloud/v1  (editions: quran-uthmani, sv.bernstrom)
- Tafsir (Ibn Kathir, al-Jalalayn):
  https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir
  (källkod: https://github.com/spa5k/tafsir_api)
- al-Jalalayn på arabiska direkt som Koranutgåva:
  https://api.alquran.cloud/v1/ayah/{sura}:{vers}/ar.jalalayn

Känd begränsning: ingen svensk tafsir
---------------------------------------
Det finns i dag ingen fri, öppet licensierad svensk översättning av
klassiska tafsirverk. Tafsir-texterna visas därför på arabiska eller
engelska, tydligt märkta. Se om.html för förslag på hur det kan lösas.

Tajwid-sidan
------------
Tuhfat al-Atfal (61 verser) och al-Jazariyya (109 verser) är klassiska
arabiska diktverk om recitationslära. För att inte riskera att återge
en felaktig version av en religiös text ur minnet innehåller tajwid.html
en noggrant genomgången saklig sammanfattning av varje avsnitts innehåll
och regler, inte ett försök att citera originalversraderna. Om du har
tillgång till en verifierad, tryckt utgåva av originaltexten kan du
lägga till den i tajwid.html.

Vidareutveckling — förslag
----------------------------
- Lägg till fler översättningar/tafsir-utgåvor (byt bara edition-identifierare
  i js/app.js, se alquran.cloud/api och tafsir_api/editions.json).
  Det finns 100+ utgåvor registrerade om du vill variera med engelska
  eller arabiska jämförelsetexter.
- Lägg till ljuduppläsning (recitation) via https://everyayah.com eller
  alquran.cloud:s audio-utgåvor.
- Lägg till sökfunktion via /v1/search/{sökord}/{sura}/{edition}.
- Cacha API-svaren lokalt (t.ex. i localStorage) för snabbare upprepade besök.
- Bygg en egen svensk tafsir-översättning, se om.html för ärlig
  diskussion om varför det inte redan finns en.
