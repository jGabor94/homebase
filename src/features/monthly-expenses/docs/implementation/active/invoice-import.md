# Havi kiadások — számlabeolvasás implementációs terve

Frissítve: **2026-10-07**. Az eredeti importkör és a közös, alapértelmezett tételsablonok implementáltak. Az új sablonviselkedés részleteit a [befejezett megvalósítási jegyzet](../archive/preset-defaults.md) írja le. Ez a terv a még nyitott élő elfogadási lépések miatt aktív.

Az aktuális működés és invariánsok a [mérnöki dokumentumban](../../engineering/active/invoice-import.md), a használat és környezet a [feature README-ben](../../../README.md) szerepelnek. Új szálhoz a projekt README-jéből nyitható átadási jegyzetet olvasd először. A korábbi előkészítő terv nem új feladatlista: a meglévő implementációt ne készítsd el újra.

## Elkészült munkaszakaszok

- [x] Feature-first `monthly-expenses`, Zod-sémák és inferált típusok; helyi hónapindítás, alapértelmezett közös tételek snapshotja, kézi számlasor és PDF-feltöltés.
- [x] Védett `/monthly-expenses`, Google-login, admin jogosultság és kijelölt Gmail-tulajdonos ellenőrzése.
- [x] Külön `gmail.readonly` OAuth-consent, access/refresh token tárolása a meglévő account infrastruktúrában; kontrollált tokenfrissítés, meglévő refresh token megőrzése.
- [x] Gmail-kapcsolati állapot: route → `dal/queries.ts` → `drizzle/operations.ts`, scope/lejárat/tokenlétezés minimális projekcióval. A kliens csak kapcsolati jelzőt kap, tokent nem.
- [x] Mentett kapcsolatnál e-mailes importgomb, egyébként ugyanott összekapcsolás. Visszavont/hiányzó consent külön újrakapcsolási hiba; átmeneti szolgáltatás- vagy kvótahiba nem állítja át a gombot.
- [x] Gmail lapozás, MIME-kezelés, levél-deduplikáció és Budapest szerinti kiküldési hónapszűrés; `(CET)` végmegjegyzés kezelése explicit offset megőrzésével.
- [x] Stabil belső MIME-mellékletazonosító, változó Google-letöltési token újralekérése és hónap/levéltagság ellenőrzése.
- [x] HTTPS-letöltőhost-policy és redirect-/méret-/időkorlát; nincs tetszőleges URL, fizetési művelet vagy szolgáltatói belépésautomatizálás.
- [x] Közös Gmail/feltöltött PDF-feldolgozás, 3 MiB / 30 oldal, `pdf-parse` és parser bufferátadása előtti SHA-256 azonosító.
- [x] Kódos kinyerés és AI-fallback, strukturált eredmény, teljes lokális Zod-validálás, mezőnkénti forrásbizonyíték. A Gateway-séma Gemini-komplexitási határainak kezelése.
- [x] MVM kategóriaütközés javítása, ALFÖLDVÍZ oszlopos összeg/határidő/keltezés, érték nélküli számlaszámfeliratból származó hamis dokumentumhatár megszüntetése.
- [x] Hiányzó keltezés indítja a fallbackot, utána hiányjelzést ad; a keltezés pótlása eltávolítja a megfelelő hiányjelzést. Teljesítés dátuma nem fogadható el keltezésként.
- [x] Import-merge, kézi mezővédelem, konfliktus, törölt sorok és célhónap/futásazonosító védelme; maximum két párhuzamos dokumentumfeldolgozás.
- [x] HUF-összesítés és 50–50% felezés egész fillérrel, részleges eredmény és túlcsordulás jelzése. Korrekciók és kapcsolódó eredetik konzervatív kizárása, nettósítás nélkül.
- [x] Egyetlen oldalfejléc, három egységes művelet, lapos számlalista kategóriacímek/helyőrzők nélkül, rövid tétellista az oldalsávban.
- [x] Végleges feliratok: `category` = **Szolgáltatás típusa**, `documentType` = **Számla típusa**. Mindkét mező megmaradt és szerkeszthető.
- [x] PDF-előnézeti sandbox-ütközés javítása; PDF MIME-ellenőrzés és explicit PDF Blob, forrásvédelmi kontrollok megtartásával.

