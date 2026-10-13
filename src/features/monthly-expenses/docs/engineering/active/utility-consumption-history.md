# Közművek fogyasztási és költségdiagramja

## Nyitóoldal

A `/app/monthly-expenses` Közművek oldal elsődleges kezdőnézete egyetlen közös diagram. Víz, gáz, villany, hulladék és egyéb számla között lehet váltani, külön kapcsoló választja a **Fogyasztás** vagy **Költség** nézetet. A diagram alatt megmarad a mentett kimutatások listája és az aktuális hónap indítása. Megnyitáskor a meglévő részletnézetben szerkeszthetők a számlák; visszalépéskor ismét a diagram és a lista látszik.

A redesign diagramja alapból 6, választhatóan 12 naptári hónapot mutat időrendben a Budapest szerinti aktuális hónapig, kizárólag valódi mentett adatokból. A hónap az elszámolási hónap, nem a számlán szereplő fogyasztási időszak. Az egyedi tételek és a sablonmásolatok nem közműszámlák, ezért nem kerülnek bele. Mentés és törlés után a helyi diagram azonnal követi a mentett állapotot; nem mentett módosítás nem változtatja meg.

## Fogyasztási adatok

A számlasor opcionális `consumptionQuantity` és `consumptionUnit` mezővel bővül. A mennyiség nem negatív, véges szám, a mértékegység `m3`, `kWh`, `MJ`, `kg`, `l` vagy `piece`. A felület magyar feliratot használ (m³, kWh, MJ, kg, l, db). A két mező kézzel megadható és javítható; az eredet, bizonyíték és konfliktuskezelés követi a többi szerkeszthető mező mintáját. A hiányzó adat null, a kifejezetten megadott nulla valódi nulla.

A kódos és AI-beolvasás csak egyértelműen megjelölt fogyasztási mennyiséget és egységet vesz át forrásbizonyítékkal. Óraállás, egységár, becsült költségből visszaszámolt mennyiség vagy többértelmű számlarész nem helyettesítheti a fogyasztást. A fogyasztás hiánya önmagában nem teszi menthetetlenné a számlát. A korábbi számlák továbbra is betölthetők; a hiányzó új mezők null értéket kapnak. Régi PDF-ek tartalma nincs mentve, így visszamenőleges automatikus kitöltés nincs.

ALFÖLDVÍZ esetén az „Elszámolt mennyiség: Ivóvíz” összesítő adata a vízfogyasztás. A PDF szövege a két címkét az ivóvíz és szennyvíz értékei elé is rendezheti; ezt a felismerő külön kezeli, és a teljes címke–érték blokkot megőrzi bizonyítékként. A szennyvíz, vízterhelési díj és alapdíj mennyisége nem adódik hozzá ismét. Az érték a számlán elszámolt mennyiség: részszámlán lehet szolgáltató által kalkulált, nem feltétlenül mért havi fogyasztás.

## Összesítés és hozzáférés

A költség Ft-ban, a meglévő számlaösszesítés beszámítási szabályaival jelenik meg. A fogyasztás az érvényes normál számlák ismert mennyiségeiből áll össze, a költség és pénznem hiányától függetlenül. Bizonytalan duplikáció, feloldatlan helyesbítés, konfliktus és ellenőrizetlen forrás nem eredményezhet hamis fogyasztási összeget. A hiányzó vagy kizárt adatok jelzést kapnak; adat nélkül nincs nullát színlelő oszlop.

Eltérő mértékegységeket nem adunk össze és nem váltunk át. Ha ugyanazon közműhöz több egység tartozik, az egység külön választható. A gáz m³ és MJ értéke például külön adatsor.

Olvasás: Server Component → hitelesített, `monthlyExpenses.read` jogosultságú DAL → Drizzle operation → havi aggregátumok. A kliens nem kap számlaforrásokat vagy OAuth-adatokat a diagramhoz. A váltók helyi UI-állapotot kezelnek; nincs új API route vagy diagramkönyvtár. A diagram billentyűzettel használható vezérlést és szöveges adattáblát biztosít.

## Adatbázis és bevezetés

Az `invoices` tábla két nullable oszloppal bővül: `consumption_quantity` és `consumption_unit`. A tárolási mapping mindkét irányban megőrzi őket. A Drizzle-séma bővítése után az adatbázis célzott szinkronizálása szükséges az alkalmazás új verziójának használata előtt. A generált migrációs könyvtár és az `.env*` fájlok nem szerkeszthetők kézzel; az alkalmazás kódjának módosítása önmagában nem frissíti az élő adatbázist.

A célzott, újrafuttatható frissítés: `npx tsx src/features/monthly-expenses/scripts/add-consumption-columns.ts`. Egy tranzakcióban csak a két nullable oszlopot és a mennyiség/egység ellenőrző korlátait adja hozzá; meglévő számlasorokat nem töröl és nem tölt ki becsült értékkel. Meglévő, eltérő típusú oszlopnál rollbackel.

## Elfogadási feltételek

- Egy diagram, közműváltó és fogyasztás/költség kapcsoló; valós mentett hónapok.
- Menthető, visszatölthető és kézzel javítható fogyasztási mennyiség és egység.
- Bizonyítékra épülő import; hiányzó és többértelmű fogyasztás nem becsült érték.
- Egységek elkülönítése, részleges adatok és üres/hibás betöltés jelzése.
- A korábbi kimutatásszerkesztés, mentés, törlés és export működése megmarad.

## Redesign, 2026-10-12

A közmű- és metrikaváltó, időablak, KPI és diagram közös helyi kiválasztásból működik. A KPI-panel és az SVG diagram desktopon két oszlop, mobilon egymás alatt. A backend csak az aktuális 12 naptári hónap számláit olvassa ehhez. Hiányzó hónap nem nulla; az átlag ismert hónapokra vonatkozik, a lefedettség és kizárt tételek jelzettek. A kategóriaáttekintés külön a lekért 12 hónap ismert költségeit összegzi, ezt a felirata jelöli.
