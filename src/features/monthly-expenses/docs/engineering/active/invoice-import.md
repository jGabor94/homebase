# Havi kiadások — számlabeolvasás

Frissítve: **2026-10-07**. Implementált első kör, helyi ellenőrzések és részleges élő integráció igazolva. Az aktuális működést leíró mérnöki dokumentum aktív marad.

## Cél és hatókör

A család az aktuális hónapra kézzel indít új kimutatást, ha arra még nincs mentés, vagy a listából megnyit egy korábbi kimutatást. Számlák Gmailből, PDF-feltöltésből és kézi bevitellel kerülnek a szerkeszthető űrlapra; a közös alapértelmezett sablonok csak az indításkor másolódnak be. A számlák és felvett tételek 50–50% megosztása egész fillérrel, kódosan készül, beépített hitelösszeg nélkül.

Az űrlap helyi állapota újratöltéskor elvész, ha a kimutatást nem mentették el. A mentés és visszatöltés részleteit a [havi kimutatásmentési specifikáció](monthly-report-storage.md) írja le; a számlák normalizált oszlopokban, az egyedi és sablonból másolt összegző tételek a szülő JSONB mezőjében tárolódnak, fájltartalom nélkül. Az OAuth-hozzáférés a meglévő account táblában tartós; automatikus mentés és Drive-művelet nincs. Az összegzés külön [exportfolyamata](summary-export.md) PDF/PNG/TXT letöltést és mellékletes e-mail-küldést biztosít. A főoldal továbbra is mock dashboard.

## Felhasználói folyamat és mezők

1. A kezdőnézetben egy váltható fogyasztási és költségdiagram, alatta a mentett kimutatások listája és feltételesen az aktuális havi indítógomb jelenik meg. Megnyitás után külön részletnézet mutatja a számlákat és az összegzést; visszalépéskor a nem mentett módosítások eldobása megerősítést kér.
2. Három egységes művelet: Gmail-beolvasás/összekapcsolás, PDF-feltöltés, kézi számlafelvitel. Mobilon egy oszlopban.
3. Számlakártyák egy listában, kategóriacímek és üres kategória-helyőrzők nélkül. A kategória megmarad az adatokban, egy szolgáltatáshoz több sor is tartozhat.
4. Az **Összegzés** oldalsáv a számlák szolgáltatástípusát, szolgáltatóját és összegét, majd a havi tételeket, az **Összesen** és egyetlen **Fele** sort mutatja. Nincs beépített hitel vagy külön számla-részösszeg. A „Fele” kijelzés egész forintra kerekít; a belső számítás fillérpontos.
5. Importált sorok felhasználói átnézésre várnak. Forrás-PDF és mezőnkénti bizonyíték segíti az ellenőrzést; hiányos eredmény nem teljes havi összeg.

A számlák mellett külön, legfeljebb 100 elemű `additionalItems` lista kezel kézzel megadott, számla nélküli tételeket. Egy ilyen sorhoz csak stabil azonosító, név és nemnegatív HUF-összeg kell; az érvényes összege hozzáadódik az összeshez, de a kimutatás nem állíthatja, hogy minden számlát átnéztek. Az üres vagy hibás sor látható marad szerkesztésre, de nem számít bele. A Gmail- és PDF-import kizárólag a számlalistát merge-eli, a két sortípus nem egyesül automatikusan. Ha megérkezik a számla, a felhasználó törli az előre felvett sort.

| Adat | Jelentés / felirati név |
| --- | --- |
| `providerName` | Szolgáltató / kibocsátó |
| `category` | **Szolgáltatás típusa**: gáz, villany, víz, hulladék, egyéb |
| `documentType` | **Számla típusa**: normál, jóváírás, helyesbítő, sztornó |
| `invoiceNumber` | Számlaszám szövegként, vezető nullákkal |
| `amountMinor`, `currency` | Fizetendő bruttó összeg egész fillérben és pénznem |
| `dueDate`, `issuedAt` | Fizetési határidő és számla kelte, külön ISO-dátum |
| `billingPeriod` | Eredeti időszakszöveg; külön kezdő/végdátum nincs |
| `sentAt`, `reportMonth` | Gmail-kiküldés és elszámolási hónap külön |
| `relatedInvoiceNumber` | Kapcsolódó eredeti számla módosító dokumentumnál |
| `id`, `sources` | Stabil helyi sorazonosító, több forráskapcsolat, dokumentumhash, számlaindex, oldalak |
| `fieldEvidence`, `fieldOrigin`, `manuallyEditedFields` | Oldal/idézet, kódos/AI/kézi eredet, kézi javításvédelem |
| `issues`, `conflicts`, `reviewStatus` | Hiányok, ütközések és felhasználói ellenőrzés |

Hiányzó érték nem kap becsült összeget vagy mai dátumot. Az időszak, teljesítés, keltezés és kiküldés nem helyettesíti egymást. Mindkét típusmező megmaradt, szerkeszthető; „Dokumentum jellege” néven már nincs mező.