## Tényleges ellenőrzési eredmények

| Ellenőrzés | Igazolt eredmény / határ |
| --- | --- |
| `npm run test:monthly-expenses` | Legutóbb **41/41 sikeres**; Gmail-kapcsolati és újrakapcsolási állapot tesztjeivel együtt |
| `npx tsc --noEmit` | A Gmail-állapotkezelés javítása után sikeres |
| Célzott ESLint | Az érintett feature-, route-, auth- és jogosultsági fájlok korábbi futtatásai sikeresek; a legutóbbi Gmail-változtatás célzott lintje sikeres |
| Production build | Korábbi implementációs körben sikeres, ideiglenes folyamatbeli DB-tesztcímmel; nem élő DB-próba és nem az összes későbbi javítás buildje |
| Élő Gmail | Saját postafiókból két MVM villany- és egy ALFÖLDVÍZ-PDF letöltése, kinyerése és merge-je sikeres; újraimport három külön sort őrzött meg |
| Keltezés | Ugyanezen három eredeti PDF újrafeldolgozva, mindegyik 2026-10-02 keltezéssel, kódos bizonyítékkal, importfigyelmeztetés nélkül |
| Élő Gateway | `google/gemini-2.5-flash`, szintetikus szöveges számla strukturált kinyerése sikeres; a három jelenlegi szolgáltatói PDF kódosan teljes, nem igényel AI-t |
| Szkennelt PDF | Mockolt út és ellenőrizetlen jelölés tesztelt; szolgáltatói mintával élő felismerés nincs igazolva |
| Böngésző | Külön munkamenetben belépőoldal; teljes bejelentkezett import nem futott. Szintetikus PDF-előnézet a beépített böngészőben üres maradt, vizuális siker nem állítható |
| Későbbi UI-feliratok és dokumentáció | Csak logikai ellenőrzés; új build/lint/typecheck/teszt/böngésző nem indult a kis UI-változások után |

Tesztelt csomagok: Next.js 16.3.6, AI SDK 7.0.127, `pdf-parse` 2.4.5, react-hook-form 7.89.0. Titkok és eredeti PDF-ek nem kerültek tesztfixture-be vagy repositoryba; `.env*` nem módosult. A jelen dokumentum frissítése sem indított alkalmazásellenőrzést.

## Gmail értesítő-besorolás javítása — 2026-10-06

- [x] Élő Gmail-vizsgálat az alkalmazás keresésével: három PDF-es számla és egy „Sikeres számlafizetés” visszaigazolás. A visszaigazolás PDF-hiánya okozta a kettős figyelmeztetést; a keresés lapozása teljes volt.
- [x] Szolgáltatótól független `utils/email-purpose.ts`: új számla / értesítő / bizonytalan besorolás tárgy- és bevezetőjelzésekkel, konzervatív ütközéskezeléssel. Ismeretlen találat nem tűnik el csendben.
- [x] `lib/gmail.ts`: egyértelmű értesítők kizárása, külön hiányzó dokumentum- és bizonytalansági figyelmeztetés; `complete` csak technikai gyűjtési teljesség. Dátumhiány továbbra is jelzett, de nem technikai keresési hiba.
- [x] Célzott Gmail-regressziótesztek: visszaigazolás három számla mellett; több szolgáltató és magyar/angol megfogalmazás; törzsbeli és ütköző jelzések; valódi PDF-hiány; idézett előzmény; API-/levélolvasási hiba; meglévő dátum- és mellékletvédelem.

Ellenőrzés: `npx tsx --conditions=react-server --test src/features/monthly-expenses/tests/gmail.test.ts`, **10/10 sikeres** a végleges besorolási szabályokkal. A tesztek szintetikus Gmail-válaszokat használnak; ez nem az átírt alkalmazás élő importjának vagy UI-jának igazolása.

## Számla nélküli előre felvett tételek

