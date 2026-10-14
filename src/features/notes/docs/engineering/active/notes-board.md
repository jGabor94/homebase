# Jegyzetek üzenőfala

Állapot: implementált, a konfigurált `development` adatbázison bevezetve; szerveroldali tárolási és hozzáférési próbák sikeresek, teljes böngészős elfogadás még nyitott. Dátum: 2026-10-12.
Hatókör: a `notes` feature első változata, egy család számára.
Végrehajtás: [implementációs terv](../../implementation/active/notes-board.md). Áttekintés: [README](../../../README.md).

## Cél

Gyorsan írható és visszaolvasható szöveges jegyzetek egy otthonos, pasztell kártyákból álló üzenőfalon. Ugyanazon a felületen jelenjenek meg a felhasználó saját privát jegyzetei és a család közös olvasásra megosztott jegyzetei.

## Jegyzet életciklusa

1. Az **Új jegyzet** megnyitja az üres szerkesztőt, privát láthatósággal.
2. A felhasználó opcionális címet és szöveget ír, alapvető formázást alkalmazhat, majd láthatóságot választ.
3. A **Mentés** tartósan tárolja a jegyzetet. Csak sikeres szerverválasz után kerül új cetli az üzenőfalra.
4. A cetli megnyitása a teljes tartalmat mutatja. Saját jegyzetnél szerkesztés és törlés is elérhető, más megosztott jegyzeténél csak olvasás.
5. A módosítás és a láthatóságváltás egyetlen mentéssel történik. Törlés előtt a rendszer megerősítést kér; az első változat véglegesen töröl, nincs lomtár.

Nincs automatikus mentés. A szerkesztő elhagyásakor a nem mentett változtatások elvesztését meg kell erősíteni. Sikertelen mentés után a bevitt szöveg és láthatóságválasztás megmarad, a szerkesztő nyitva marad. Mentés alatt a mentésgomb ismételt használata tiltott.

## Láthatóság és jogosultság

Tárolt értékek: `private` és `family`; magyar feliratok: **Privát**, illetve **Családdal megosztott**. Nyilvános webes hozzáférés vagy megosztható publikus link nem készül.

| Művelet | Tulajdonos, aktív családtag | Más aktív családtag | Vendég vagy nem családtag |
| --- | --- | --- | --- |
| Saját jegyzet létrehozása | Engedélyezett | Saját jegyzetet létrehozhat | Tiltott |
| Privát jegyzet olvasása | Engedélyezett | Tiltott | Tiltott |
| Megosztott jegyzet olvasása | Engedélyezett | Engedélyezett | Tiltott |
| Szerkesztés, törlés, láthatóságváltás | Engedélyezett | Tiltott | Tiltott |

A családi jegyzethozzáférést a meglévő authorization feature-ben bevezetett, tartós `notesMember` szerepkör jelöli. Ezt kizárólag ellenőrzött családtag kapja meg, explicit adminisztratív hozzárendeléssel; nem jár automatikusan a Google-regisztrációval, a `user` vagy az `admin` szerepkörrel. A helyi `scripts/manage-membership.ts` eszköz előnézettel, majd külön `--apply` argumentummal kezeli a kiosztást és visszavonást meglévő felhasználóknál; használatát a feature README írja le. Tagságkezelő UI és többcsaládos rendszer nem része az első változatnak. A felhasználó által megadott két cím közül az egyetlen már létező fiók hozzáférése kiosztva, korábbi szerepköre megőrizve; a másik fiók első belépése még szükséges.

Minden DAL-olvasás és mutáció friss adatbázis-állapot alapján ellenőrizze az aktív hozzáférést, hogy a régi JWT ne tartsa életben a visszavont tagságot. A jegyzet tulajdonosát a szerver a hitelesített felhasználóból határozza meg; kliensből érkező `ownerId` nem fogadható el. Az admin szerepkör nem ad betekintést más privát jegyzetébe.

Az üzenőfal lekérdezési feltétele aktív családtag esetén: saját jegyzet **vagy** `family` láthatóságú jegyzet. Ugyanez a szabály érvényes egy konkrét jegyzet lekérésére. A mutáció SQL-feltételében szerepeljen a jegyzetazonosító és a tulajdonosazonosító is; a gomb elrejtése nem jogosultságvédelem. Nem létező és nem olvasható jegyzetre azonos, általános „A jegyzet nem érhető el.” válasz jár.