## Gmail és hozzáférés

Gmailből csak MVM gáz/villany, ALFÖLDVÍZ és MOHU kerülhet be; manuális import más szolgáltatót is enged. A hónap a levél kiküldése alapján, Europe/Budapest időzónában értendő, nem a fogyasztási időszak szerint. A már kifizetett számla is közös költség.

- Admin jogosultság, kijelölt tulajdonos és tényleges Google-postafiók ellenőrzése szerveroldalon. Másik admin nem kap hozzáférést a tulajdonos Gmailjéhez.
- Külön OAuth-consent: alap Google-scope-ok és `gmail.readonly`, offline hozzáféréssel. Az import nem kér küldési vagy írási jogot. Az exportmodal külön engedélykérése adhat gmail.send scope-ot. A Google-projektben Gmail API és megfelelő consent/tesztfelhasználó szükséges.
- Access/refresh token, scope és lejárat a meglévő account táblában; OAuth-token nem kerül a kliensre. Új engedélyezéskor hiányzó új refresh token nem törli a meglévőt.
- A route védett DAL-lekérdezéssel olvassa a mentett scope-ot, lejáratot és tokenlétezési jelzőket. Megújítható vagy még használható kapcsolatnál „E-mailekből”, egyébként összekapcsolás látszik. Ez tárolt állapot, nem élő Google-ellenőrzés; a tényleges hozzáférést az import igazolja.
- Visszavonás/hiányzó scope `gmail-reconnect-required` hibát ad, és visszahozza a kapcsolódási műveletet. Kvóta, hálózati vagy letiltott API-hiba nem kér automatikusan új consentet.
- Keresés Unix-másodperces hónaphatárokkal és ráhagyással, pontos utólagos dátumszűréssel; lapozás és levélazonosító alapú deduplikáció. Részleges keresés részlegesnek látszik.
- RFC-levéldátum végén `(CET)` jellegű megjegyzés figyelmen kívül marad, a kifejezett offset megmarad. Hiányzó időzónát/kiküldést nem pótol a Gmail beérkezése.
- Belső mellékletazonosító: stabil MIME-rész (`part:<partId>`) vagy inline útvonal. A változó Google-letöltési tokent minden letöltéskor újra lekérjük; hónap és levélhez tartozás ismét ellenőrzött.
- PDF-link csak pontosan engedélyezett HTTPS-hostról, ellenőrzött redirecttel. Tetszőleges URL, privát hálózat és fizetési útvonal tiltott. Portálbelépés/CAPTCHA mögötti fájlhoz kézi feltöltés kell.

### Levélszerep és a gyűjtés teljessége

A Gmail-keresés szándékosan széles. A találatokon külön, tiszta `utils/email-purpose.ts` besorolás fut: `invoice`, `notification`, `uncertain`. Bővíthető, szolgáltatófüggetlen magyar/angol jelzéskészletet használ. Az egyértelmű új számla tárgya elsőbbséget kap a levél fizetési szövegével szemben. Egyébként a tárgy és legfeljebb a levél bevezető 600 normalizált karaktere alapján dönt, HTML-stílusok és felismerhető idézett előzmények nélkül. Fizetési visszaigazolás és emlékeztető csak egyértelmű jelzéssel zárható ki; ütköző jelzések bizonytalanságot eredményeznek. A levéltörzs általános „emlékeztető” szava önmagában nem kizárás.

Bizonytalan levél elérhető dokumentuma továbbra is feldolgozható. Dokumentum nélkül külön bizonytalansági figyelmeztetés marad; felismert számlaértesítőnél a hiányzó PDF pótlását kérjük. A dátumhiány csak támogatott és ki nem zárt számlajelöltnél figyelmeztetés. A besorolás a letöltéskori forrásellenőrzéskor is ugyanaz, nem indít AI-hívást.

`complete` kizárólag technikai gyűjtési teljesség: API-/lapozási-/levélolvasási hiba vagy keresési korlát teszi hamissá. A dokumentumhiány és dátumbizonytalanság a `warnings` mezőbe kerül, nem változtatja ezt a jelzőt. A technikailag teljes keresés nem bizonyítja a havi számlák üzleti teljességét.

## PDF és AI-fallback

Közös út: Gmail/feltöltött PDF → szerveroldali PDF-validálás → oldalszöveg → kódos kinyerés → szükség esetén AI → bizonyítékellenőrzés → normalizálás → merge → szerkeszthető sorok. Limit: 3 MiB, 30 oldal, legfeljebb 10 számlajelölt; hosting futásidőkorlátja külön ellenőrizendő.

A dokumentumhash az eredeti bájtok SHA-256 lenyomata, még a parser bufferátadása előtt. A kód címkézett mezőket és szigorú, ismert oszlopos blokkokat keres. Az MVM első oldali szolgáltatása elsőbbséget kap a későbbi energiamix-szöveggel szemben. Az ALFÖLDVÍZ oszlopos fizetési és keltezési blokkja a megfelelő értéket rendeli a címkéhez; a teljesítés dátuma nem keltezés. Érték nélküli számlaszámfelirat kettőspontja nem válhat számlaszámmá vagy új számlahatárrá.

