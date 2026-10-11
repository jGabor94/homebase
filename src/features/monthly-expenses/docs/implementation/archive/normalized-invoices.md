# Relációs számlatárolás — implementáció

Specifikáció: [normalized-invoices.md](../../engineering/active/normalized-invoices.md).

- [x] Meglévő mentés és adatbázis feltérképezése; a korábbi feladatbranch folytatása.
- [x] Mérnöki és implementációs terv elkészítése kódmódosítás előtt.
- [x] Számlatábla, típusok, reláció és oda-vissza mapping.
- [x] Tranzakciós mentés és normalizált olvasás.
- [x] Veszteségmentes, újrafuttatható séma-/adatátállítás.
- [x] Aktuális dokumentáció frissítése.
- [x] Célzott tesztek, típusellenőrzés, lint és build.
- [x] Élő adatbázisos rollback-próba, review és archiválás.

## Eredmény — 2026-10-10

Az `invoices` RLS-táblában külön típusos oszlop tárol minden primitív üzleti számlaadatot. A határidő és keltezés PostgreSQL `date`, az összeg `bigint`, a kiküldés pontos ISO szövege `text`. A technikai metaadatok saját JSONB-oszlopokban maradnak. `(report_id, id)` elsődleges kulcs, egyedi `(report_id, position)` sorrend és kaszkádoló idegen kulcs védi a kapcsolatot. A központi `src/drizzle/relations.ts` deklarálja a kapcsolatot.

A parent `additional_items` JSONB-jében maradnak az összegzés másolt és egyedi tételei. A DAL mentés egyetlen tranzakcióban ellenőrzi a verziót, frissíti a szülőt és lecseréli annak számlasorait. Az olvasás egyetlen bal join lekérdezéssel konzisztens állapotot kap, és változatlan snapshot alakot állít elő a felületnek. A mapping helper: `utils/invoice-storage.ts`.

## Telepítés és adatátállítás

1. `npx drizzle-kit push --config=drizzle.invoice-normalization.config.ts`: kizárólag az új számlatábla additív létrehozása.
2. `npx tsx src/features/monthly-expenses/scripts/migrate-normalized-invoices.ts`: a szülőt zároló tranzakció létrehozza az `additional_items` oszlopot, validálja és átemeli a régi adatokat, visszaolvassa és összehasonlítja őket, majd törli a `snapshot` oszlopot. Megőrzi a szülő időbélyegeit/verzióját. Az ismeretlen vagy validációkor megváltozó adat rollbacket eredményez, nem vész el.
3. `npx drizzle-kit push --config=drizzle.report-storage.config.ts`: csak a sikeres átállítás után, végső sémaegyezőség ellenőrzése.

Mindhárom lépés lefutott; a végső push eredménye **No changes detected**. Az átállítás pillanatában **0 mentett kimutatás** volt, így nem kellett meglévő számlát átemelni. Az átállító második futása `alreadyApplied: true` eredményt adott, adatváltoztatás nélkül. A védett migrációk és `.env*` változatlanok.

## Ellenőrzés

- Célzott snapshot/mapping/validációs tesztek: **4/4 sikeres**.
- `npx tsc --noEmit`: sikeres.
- Érintett feature-fájlok, script és konfigurációk ESLintje: sikeres.
- `npm run build`: sikeres production fordítás, típusellenőrzés és oldal-generálás.
- Élő adatbázisos, visszagörgetett tranzakció: mindkét táblán RLS; negatív összeg, dátumok és kiküldési idő pontos visszaolvasása; hibás számlasor után a parent és child módosítások rollbackje; kimutatások elkülönítése; kaszkádoló törlés. Tesztadat nem maradt bent.
- Végső diff logikailag ellenőrizve. Bejelentkezett böngészős teljes folyamatpróba nem futott.