Családi jegyzet privátra állítása után új lekérés már nem adhatja vissza másoknak. A korábban megnyitott tartalom más felhasználó böngészőjéből nem vonható vissza azonnal; valós idejű szinkron nincs. Visszavont családtagság esetén a tulajdonos sem fér hozzá a jegyzeteihez, amíg a hozzáférése nincs helyreállítva; a tagság visszavonása nem törli az adatot.

## Szöveg és formázás

A tartalom kliensoldali vizuális szerkesztőben készül, de továbbra is Markdown-szövegként tárolódik. A szerkesztő a régi Markdownból indul, és betöltéskor nem írja vissza vagy jelöli módosítottnak az értéket. Felhasználói szerkesztéskor a Tiptap Markdown-kimenete kerül a meglévő `content` mezőbe.

- Támogatott: sima szöveg, bekezdés és sortörés, félkövér, dőlt, áthúzott, 2./3. címsor, idézet, sorkód, kódblokk, többszintű felsorolás és számozott lista, visszavonás/újra.
- Formázógombok a kijelölésre vagy az aktuális kurzorpozícióra hatnak, a kijelölés és aktív formázás a szerkesztés során megmarad. A vezérlők billentyűzettel és feliratozással használhatók.
- A smiley-gomb 24 Unicode-emojit kínál, a kiválasztott jelet a kurzor helyére szúrja. A karakteres smiley-k (például `:D`, `:)`, `;)`, `:(`, `:P`, `<3`) szóhatáron gépelve emojivá alakulnak. A form-, létrehozási és módosítási séma mentéskor a beillesztett smiley-kat is normalizálja; az olvasónézet a régi jegyzetekben is megjeleníti őket. Kódrészletek és linkcímek megőrzik az eredeti karaktereket.
- A szerkesztő fókuszkerete belül, a tartalom fölötti pszeudoelemen rajzolódik, így a gyermekelemek háttere nem takarja el, és a görgethető konténer sem vágja le. A villogó szövegkurzor globális megjelenítési szabályát az alkalmazásszintű dokumentáció írja le.
- A mentett Markdown biztonságos `react-markdown` renderelőn fut át. Nyers HTML és képek eldobva, HTML-bővítmény nincs; engedélyezett HTML-elemek szűk listája engedi a támogatott szövegstruktúrákat és linkeket. A linkek URL-sémája http/https/mailto vagy relatív cím lehet.
- Opcionális cím legfeljebb 120 karakter, a Markdown-jelölésekkel együtt számolt tartalom legfeljebb 5000 karakter. A csak whitespace-et, üres formázást, címsor/idézet/lista jelölést, HTML-t vagy képet tartalmazó jegyzet érvénytelen. Sorkód és kódblokk belsejének karakterei látható szövegnek számítanak.
- Cím nélkül a kártya címe **Cím nélküli jegyzet**; ez megjelenítési fallback, nem a tárolt szöveg része.

A szervervalidáció a Marked tokenizálásával ugyanazt a látható szöveget ellenőrzi, amit a biztonságos olvasónézet megjelenít; kompakt cetli-előnézetben CSS-soros csonkolás őrzi meg a formázást.

## Üzenőfal és papírcetli megjelenés

Kanonikus útvonal: `/app/notes`, a meglévő app shellben. Az oldal címe **Jegyzetek**, rövid kísérőszövege **A saját és közös cetlijeink.** Felül **Új jegyzet**, alatta a cetlikből álló reszponzív rács. Alapértelmezett sorrend: `updatedAt` csökkenő, azonos időpontnál `id` szerinti stabil rendezés. Mentés után a módosított cetli előre kerül.

A felület a [.agents/DESIGN.md](../../../../../../.agents/DESIGN.md) új világos/petrol témáját használja; a redesign megjelenési követelményei felülírják az alábbi korábbi papírcetli-részleteket. A cetlik `note-yellow`, `note-peach`, `note-sage` tokeneket kapnak, stabilan a jegyzetazonosítóhoz rendelve. A szín dekoráció, nem láthatóságjelölő, és az első változatban nem felhasználói beállítás. A pasztell kártyák finom kerettel és árnyékkal jelennek meg; nincs ragasztószalag, raster kártyaháttér vagy elforgatás.

