# Közös havi tételsablonok

## Cél és hozzáférés

A Havi kiadásokhoz tartozó átalányok és más előre ismert költségek közös sablonként menthetők. A lista az alkalmazás egyetlen családi háztartásához tartozik, a funkciót olvasó minden felhasználó számára azonos, eszközök és munkamenetek között. Minden olvasást és módosítást a `monthlyExpenses.read` jogosultság véd a szerveroldali DAL-ban.

Az `expense_presets` táblán engedélyezett RLS-hez nincs nyilvános, mindenkit engedő policy. Az alkalmazás DB-szerepének a táblatulajdonosnak vagy RLS-megkerülési jogosultságú szerepnek kell lennie; az alkalmazás hozzáférési határa a hitelesítést és jogosultságot végző DAL.

## Adat és működés

Egy sablon mezői: szerver által generált UUID, 1–120 karakteres név, egész fillérben megadott 0–9 000 000 000 000 közötti összeg, alapértelmezett jelölő és közös létrehozási/módosítási időbélyeg. Az alapértelmezett jelölő adatbázis-alapértéke hamis. Az adatbázis ellenőrzi a név és összeg határait. A létrehozás tranzakciós advisory lockkal ellenőrzi a 100 sablonos korlátot; a lista név, majd azonosító szerint rendezett.

A Beállítások oldalon a felhasználó megjelölheti a jövőbeli kimutatásokban alapértelmezett sablonokat. Az új kimutatás indítása frissen lekéri a közös listát, majd minden megjelölt sablonból új UUID-val és `isDefault: true` jelölővel pillanatfelvételt készít. Sikertelen lekérésnél nem indul el a kimutatás, így az alapértelmezettek nem maradnak ki csendben.

Az aktív kimutatásban a „Tétel hozzáadása” megnyitja a választót. A kiválasztott sablonból a „Hozzáadás” pillanatfelvételt ad a helyi `additionalItems` listához; az egyedi opció üres szerkeszthető sort hoz létre. A sorok értéke, alapértelmezett jelölése és megjelenítése nem követi a későbbi sablonmódosítást, törlést vagy frissítést. Az import továbbra is csak a számlasorokat módosítja. Számla beérkezésekor a felhasználó törli az előre felvett sort.

A tételválasztó csak a „Tétel hozzáadása” gombbal nyílik meg, ekkor automatikusan frissül a mentett lista. A tételek egy sorban jelennek meg névvel, szerkeszthető összeggel és törlésgombbal. A sablonból hozzáadott sor megőrzi a forrás `presetId` azonosítóját, és neve sima szöveg; csak az egyedi tételek neve szerkeszthető helyben. Az azonosító nem hoz létre élő kapcsolatot a sablonhoz: a sor továbbra is pillanatfelvétel. A sablonlekérés hibája nem üres listaként jelenik meg: rövid hibaüzenet látszik, az egyedi tétel felvétele továbbra is használható. A kimutatások automatikus mentése és exportja nincs ebben a funkcióban.

## Telepítési állapot

A `expense_presets` tábla 2026-10-06-án létrejött az alkalmazás meglévő adatbázisában, csak erre a táblára korlátozott Drizzle push-sal. Az `is_default boolean DEFAULT false NOT NULL` oszlop ugyanilyen célzott push-sal bekerült; a meglévő sablonok jelölése kikapcsolt maradt. A meglévő migrációs könyvtár és az `.env*` fájlok nem módosultak. Más adatbázisra telepítéskor a teljes sémát ott is létre kell hozni.
