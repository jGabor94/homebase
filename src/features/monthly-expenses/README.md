# Monthly expenses — havi kiadások

A család kézzel indított havi elszámolásai: számlák előkészítése Gmailből, feltöltött PDF-ből vagy kézi adatbevitellel, valamint előre felvett havi költségek kezelése.

## Állapot

Frissítve: **2026-10-10**. Az aktuális működést ez a README és az aktív mérnöki dokumentumok rögzítik; a [korábbi átadási jegyzet](../../../.claude/handoffs/2026-10-06-182233-monthly-expenses.md) történeti háttér.

Az implementáció a `/app/monthly-expenses` oldalon érhető el. Az `/app` közös shadcn sidebarjának „Közművek” menüpontja ide vezet; a dashboard adatai továbbra is fiktívek. A számlák csak az oldal helyi állapotában élnek, újratöltéskor elvesznek. A saját Gmailből három eredeti októberi PDF letöltése, beolvasása, összevonása és ismételt importja élő próbában sikeres volt.

- [Mérnöki terv](docs/engineering/active/invoice-import.md): működés, adatfolyam, invariánsok, hibakezelés és elfogadási feltételek.
- [Implementációs terv](docs/implementation/active/invoice-import.md): munkaszakaszok, érintett fájlok, integrációs előfeltételek és célzott ellenőrzések.
- [Közös sablonok mérnöki leírása](docs/engineering/active/expense-presets.md): hozzáférés, tartós tárolás és helyi másolatok.
- [Alapértelmezett sablonok](docs/implementation/archive/preset-defaults.md): befejezett implementáció és adatbázisos ellenőrzés.
- [Összegzés exportjának implementációja](docs/implementation/archive/summary-export.md): befejezett export, levélküldés és ellenőrzési eredmények.

## Első fejlesztési kör

- Év/hónap kiválasztása és új, helyi kimutatás indítása.
- Egy saját Gmail-fiók számláinak beolvasása gombnyomásra.
- Manuális PDF-feltöltésből új számlasorok automatikus létrehozása.
- Új számla kézi felvitele, az automatikusan kitöltött adatok javítása.
- A kimutatásban számla nélkül is felvehető előre ismert tétel névvel és összeggel; a beérkező számla megérkezésekor ezt a sort kézzel törölni kell. Ezek az adatok is csak az aktuális böngészőfülben élnek.
- A **Beállítások** oldalon közös, több eszközről elérhető tételsablonok hozhatók létre, szerkeszthetők és törölhetők. Az alapértelmezettnek jelölt sablonok az új kimutatás indításakor automatikusan másolatként kerülnek be; a későbbi sablonmódosítás vagy törlés nem változtatja meg a havi sort.
- Vercel AI SDK + AI Gateway csak a szükséges adatkinyeréshez; kódos keresés, normalizálás, validálás, duplikációszűrés és számolás.

Az oldalsó összegzés PDF-, PNG- vagy TXT-fájlként letölthető és Gmailen elküldhető. A Mentés letiltott helyőrző; a későbbi művelet csak a tényleges számlákat tárolja. Számla-adatbázis és Drive-mentés nincs. A közös sablonok `expense_presets` adatbázis-táblája létrejött, tárolásuk tartós. Az OAuth-hozzáférés a meglévő hitelesítési infrastruktúrát használja, elkülönítve a későbbi számlatárolástól.

Az általános fejlesztési szabályokat a [feature-konvenciók](../AGENTS.md), a megjelenést a [Homebase design](../../../.agents/DESIGN.md) írja le.

## Beállítás

### Aktuális felület és adatkinyerés

Az oldalsáv címe **Összegzés**, a végösszeg **Összesen**, alatta egyetlen **Fele** sor látható. A felezés fillérpontos, a kijelzett félösszeg egész forintra kerekített. A tételek neve, összege és törlésgombja egy sorban van. Mentett sablonnál a név sima szöveg, egyedi tételnél szerkeszthető. A választó csak a „Tétel hozzáadása” gombbal nyílik meg, ekkor automatikusan frissül a lista. A külön frissítésgomb, számla-részösszeg, beépített hitelsor, „Számla nélkül” magyarázatok és „részleges, ellenőrzendő” összegzésfelirat eltűntek; az import tényleges hibái és figyelmeztetései megmaradnak.