Az AI **fallback**, nem elsődleges olvasó. A tényleges feltétel: nem olvasható PDF, nincs azonosított sor, vagy valamelyik sorból hiányzik az összeg, pénznem, határidő, számlaszám, időszak, számla típusa vagy keltezés. Szolgáltató/kategória hiánya önmagában nincs a feltételben. Teljesnek látszó, de téves kódos eredmény nem kap automatikus második AI-ellenőrzést; ez ismert korlát.

Az AI-ág dokumentumonként egy `generateText` / `Output.object` hívást végez, `maxRetries: 0`, 60 másodperces timeouttal és 8192 kimeneti tokenlimittel. Szöveges forrásnál számozott oldalszöveget küld. Ha bármelyik oldal 20 nem-whitespace karakternél rövidebb, a képi út az eredeti PDF-et küldi. PDF-bemeneti modellképesség és élő szkennelt próba még ellenőrizendő.

A Gateway-modell környezeti konfiguráció. A `google/gemini-2.5-flash` szintetikus szöveges strukturált próbája sikeres volt; ez nem igazolja az összes számlaformátumot. A szolgáltatónak küldött JSON-séma kihagyja a Gemini komplexitási korlátját okozó hossz-/elemszám-/számhatárokat, de a teljes Zod-séma lokálisan minden válaszra érvényes. Az AI mezőnként oldalt és idézetet ad. Szöveges idézetnek egyeznie kell a forrással és a mező értékével; képi eredmény ellenőrizetlen jelölést kap. Hiányzó keltezés az AI után is külön jelzés, átnézettnek nem jelölhető.

AI nem számol összeget, nem keres levelet, nem tölt le URL-t és nem követ dokumentumba írt utasítást. Nyers dokumentum, kulcs, token és szolgáltatói hibaüzenet nem naplózható. Az AI elsődlegessé tétele és PDF-küldésének díjbecslése felmerült, de nincs megvalósítva/lezárva.

## Összevezetés és összesítés

Számlaazonosság: normalizált szolgáltató + szolgáltatástípus + számlaszám; emellett dokumentumhash + dokumentumon belüli számlaindex. Azonos számla több forrása összevonható, külön számlák nem veszhetnek el. Számlaszám nélküli szolgáltató/időszak/összeg egyezés csak lehetséges duplikáció.

Kézi javítás nem írható felül csendben. Eltérő forrásérték konfliktus; törölt sor és új hónap védett a későn visszaérkező válaszoktól. Legfeljebb két párhuzamos dokumentumfeldolgozás fut. Jóváírás/helyesbítés/sztornó és az azonosított kapcsolódó eredeti konzervatívan kimarad az összegből; automatikus nettósítás nincs. Idegen pénznem, bizonytalan összeg, negatív normál számla és túlcsordulás nem válik kész összeggé.

## Architektúra és igazolt állapot

A közös sablonok a [külön mérnöki leírás](expense-presets.md) szerinti `expense_presets` táblában tartósak; minden jogosult családtag ugyanazt kezeli. Új kimutatás indításakor friss lekérésből készülnek az alapértelmezett másolatok. Az összegzés tételválasztója csak hozzáadáskor nyílik meg, automatikus sablonbetöltéssel. A sablonból másolt sor neve sima szöveg, az egyedié szerkeszthető; az összeg és a törlés mindkettőnél elérhető. A `presetId` kizárólag eredetjelző, nem élő kapcsolat. A „részleges, ellenőrzendő” összegzésfelirat és az ismétlődő magyarázatok nem jelennek meg; az adatellenőrzés és az import figyelmeztetései változatlanul működnek.

Feature-first szerkezet: route → DAL → Drizzle olvasás; Gmail/PDF/AI server-only `lib`, séma `zod/schema.ts`, típusok `types.ts`, tiszta logika `utils`, felület `components`. Gmail Server Action, PDF-import/előnézet valódi HTTP Route Handler, azonos session-/jogosultságvédelemmel. Előnézethez csak validált `application/pdf` Blob; a natív PDF-nézővel ütköző iframe- és CSP-sandbox eltávolítva, forrásvédelem megmaradt.

2026-10-07-én **54/54 teszt**, teljes lint és típusellenőrzés sikeres. Két villany- és egy vízszámla élő Gmail-importja, ismételt merge-je, összege és később a keltezése igazolt. Élő gáz/MOHU, szkennelt PDF, teljes bejelentkezett UI, mobil/billentyűzet és natív PDF-előnézet végső vizuális ellenőrzése nincs lezárva. Korábbi build sikeres, de nem a legutóbbi változások teljes production igazolása.

Kapcsolódó dokumentumok: [implementáció](../../implementation/active/invoice-import.md), [feature README](../../../README.md), [architektúra](../../../../../../.agents/architecture.md). Az aktuális szálátadás a projekt README-jéből érhető el.
