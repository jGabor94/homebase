# Alapértelmezett közös tételsablonok

Frissítve: **2026-10-06**. Az alapértelmezett jelölés és az új kimutatás indításakor végzett snapshotolás elkészült; az adatbázisoszlop létrehozását külön, célzott Drizzle push-sal a szülő munkaszál ellenőrizte.

## Viselkedés

- A Beállítások űrlapján az `isDefault` jelölő közös sablononként állítható; az adatbázis alapértéke `false`.
- Az új kimutatás gomb frissen betölti a közös sablonokat. Betöltési hiba esetén a kimutatás nem indul el, és a gombbal újra próbálható.
- Az alapértelmezett sablonokból külön azonosítójú `additionalItems` sorok készülnek. A sorok megőrzik a hozzáadáskori nevet, összeget és jelölőt; a frissítés, szerkesztés vagy sablontörlés nem írja át a már megnyitott kimutatást.
- A hónapváltás megerősített resetje törli a helyi sorokat; az új indítás az aktuális alapértelmezett sablonokat másolja be. Gmail- és PDF-import csak számlasorokat merge-el.
- Nincs előre rögzített hitelösszeg. A teljesítés számlák és tételek alapján számol, a fillérpontos felezés változatlan.

## Érintett részek és ellenőrzés

A 2026-10-07-i felületi finomítások után a sablonból másolt sor neve sima szöveg (`presetId` eredetjelző), az egyedi név szerkeszthető. A tételválasztó megnyitáskor automatikusan frissül, külön frissítésgomb nélkül. A „Fele” kijelzés egész forintra kerekít; a belső számítás továbbra is fillérpontos. A teljes havi tesztcsomag 54/54 sikeres, a teljes lint és típusellenőrzés sikeres.

Adatbázisséma és DTO: `drizzle/schema.ts`, `types.ts`, `zod/schema.ts`, preset DAL/query. Felület: `PresetSettingsForm.tsx`, `MonthlyExpensesForm.tsx`, `AdditionalExpenseRow.tsx`. Snapshot-segéd és tesztek: `utils/expense-presets.ts`, `tests/expense-presets.test.ts`.

Ellenőrzés: 9/9 célzott teszt sikeres (`expense-presets`, `additional-items`), `tsc --noEmit` és az érintett fájlok lintje sikeres. A célzott Drizzle push kizárólag az `is_default boolean DEFAULT false NOT NULL` oszlopot adta hozzá. Valódi adatbázis-próba igazolta a kikapcsolt alapértéket, a bekapcsolás mentését és visszaolvasását, valamint a kikapcsolást; a szintetikus változások visszagörgetve. Export, havi kimutatás tartós mentése és böngészős ellenőrzés nem része ennek a módosításnak.