A számlák egy listában szerepelnek, külön kategóriafejlécek és üres kategória-helyőrzők nélkül. Az oldalsáv minden aktuális sor szolgáltatástípusát, szolgáltatóját és összegét mutatja. Egyetlen „Havi kiadások” fejléc és három egységes művelet van: e-mailes beolvasás/kapcsolódás, PDF-feltöltés, kézi felvitel; mobilon egymás alatt.

**Szolgáltatás típusa** = `category` (gáz, villany, víz, hulladék, egyéb). **Számla típusa** = `documentType` (normál, jóváírás, helyesbítő, sztornó). Mindkettő megmaradt, az importban automatikus és kézzel javítható.

A jelenlegi út **kódos adatkinyerés → szükség esetén AI → ellenőrzés és összevonás**. Egy PDF legfeljebb egy AI-hívást indít, nem mezőnként külön. Fallback indul, ha a PDF nem olvasható, nincs azonosított számlasor, vagy hiányzik az összeg, pénznem, fizetési határidő, számlaszám, időszak, számla típusa vagy számla kelte. A szolgáltató/kategória hiánya önmagában nincs a feltételben; ha emiatt nincs azonosított sor, az AI elindul.

Szöveges AI-kinyerésnél a számozott oldalszöveget küldjük. Ha az AI-ág képi vagy nagyon rövid szövegű oldalt érzékel, az eredeti PDF-et küldi. A strukturált eredményt teljes Zod-sémával és szöveges forrásbizonyítékkal ellenőrizzük; képi eredmény külön ellenőrzési jelölést kap. Hiányzó keltezés az AI után is figyelmeztetés, és a sor nem jelölhető ellenőrzöttnek. A teljesnek látszó, de téves kódos eredmény nem kap automatikus második AI-ellenőrzést.

Az AI elsődleges használata és a PDF-küldés költsége felmerült, de az átállás nem történt meg, a díjbecslés nem készült el. Modellárat és free-tier jogosultságot az új szálban aktuális hivatalos forrásból kell ellenőrizni.

### Környezet és Gmail-kapcsolat

A környezeti változókat a tulajdonos adja meg a futtatókörnyezetben. A kulcsok kizárólag szerveroldalon használhatók; ne legyen `NEXT_PUBLIC_` előtagjuk, és ne kerüljenek a repositoryba.

| Változó | Mire kell? |
| --- | --- |
| `DATABASE_URL` | Felhasználók, OAuth-accountok és közös `expense_presets` sablonok. Számlaadatok nem kerülnek az adatbázisba. |
| `AUTH_SECRET` | Auth.js munkamenetek hitelesítéséhez. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | A saját Google OAuth webalkalmazás hozzáférése. |
| `BOOTSTRAP_ADMIN_EMAIL` | Az első Google-regisztrációkor admin szerepet kapó saját e-mail-cím. Meglévő felhasználó szerepét nem változtatja meg utólag. |
| `MONTHLY_EXPENSES_GMAIL_EMAIL` | A kijelölt saját Gmail-postafiók. Ha hiányzik, a bootstrap admin címe az alapérték. |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway kulcs az AI-kinyeréshez. |
| `AI_GATEWAY_MODEL` | A kiválasztott `provider/model` azonosító. Strukturált kimenetet, szkennelt PDF-hez PDF-bemenetet is támogató modell szükséges. |
| `MONTHLY_EXPENSES_INVOICE_HOSTS` | Opcionális, vesszővel elválasztott pontos hostnevek a levélben szereplő közvetlen PDF-letöltéshez. Alapból egyetlen külső letöltőhost sem engedélyezett. |

