# Kimutatáslista és törlés — implementáció

Elkészült: **2026-10-11**. Specifikáció: [monthly-report-storage.md](../../engineering/active/monthly-report-storage.md).

- [x] Kezdőnézetként a kimutatások listája jelenik meg, a legújabb hónap visszafogott kiemelésével.
- [x] Egyetlen aktuális havi indítógomb, kizárólag sikeres listabetöltés és hiányzó havi mentés esetén. Nincs hónapválasztó vagy nagy indítókártya.
- [x] Indítás és megnyitás után részletnézet: számlák és jobb oldali összegzés. Visszatérés a listára nem mentett módosítás esetén megerősítést kér.
- [x] A mentési gomb felirata mindig „Mentés”; a folyamatot spinner jelzi.
- [x] Külön, akadálymentesen feliratozott törlésgomb minden listasorhoz, visszavonhatatlan törlés megerősítésével.
- [x] Zod-validált, hitelesített és jogosultságvédett törlési Server Action. Feltételes DELETE hónap és ismert verzió alapján; a számlasorok cascade révén törlődnek, a közös sablonok megmaradnak.
- [x] Pending védelem és biztonságos hibaüzenetek. Sikertelen törlés megtartja a helyi listát; siker után a lista frissül és az aktuális havi indítás újra elérhető.
- [x] Aktuális README-k és engineering leírások frissítése.

Érintett fájlok: `components/MonthlyExpensesForm.tsx`, `dal/mutations.ts`, `zod/schema.ts`, `types.ts`, `src/app/app/monthly-expenses/page.tsx`. Nem kellett további adatbázis-sémafrissítés; a meglévő kaszkádoló kapcsolatot használjuk.

## Ellenőrzés

A kisebb UI-változások után logikai kódellenőrzés történt. A felhasználó commit és merge kérése miatt 2026-10-11-én kötelező commit előtti `npm run lint` és `npx tsc --noEmit` futott: mindkettő sikeres. A normalizált tárolás korábbi production buildje és adatbázisos rollback-próbája sikeres volt; a jelen UI- és törlési kiegészítések után új build vagy bejelentkezett böngészős folyamatpróba nem futott.