- [x] Külön RHF/Zod `additionalItems` lista névvel és HUF-összeggel, stabil sorazonosítóval és 100 tételes korláttal; az üres vagy hibás szerkesztési sor kimarad az összegből.
- [x] Az összesítés az érvényes tételeket a számlákhoz és a hitelhez adja, fillérpontosan felezve. A sor külön jelenik meg `Számla nélkül` megjelöléssel, és az állapot nem nevezi áttekintettnek az összes számlát.
- [x] Az import továbbra is csak számlasorokat merge-el. A számla megérkezésekor a felhasználó törli az előre felvett sort; nincs automatikus duplikációs következtetés.
- [x] A hónapváltás megerősítése figyelembe veszi az ilyen tételeket. Az adatok újratöltéskor továbbra is elvesznek.
- [x] Célzott tesztek készültek a számításra, hiányos/hibás értékekre, nulla összegre, felezésre, szerkesztésre, törlésre és importhatárra.

Az export továbbra sincs megvalósítva. Ellenőrzés: `npx tsx --conditions=react-server --test src/features/monthly-expenses/tests/additional-items.test.ts src/features/monthly-expenses/tests/invoice-import.test.ts` — **14/14 sikeres**; `npx tsc --noEmit` — sikeres. A számolás és a típusintegráció ellenőrzött; böngészős UI-próba, build és lint ebben a munkaszakaszban nem futott.

## Összegzés és integráció — 2026-10-07

- [x] Közös, tartós sablonok és sablononkénti alapértelmezett jelölő; a hitel is felhasználó által felvett sablon, nincs beépített 81 000 Ft.
- [x] Új kimutatás friss sablonlekérésből másolja az alapértelmezetteket; a megkezdett kimutatást későbbi sablonmódosítás nem írja át.
- [x] Egy sorban név, szerkeszthető összeg és kuka; sablonból másolt név sima szöveg, csak az egyedi tételé szerkeszthető. A forrást az opcionális `presetId` jelzi.
- [x] Tételválasztó csak hozzáadáskor, automatikus lista-frissítéssel; külön frissítésgomb nincs.
- [x] **Összegzés**, **Összesen**, egyetlen egész forintra kerekített **Fele** kijelzés; a belső fillérpontos felezés változatlan.
- [x] Ismétlődő magyarázatok, részösszeg, „részleges, ellenőrzendő” felirat és dupla elválasztóvonal eltávolítva. Az import valódi figyelmeztetései megmaradnak.

Commit előtti ellenőrzés: `npm run test:monthly-expenses` **54/54 sikeres**, `npm run lint` és `npx tsc --noEmit` sikeres. Új böngészős vagy production build ellenőrzés ebben a dokumentációs/merge körben nem futott. A korábbi eredményeket a fenti táblázat történeti állapotként rögzíti; a mostani ellenőrzés nem igazolja a még nyitott élő elfogadási lépéseket.

## Nyitott elfogadási lépések

- [ ] Élő gáz- és MOHU-számlák, szkennelt és módosító dokumentumok; a szélesebb referenciahalmaz hiányainak és helyes értékeinek ellenőrzése.
- [ ] Teljes bejelentkezett felület: import közbeni kézi szerkesztés, hónapváltás, törlés, újraimport, mobil, billentyűzet, natív PDF-előnézet és visszavont kapcsolat utáni UX.
- [ ] Google/Gateway képesség és tényleges PDF-input költség ellenőrzése aktuális hivatalos adatokkal; nincs rögzített ár vagy általános free-tier ígéret.
- [ ] Hosting upload- és futásidőkorlátjai; éles DB/auth konfiguráció és a legutóbbi változások production ellenőrzése, ha telepítés vagy push lesz a feladat.
- [ ] Ismeretlen számlaelrendezés teljesnek látszó téves kódos eredményének kezelése: jelenleg nem indít második AI-ellenőrzést.

## Nyitott döntés és későbbi funkciók

A felhasználó felvetette az AI elsődleges olvasóként használatát és a fájlfeltöltés fogyasztását. Nem történt átállás, a költségkutatás félbeszakadt. A tényleges kód továbbra is determinisztikus első lépés + AI-fallback. Az új szálban a költségre adott válasz és a kívánt irány tisztázása előzze meg az átállást; a korábbi felvetést ne nevezd elkészült funkciónak.

Számlák tartós mentése, history/diagram, családi jegyzetek, export/Drive/e-mail és automatikus korrekciós nettósítás külön scope. A jelen terv nem kér migrációt, `.env*` szerkesztést, commitot, push-t vagy deployt.
