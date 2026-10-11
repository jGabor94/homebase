# Közművek fogyasztási és költségdiagramja

Kapcsolódó követelmények: [mérnöki leírás](../../engineering/active/utility-consumption-history.md).

## Végrehajtás

- [x] A jelenlegi számla- és kimutatásmodell feltérképezése; fizikai fogyasztást eddig nem tárolt.
- [x] A leíró dokumentumok módosítása az új nyitóoldal és fogyasztási adatmodell szerint.
- [x] Nullable mennyiség/egység, validáció, tárolási mapping, mezőeredet és összevonás.
- [x] Kézi szerkesztés és bizonyítékra épülő PDF/AI-beolvasás.
- [x] Havi aggregátumok és jogosultságvédett DAL olvasás.
- [x] Váltható diagram, részleges/hiányzó adat jelzése és szöveges megfelelő.
- [x] Route és kimutatáskezelés integrációja; helyi frissítés mentés/törlés után.
- [x] Célzott tesztek, típusellenőrzés és a nagyobb feature-bővítéshez build.

## Bevezetési feltétel

A forráskód mellett az `invoices` két új nullable oszlopának adatbázis-szinkronizálása szükséges. A védett migrációk és környezeti fájlok kézi módosítása nem része a feladatnak. Az alkalmazott ellenőrzések és az adatbázis-frissítés tényleges állapota a befejezési jelentésben rögzítendő.

## Ellenőrzési eredmények — 2026-10-11

- Teljes monthly-expenses tesztcsomag: **77/77 sikeres**.
- TypeScript típusellenőrzés sikeres; production build sikeres.
- Böngészőben a nyitóoldal, az üres állapot, nézetváltás, kézi számlafelvitel és tizedes/hibás fogyasztási érték kezelése ellenőrizve, konzolhiba nélkül. Nem került próbaszámla mentésre; élő számlaimport és feltöltött diagram több hónappal nem volt böngészőben ellenőrizve.
- A célzott adatbázisscript sikeresen hozzáadta a két nullable oszlopot és korlátaikat; meglévő adat megmaradt.
- Generált migrációs fájl és környezeti fájl nem változott.

## ALFÖLDVÍZ fogyasztáskiolvasás javítása — 2026-10-11

A két külön víz/szennyvíz összesítő és az oszlopos PDF-szövegsorrend miatt a fogyasztás üres maradt. A felismerő most az ivóvíz összesítőjét használja, a szennyvíz mennyiségét nem adja hozzá. Szintetikus tesztek védik a soros/oszlopos elrendezést, a bizonyíték oldalszámát, a többértelmű és csak szennyvizet tartalmazó adat elutasítását. A fogyasztás- és kiolvasástesztek **16/16 sikeresek**. Az érintett eredeti PDF-en a teljes alkalmazásparser **8 m³** értéket adott, a **3. oldal** címke–érték blokkjával és mezőhiba nélkül; a privát PDF nem került a repositoryba.

Commit előtt a teljes `npm run lint` és a `npx tsc --noEmit` ellenőrzés sikeres volt. A korábbi build és tesztfuttatások után ezek a végleges változáscsomagot is ellenőrizték.
