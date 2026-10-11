# Relációs számlatárolás

## Cél

A havi kimutatás számlái külön `invoices` táblában, típusos oszlopokban tárolódnak. Egy `monthly_expense_reports` sorhoz több számla tartozik `report_id` idegen kulccsal. A hozzáadott egyedi és sablonból másolt tételek a kimutatás `additional_items` JSONB oszlopában maradnak, az adott hónap másolataiként.

## Adatmodell

Minden számlasor primitív üzleti adata külön oszlop: azonosító, szolgáltató, kategória, számlaszám, egész fillérben számolt összeg, pénznem, határidő, fogyasztási időszak, keltezés, kiküldés, elszámolási hónap, dokumentumtípus, kapcsolódó számlaszám, ellenőrzési állapot. A határidő és keltezés PostgreSQL `date` mező, Drizzle-ben string móddal, mert nincs napszakuk. A `sent_at` az eredeti ISO érték megőrzése miatt szöveg marad, így az időzónaeltolás és az eredeti string sem változik. Az opcionális adatok nullable oszlopok. A források, mezőbizonyítékok, mezőeredet, szerkesztett mezők, problémák és ütközések saját JSONB oszlopot kapnak. Fájl vagy blob URL továbbra sem tárolódik.

A `position` oszlop megőrzi a számlák felületi sorrendjét. A sorazonosító egy kimutatáson belül egyedi, `(report_id, id)` összetett elsődleges kulccsal. A kimutatás törlése a hozzá tartozó számlákat is törli. RLS és a meglévő DAL jogosultságvédelem mindkét táblára érvényes. Drizzle-reláció deklarálja az egy-a-többhöz kapcsolatot.

## Mentés és olvasás

A felület és a Server Action bemenete változatlan: teljes szerkeszthető snapshot. Egy tranzakció ellenőrzi/frissíti a szülő verzióját, menti a hozzáadott tételeket, és lecseréli kizárólag az adott kimutatás számlasorait. Ütközés vagy számlahiba minden módosítást visszagörget. A visszatöltés rekonstruálja a korábbi snapshotot a szülőből és a rendezett számlasorokból. A lista ugyanazzal az összegzési helperrel számol, mint a felület.

A kimutatás törlése külön, hitelesített és `monthlyExpenses.read` jogosultsággal védett Server Action. A hónap és az ismert verzió együttes feltételével egyetlen DELETE törli a szülőt; a számlák FK cascade révén ugyanabban a műveletben törlődnek. A hozzáadott tételek a szülő JSONB oszlopával együtt megszűnnek, a közös sablonok nem változnak. Elavult verzió vagy már hiányzó szülő publikus ütközési hibát eredményez.

## Meglévő adatok átállítása

Az átállás sorrendje kötelező, mert a végső Drizzle séma már nem tartalmazza a régi `snapshot` oszlopot:

1. `npx drizzle-kit push --config=drizzle.invoice-normalization.config.ts` — csak az `invoices` tábla additív létrehozása.
2. `npx tsx src/features/monthly-expenses/scripts/migrate-normalized-invoices.ts` — tranzakcióban hozzáadja az `additional_items` mezőt, Zod-validálja és átemeli a régi snapshotokat, majd oda-vissza összehasonlít. Eltérésnél rollbackel; csak teljes egyezés után törli a régi `snapshot` mezőt. Újrafuttatható, meglévő normalizált számlákat nem ír felül.
3. `npx drizzle-kit push --config=drizzle.report-storage.config.ts` — a végső szülő- és számlatáblasémát szinkronizálja. Ezt csak sikeres adatátállítás után szabad futtatni.

A verziók, időbélyegek és sorazonosítók megmaradnak. A védett `src/drizzle/migrations` és `.env*` érintetlen marad; más feature tábláit egyik célzott konfiguráció sem érinti.
