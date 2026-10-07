# Közös tételsablonok implementációja

## Megvalósítás

- [x] `expense_presets` Drizzle-tábla RLS-szel, név- és összegkorlátokkal, közös időbélyegekkel, valamint az `InsertExpensePreset` / `SelectExpensePreset` típusokkal.
- [x] DAL-lekérdezés és külön létrehozás, módosítás, törlés server action; mindegyik `monthlyExpenses.read` jogosultságot ellenőriz, a nyilvános válasz csak DTO-t vagy magyar hibaüzenetet tartalmaz.
- [x] Közös `/settings` oldal RHF/Zod űrlappal, rendezett sablonlistával és újratöltéssel.
- [x] Gear link a dashboardon és a havi kiadások oldalán. Az utóbbiról az új lapon nyíló beállítások nem dobják el a helyi kimutatást.
- [x] A havi oldali selector mentett vagy egyedi sort másol a kimutatásba saját UUID-val; a frissítés explicit, a létrehozás/módosítás/törlés nem írja át a már másolt sort.
- [x] Célzott tesztfájl a séma és a pillanatfelvétel-másolás ellenőrzésére.

## Ellenőrzés és aktiválás

2026-10-06-án az implementáció és az adatbázis-aktiválás elkészült:

- A csak `expense_presets` táblára szűrt Drizzle dry-run kizárólag `CREATE TABLE` és RLS-engedélyezést jelzett; a célzott push sikeresen alkalmazta.
- `expense-presets.test.ts` és `additional-items.test.ts`: **8/8 sikeres**.
- `npx tsc --noEmit` és célzott ESLint: sikeres.
- `npm run build`: sikeres. Az első próbát a sandbox Google Fonts-hálózati korlátja állította meg; engedélyezett hálózati hozzáféréssel sikerült.
- Élő adatbázispróba: létrehozás, olvasás, módosítás, törlés; üres név, negatív és túl nagy összeg elutasítása; RLS engedélyezett. A teljes próba visszagörgetett tranzakcióban futott, tesztadat nem maradt.

Az ideiglenes adatbázis-konfiguráció és próbafájl eltávolítva. Migrációs fájlok, `.env*`, commit, push és deploy nem módosult/történt. Bejelentkezett böngészős elfogadás nem futott; az élő SQL-próba a tárolást ellenőrzi, nem helyettesíti a teljes UI-munkafolyamat vizsgálatát.

A közös sablonok adatbázis-kapcsolat nélkül hibát jeleznek, nem mutatnak sikeres üres listát. Az egyedi havi tétel továbbra is használható; az aktuális kimutatás és az abból másolt tételek újratöltéskor elvesznek. Export nem készült.