A Google Cloud projektben engedélyezd a Gmail API-t, állítsd be az OAuth consentet és a saját tesztfelhasználót. A callback URL helyben `http://localhost:3000/api/auth/callback/google`, telepítésnél a saját HTTPS-domain megfelelő útvonala. Google-belépés után a Havi kiadások oldalon a külön Gmail-csatlakoztatás kér `gmail.readonly` engedélyt. Ez olvasási jog, nem küldési vagy fizetési művelet.

A havi funkcióhoz az első körben admin szerep kell. A Gmail-olvasás ezen felül ellenőrzi a kijelölt tulajdonost és a Google által visszaadott tényleges postafiókot is. A Google újraengedélyezése megtartja a korábban kapott refresh tokent, ha a válasz nem küld újat.

A védett `dal/queries.ts` a `drizzle/operations.ts` minimális account-adatain keresztül olvassa a kapcsolati állapotot: scope, lejárat és tokenlétezési jelzők. Nyers token nem kerül a kliensre. Mentett olvasási scope és refresh token, vagy még használható access token esetén az összekapcsolás helyett „E-mailekből” látszik. Visszavonás vagy hiányzó scope import közben `gmail-reconnect-required` hibát ad, és visszahozza a kapcsolódási műveletet; hálózati hiba, kvóta vagy letiltott API nem. Az oldalbetöltési állapot tárolt adatokon alapul, nem élő Google-validáláson; a tényleges hozzáférést az import ellenőrzi.

A Gmail-források `attachmentId` mezője a levélen belüli stabil MIME-részre mutató belső hivatkozás (`part:<partId>`), inline PDF esetén MIME-útvonal (`inline:<path>`). A Google változó melléklet-letöltési azonosítóját minden letöltés és előnézet előtt újra lekérjük; a hónapot és a PDF levélhez tartozását ekkor is ellenőrizzük. A levéldátum végén szereplő megjegyzést, például `(CET)`, figyelmen kívül hagyjuk, és a kifejezett időzónaeltolást használjuk. Hiányzó időzónát vagy kiküldési dátumot nem helyettesítünk a beérkezés idejével.

Az AI-nak küldött JSON-séma megtartja a mezőket, típusokat, kötelező tulajdonságokat és enumokat, de a Gemini sémakomplexitási korlátja miatt nem tartalmaz szöveghossz-, elemszám- és számbeli határokat. Ezeket a teljes Zod-sémával a szerveren, közvetlenül az AI-válasz után továbbra is ellenőrizzük. Túlméretes vagy hibás válaszból nem készül számlaadat. A `google/gemini-2.5-flash` modellel szintetikus számla szöveges adatkinyerése élő Gateway-próbában sikeres volt; ez a saját szolgáltatói és szkennelt PDF-ek ellenőrzését nem helyettesíti.

A letöltőhost-listába csak a saját számlalevélben ellenőrzött számlaszolgáltató pontos domainjét add meg, protokoll és útvonal nélkül. Nem használ wildcardot; átirányításkor a célhostnak is engedélyezettnek kell lennie. Engedélyezés nélkül a Gmail PDF-mellékletei és a kézi feltöltés tovább használhatók.

### Gmail-levelek szerepe és figyelmeztetései

A széles Gmail-keresés után szolgáltatótól független, bővíthető magyar/angol jelzések alapján különítjük el az új számlaértesítőt, a fizetési visszaigazolást/emlékeztetőt és a bizonytalan találatot. Elsődleges a tárgy; szükség esetén a levél eleje segít, az idézett előzmény nélkül. Az egyértelmű visszaigazolások és emlékeztetők kimaradnak. Ütköző jelzések vagy ismeretlen megfogalmazás esetén nincs csendes kizárás: az elérhető dokumentum feldolgozható, dokumentum nélkül ellenőrzési figyelmeztetés marad. Ez szabályalapú besorolás, nem minden levélformátumra garantált felismerés, és nem indít AI-hívást.

A gyűjtés `complete` jelzője kizárólag a technikai teljességet jelenti: minden keresési oldal és találati levél olvasható volt-e, illetve elértünk-e egy korlátot. A hiányzó PDF vagy bizonytalan kiküldési dátum külön figyelmeztetés; önmagában nem eredményez „Gmail-keresés részleges” üzenetet.

