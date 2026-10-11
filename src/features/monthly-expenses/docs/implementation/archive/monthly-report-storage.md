# Havi kimutatások mentése — implementáció

Mérnöki specifikáció: [monthly-report-storage.md](../../engineering/active/monthly-report-storage.md).

Állapot: elkészült, 2026-10-10. Branch: `codex/monthly-report-storage`.

Ez a dokumentum az első, JSONB-pillanatképet tároló megvalósítás történeti eredménye. A számlák tárolását azóta a [normalizált számlatárolás](normalized-invoices.md) váltotta fel; a lista–részletek nézet és a kimutatástörlés aktuális szabályait a [mentési mérnöki dokumentum](../../engineering/active/monthly-report-storage.md) írja le.

## Végrehajtás

- [x] Meglévő form, DAL, jogosultságok és adatbázis-konvenciók feltérképezése; külön feladatbranch létrehozása.
- [x] Mérnöki és implementációs dokumentáció elkészítése a kódmódosítások előtt.
- [x] RLS feature tábla, Insert/Select típusok és szerveroldali snapshot-validáció.
- [x] Védett lista és betöltés query; atomikus, verzióellenőrzött mentési Server Action.
- [x] Mentés gomb, pending/hibakezelés, mentett kimutatások listája és visszatöltés.
- [x] README és az érintett aktuális mérnöki dokumentáció aktualizálása.
- [x] Célzott Drizzle push a konfigurált adatbázison; a védett migrációs könyvtár változatlan.
- [x] Célzott tesztek, típusellenőrzés, lint, production build és végső review.
- [x] Befejezett implementációs terv archiválása.

## Érintett fájlok és döntések

- `drizzle/schema.ts`, `types.ts`, `zod/schema.ts`: `monthly_expense_reports`, egyedi hónap, verzió, teljes JSONB pillanatkép. Hónapkonzisztencia, 2000–2100 közötti év, egyedi sorazonosítók és verzióhatár ellenőrzése.
- `drizzle/operations.ts`, `dal/queries.ts`, `dal/mutations.ts`: lista és betöltés, `monthlyExpenses.read` védelem, hónapütközést kezelő insert és verziófeltételes update. Biztonságos publikus hibaüzenetek.
- `components/MonthlyExpensesForm.tsx`, `src/app/app/monthly-expenses/page.tsx`: kezdeti lista szerveroldalon, explicit visszatöltés, kézi mentés és újramentés. Betöltés/mentés idején a szerkesztés letiltott; nem mentett módosítás eldobása megerősítést kér. Betöltéskor aktuális sablonok nem kerülnek hozzáadásra.
- `tests/monthly-report-storage.test.ts`: teljes számla-, egyedi és sablontétel-pillanatkép JSON roundtripje, ismétlődő azonosítók és eltérő számla-/forráshónap elutasítása.
- Gyökér `drizzle.report-storage.config.ts`: újratelepítéshez használható, csak az új táblára szűrt konfiguráció.

## Adatbázis-frissítés

`npx drizzle-kit push --config=drizzle.report-storage.config.ts` sikeres. A Drizzle által kiírt SQL kizárólag az új táblát, egyedi hónapkulcsot, ellenőrző korlátokat és RLS-engedélyezést tartalmazta. Más tábla nem módosult. Az `.env*` és a generált migrációs könyvtár változatlan maradt. Új adatbázisra ugyanezzel a célzott konfigurációval telepíthető.

## Ellenőrzési eredmények

- Célzott tárolási tesztek: **3/3 sikeres**. Teljes havi kiadások tesztcsomag: **68/68 sikeres**.
- `npx tsc --noEmit`: sikeres. Érintett fájlok ESLint ellenőrzése: sikeres.
- `npm run build`: sikeres production fordítás, TypeScript és oldal-generálás. A Windows sandbox fájlhozzáférési hibája után a build szélesebb fájlhozzáféréssel futott; a célzott Drizzle-konfiguráció típusát a meglévő projektmintához igazítottuk.
- Élő adatbázisos, visszagörgetett tranzakció: RLS aktív; számla + egyedi tétel + sablonmásolat pontos visszaolvasása; elavult verzió frissítése és ismételt hónap insertje nem módosít adatot. A próba nem hagyott tesztadatot.
- `git diff --check`: sikeres.

## Korlátok

Bejelentkezett böngészős teljes folyamatpróba nem futott. Automatikus mentés nincs. Fájltartalom és blob URL nem kerül adatbázisba, ezért a feltöltött PDF előnézete visszatöltés után nem érhető el. A Gmail-forrás metaadatai megmaradnak. A lista csak sikeres mentés után, illetve az oldal újbóli megnyitásakor frissül; nincs háttérben folyamatos szinkronizálás.