A cetlin cím, formázott rövid előnézet, szerző megjelenített neve, módosítási idő és szöveges láthatóságjelölés látszik. A dátum magyar formátumban, Europe/Budapest időzónában jelenik meg. A teljes szöveg megnyitással olvasható; hosszú szavak törjenek, a kártya ne növessze túl a képernyőt. Mobilon egy, nagyobb képernyőn két-három oszlop; a DOM- és olvasási sorrend kövesse a rendezést.

A **Privát** és **Családdal megosztott** állapot szöveggel és ikonnal is szerepel. A dekoráció rejtett a képernyőolvasó előtt. A megnyitás, a formázás és minden művelet billentyűzettel elérhető, látható fókusszal. A szerkesztő és a törlési megerősítés kezelje a fókuszt; ne legyen egymásba ágyazott gomb vagy kattintható vezérlő a cetlin. A meglévő shadcn primitívek és Lucide ikonok használhatók, a papírcetli a notes feature saját komponense.

Állapotok: betöltéskor egyszerű cetli-vázak; üres falon rövid útmutató és létrehozásgomb; sikertelen lekéréskor hibajelzés és újrapróbálás, nem üres fal. A megnyitás és mentés hibáit a saját felületük jelzi. Más által közben törölt vagy privátra állított jegyzet nem megnyitható.

## Adatmodell

A jegyzet saját feature-sémában van, a gyökér sémagyűjtő onnan exportálja. A tábla `pgTable.withRLS` definícióval, a megosztott időbélyegekkel és Insert/Select típusokkal készült. Az RLS engedélyezése nem helyettesíti a DAL-védelmet: a szerver adatbázis-szerepkörének jogosultságait a bevezetéskor is ellenőrizni kell; kliens nem kap közvetlen adatbázis-hozzáférést.

| Mező | Szerep és invariáns |
| --- | --- |
| `id` | Szerver által generált, stabil jegyzetazonosító |
| `ownerId` | Kötelező kapcsolat a meglévő `users.id` mezőhöz; létrehozás után nem változtatható |
| `title` | Opcionális cím, legfeljebb 120 karakter |
| `content` | Kötelező, validált korlátozott Markdown-szöveg |
| `visibility` | Kizárólag `private` vagy `family`, alapérték `private` |
| `version` | Egész revíziószám, kezdetben 1; sikeres módosításonként nő |
| `createdAt`, `updatedAt` | A projekt megosztott időbélyeg-konvenciója szerinti szerveridők |

Törölt tulajdonoshoz nem maradhat elérhető jegyzet; tervezett FK-viselkedés: cascade. Az első változat nem tárol családazonosítót, mert egyetlen családra épül. Több család támogatása külön adatmodell-változás; a mostani összes `family` sor nem válhat több háztartás közös adatává.

Párhuzamos szerkesztésnél a kliens a betöltött `version` értéket küldi. Módosítás és törlés csak egyező tulajdonos és revízió esetén történhet. Eltérésnél érthető konfliktusjelzés, a helyi szöveg megőrzése és friss változat betöltésének lehetősége szükséges; nincs csendes felülírás.

## Adatfolyam és architektúra

A [projekt architektúrája](../../../../../../.agents/architecture.md) és [app route-védelme](../../../../../docs/engineering/active/app-routing-auth-sidebar.md) érvényes. A route kezdeti betöltése közvetlenül a notes DAL-t hívja, amely az adatbázisban szűri a láthatóságot. Mások privát tartalma, teljes felhasználósora vagy sessionje nem kerül klienspropba, hálózati válaszba vagy naplóba.

Olvasási út: route → `notes/dal/queries.ts` → `notes/drizzle/operations.ts` → adatbázis. Írási út: szerkesztő → `notes/dal/mutations.ts` Server Action → jogosultság és Zod-validáció → feltételes adatbázis-művelet. Tartalom és láthatóság együtt mentendő.