## Korlátok és ellenőrzés

- PDF-enként legfeljebb **3 MiB / 30 oldal**; a fájl tartalmát a szerver is ellenőrzi.
- Gmailből MVM gáz/villany, ALFÖLDVÍZ és MOHU; kézi feltöltéssel más szolgáltató is felvihető.
- A hónap a levél kiküldési időpontja alapján, Budapest időzónában értendő. Hiányos dátum nem kap kitalált pótlást.
- Hiányzó mező, bizonytalan forrás, ütközés és módosító számla külön ellenőrzési jelölést kap. Az importált adatokat a számlával össze kell vetni.
- A jóváírások, helyesbítések és sztornók, illetve az azonosított kapcsolódó eredetik ebben a verzióban kimaradnak az összegzésből; automatikus nettósításuk még nincs.
- Az összesítés a számlák és a kézi vagy sablonból másolt tételek összegét fillérpontosan felezi; nincs automatikusan hozzáadott hitelösszeg.
- A portálbelépést vagy CAPTCHA-t igénylő számláknál manuális PDF-feltöltés szükséges.
- Nincs automatikus mentés, Drive-művelet vagy számlafizetés. Az export és a mellékletes levélküldés külön felhasználói gombnyomásra indul.

Célzott tesztek: `npm run test:monthly-expenses` — 2026-10-07-én **54/54 sikeres teszt**, sikeres teljes lint és típusellenőrzés. A 2026-10-05-i élő Gmail-próba két MVM villany- és egy ALFÖLDVÍZ-számlát dolgozott fel, importfigyelmeztetés és mezőhiba nélkül. A fizetendő összegek, határidők, számlaszámok és időszakok ellenőrzése, a különböző PDF-ek megkülönböztetése, az ismételt import duplikációszűrése és az összesítés is átment. Ezeket a szöveges PDF-eket kódosan olvassuk ki, Gateway-hívás nélkül. Az MVM első oldalának szolgáltatása elsőbbséget kap a későbbi energiamix-tájékoztatóval szemben; az ALFÖLDVÍZ külön sorokban tárolt címkéit és értékeit szigorú elrendezésfelismerés kapcsolja össze. A dokumentumazonosító az eredeti bájtok SHA-256 lenyomata, még a parser bufferátadása előtt. A valódi számlák nem kerültek a repositoryba. Szkennelt számlák élő felismerése és a bejelentkezett felület teljes böngészős ellenőrzése még nem igazolt. A részletes eredményeket az implementációs terv rögzíti.

## Összegzés exportja

A PDF és PNG kompakt, mobilra tervezett Homebase-kártyákat használ. A számlanév félkövér, az összeg a jobb felső sarokban van; alatta számlaszám, fizetési határidő és fogyasztási időszak szerepel. Hiányzó alapadatnál „Nincs megadva” látható. A TXT ugyanazokat az adatokat tartalmazza. A PDF szövege vektoros és kijelölhető, a fontok helyben tároltak és beágyazottak. A szokásos havi kimutatás legfeljebb 960 pontos tartalommagasságig egy, tartalomhoz igazított PDF-oldalra kerül; hosszabb listánál lapozódik. A PNG 1296 pixel széles, magassága követi a tartalmat.

Az **Exportálás…** modal PDF, kép (PNG) és szöveg (TXT) választót, letöltést és e-mail-küldést kínál. A teljes oldalsó összegzést exportálja, beleértve a számla nélküli tételeket, összesent és felezést; az eredeti számlafájlokat nem csatolja. A címzett **sz.marcsi85@gmail.com**, a levélsablon előnézete küldés előtt látható. A küldéshez külön **gmail.send** consent kell az olvasási engedély mellé; a Google-átirányítás előtt töltsd le a helyi kimutatást. Nagy mellékletnél a letöltés használható, az e-mail méretkorlátot jelez. Részletek: [export mérnöki leírás](docs/engineering/active/summary-export.md).
