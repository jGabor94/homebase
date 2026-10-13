# Havi kimutatások mentése

## Cél és elfogadási feltételek

A Mentés az aktuális havi kimutatás teljes szerkeszthető állapotát tartósan tárolja: minden számlasort, a kiolvasott és kézzel javított adatokat, valamint minden egyedi és sablonból másolt összegző tételt. PDF, blob URL és fájltartalom nem kerül adatbázisba. A források meglévő metaadatai megmaradhatnak; a feltöltött PDF újranyitás után nem érhető el.

A közműoldal listázza a mentett hónapokat, amelyeket meg lehet nyitni, szerkeszteni és újramenteni. Hónaponként egy közös családi kimutatás van, ugyanazzal a hozzáférési körrel, mint a közös tételsablonok. Új hónap létrehozása nem írhat felül csendben meglévő kimutatást.

A kezdőnézet egy közművenként váltható fogyasztási és költségdiagramot, alatta a kimutatások listáját mutatja, a legújabb hónapot finoman kiemelve. A lista tetején „Új kimutatás · [aktuális hónap]” gomb csak akkor látszik, ha a Budapest szerinti aktuális hónaphoz nincs mentett kimutatás és a lista betöltése sikeres. Új kimutatás kizárólag az aktuális hiányzó hónapra indítható. A redesign részletnézetében a hónapválasztó csak már mentett hónapok közötti navigációra szolgál. Új indítás vagy egy listázott hónap megnyitása a részletnézetre vált: ott jelennek meg a számlák és a jobb oldali összegzés. A „Kimutatások” gomb visszavisz a listára; nem mentett változtatások eldobása megerősítést kér. A mentési gomb felirata mindig „Mentés”, folyamatban lévő mentésnél is.

## Tárolás és adatfolyam

A feature RLS táblái a `monthly_expense_reports` és az `invoices`. A szülő azonosítót, egyedi elszámolási hónapot, verziót, `additional_items` JSONB mezőt és közös létrehozási/módosítási időbélyeget tartalmaz. A számlák külön típusos oszlopokban tárolódnak, `(report_id, id)` összetett kulccsal és szülő törlésekor érvényesülő cascade kapcsolattal. A `position` megőrzi a felületi sorrendet; források, bizonyítékok, mezőeredet, kézzel szerkesztett mezők, hibajelzések és ütközések JSONB oszlopban maradnak. Nincs fájltartalom vagy blob URL. A relációt a központi Drizzle relations modul deklarálja.

Olvasás: route → hitelesített/jogosultságellenőrzött DAL query → Drizzle operation. A kimutatás és rendezett számlasorai egy joined queryben olvasódnak, így nem keveredhetnek különböző tranzakciók verziói. A megnyitás védett Server Actionön át a queryből rekonstruálja a változatlan kliens snapshot formátumot. Mentés: kliens → DAL Server Action → tranzakciós szülő insert vagy feltételes verziófrissítés, az adott szülő számlasorainak cseréje és az `additional_items` írása. A kliens adatait szerveroldali Zod validáció ellenőrzi; hónapok és sorazonosítók legyenek konzisztensen validálva. Hiba vagy verzióütközés az egész tranzakciót visszagörgeti. Az eredmény csak publikus, biztonságos hibát tartalmazhat.

## Invariánsok és hibák

- A lista minden sorához külön törlésgomb tartozik, a megnyitástól elkülönítve. A felhasználó megerősíti a vissza nem vonható törlést. A védett Server Action a hónap és a listában megismert verzió alapján töröl; elavult verziónál hibát jelez. A kaszkádoló idegen kulcs ugyanabban az adatbázis-műveletben törli a kapcsolódó számlasorokat. A JSONB hozzáadott tételek a szülővel együtt törlődnek, a közös tételsablonok megmaradnak. Siker után a lista frissül; az aktuális hónap törlése újra elérhetővé teszi az indítógombot. Hiba esetén a helyi lista megmarad.

- Meglévő hónap módosítása az előző verzió alapján történik. Párhuzamos szerkesztésnél a régi verzió mentése hibát jelez, a helyi állapot megmarad.
- Az első mentés hónapütközése hibát ad; az adatbázis egyedi kulcsa védi.
- Hiányos, de a meglévő számlaséma szerint érvényes számlaadatok menthetők. Érvénytelen egyedi tétel nem menthető.
- Mentés/import/betöltés alatt nem indulhat egymásra csúszó mentés vagy kimutatásváltás. Sikertelen művelet nem törli a helyi adatokat.
- Új hónapban alapértelmezettek egyszer kerülnek be. Mentett kimutatás betöltése nem ad hozzá aktuális sablonokat.
- Nem mentett módosítás eldobásához a meglévő megerősítési párbeszéd szükséges.
- Sikeres mentés után a lista frissül; újratöltés után is látható.

## Migráció

A védett migrációs könyvtár érintetlen marad. Az átállás sorrendje kötelező: előbb `npx drizzle-kit push --config=drizzle.invoice-normalization.config.ts` hozza létre az `invoices` táblát; ezután a `npx tsx src/features/monthly-expenses/scripts/migrate-normalized-invoices.ts` tranzakció hozzáadja az `additional_items` oszlopot, validálja és visszaellenőrzi a régi snapshotokat, majd csak egyezés után törli a `snapshot` oszlopot; végül `npx drizzle-kit push --config=drizzle.report-storage.config.ts` szinkronizálja a végleges sémát. A végső push nem futhat a backfill előtt, mert a Drizzle-séma már nem tartalmazza a régi oszlopot. A verziók, időbélyegek, sorazonosítók és sorrend megmaradnak. `.env*` fájl nem módosul és titok nem kerül naplóba. Fájltároló integráció nincs ebben a feladatban.