Az első változat RSC-betöltést és mentés utáni route-frissítést használ; nincs önálló API vagy SWR-réteg, amíg kliensoldali háttérlekérés nem indokolja. Felhasználóspecifikus jegyzetlista nem kerülhet felhasználók között megosztott cache-be. A lista lapozott: 30 jegyzet oldalanként, stabil időpont/azonosító kurzorral, minden oldalon azonos jogosultságszűréssel.

A kliens részletmegnyitását és további lapbetöltését `loadNote`/`loadNotesPage` Server Function közvetíti ugyanazon hitelesített DAL-olvasásokhoz. A betöltött lista lokális állapot; mentés/törlés után az érintett cetli helyben frissül, a szerver a route-ot is újravalidálja. A kurzor megőrzi a PostgreSQL időbélyeg mikroszekundumos pontosságát, a lapok közötti azonosítók a kliensen deduplikálva vannak. Mutáció előtt az input újra parse-olásra kerül, mert a megosztott DAL csak validálja az argumentumokat, de nem adja tovább a Zod által normalizált eredményt. A tulajdonoshoz vagy időbélyegekhez küldött extra mezők nem kerülnek a mentésbe.

A mentetlen szerkesztés modálbezáráskor megerősítést, böngészőfrissítés vagy lapelhagyás előtt `beforeunload` figyelmeztetést kap. A böngésző SPA-visszalépésének teljes blokkolása nincs implementálva; az élő navigációs elfogadási próba még nyitott.

A sidebar Jegyzetek pontját az új route-ra kell átvezetni, megfelelő jogosultsági megjelenítéssel. A redesign óta az `/app` a legutóbbi valódi, jogosultan olvasható jegyzeteket mutatja. A publikus landing kizárólag fiktív cetliket mutathat.

## Elfogadási feltételek

- Egy aktív családtag tartósan létrehozhat, visszaolvashat, módosíthat és törölhet saját jegyzetet; újratöltés után is megmarad a mentés.
- A formázás szerkesztőben, cetlin és teljes nézetben következetes; beillesztett HTML nem fut le.
- A privát alapérték és a láthatóságváltás működik; mások privát jegyzete nem olvasható azonosító ismeretében sem.
- A megosztott jegyzetet más családtag olvashatja, de közvetlen Server Action hívással sem módosíthatja vagy törölheti.
- Nem családtag Google-felhasználó és visszavont tagság nem ad hozzáférést; admin sem olvashat más privát jegyzetébe.
- A fal reszponzív, pasztell kártyás és billentyűzettel használható. Betöltés, üres fal, hiba és nem mentett változás kezelve van.
- Párhuzamos szerkesztés nem írja felül csendben a frissebb tartalmat; a lapozás nem ad ki tiltott adatot.

Nem része az első változatnak: közös szerkesztés, élő frissítés, drag-and-drop, rögzítés, címkézés, verziótörténet, melléklet, e-mail, értesítés, export vagy nyilvános link.

## Alkalmazásszintű redesign, 2026-10-12

A korábbi ragasztószalagos papírhatás helyett stabil azonosítóhoz rendelt pasztell kártyák, külön láthatóságbadge, szerzőmonogram és módosítási dátum szerepel. A notes oldal keresést, Összes/Privát/Megosztott szűrést, Legutóbbi/Legrégebbi/Cím szerinti rendezést és rács/lista kapcsolót kapott. A keresés és számlálók a teljes jogosultan elérhető halmazból készülnek; a lapozás továbbra is 30 soros, a kurzor rendezési típust és címsorrendnél title értéket is őriz. Más rendezéshez tartozó kurzor elutasítva.

A szerkesztő desktopon széles, kétoszlopos dialog; mobilon teljes képernyő, görgethető tartalommal és külön alsó műveletsávval. A vizuális szerkesztőben a formázás közvetlenül látható, külön Szerkesztés/Előnézet kapcsoló nincs; az olvasónézet a biztonságos NoteContent renderelőt használja. A 120/5000 karakteres korlát, privát alapérték, tulajdonosi szerkesztés és verzióütközés-kezelés megmarad. A ?new=1 új szerkesztőt, a ?note=UUID hitelesítetten betöltött részletet nyit. A dashboard már valódi, ugyanazon DAL-szűréssel olvasott jegyzeteket mutat. Címkék, emlékeztetők, képek és checklist továbbra is külön tervezett bővítések.
