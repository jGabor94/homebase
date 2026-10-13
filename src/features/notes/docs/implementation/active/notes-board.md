# Jegyzetek üzenőfala — implementációs állapot

Állapot: a kód és a development adatbázis-bevezetés elkészült; a hiányzó családtag első belépése és a teljes böngészős elfogadás még nyitott. Dátum: 2026-10-12.
Specifikáció: [mérnöki dokumentum](../../engineering/active/notes-board.md). Áttekintés: [README](../../../README.md).

## Elkészült feladatok

- [x] Feature README, mérnöki specifikáció és implementációs dokumentum.
- [x] Explicit `notesMember` szerepkör és notes olvasási/létrehozási/szerkesztési/törlési jogosultság. A sima Google-regisztráció és az admin szerepkör nem ad jegyzethozzáférést.
- [x] Friss adatbázis-alapú tagságellenőrzés minden DAL-olvasásnál és mutációnál. SQL-szűrés privát/családi olvasáshoz; tulajdonos, tagság és revízió a módosítás/törlés feltételében.
- [x] Helyi tagságkezelő parancs előnézettel és külön `--apply` végrehajtással; létező felhasználónál a többi szerepkört megőrzi.
- [x] Notes Drizzle-séma RLS-sel, FK-val, indexekkel, check constraint-ekkel, megosztott időbélyegekkel és Insert/Select típusokkal; gyökér sémagyűjtőbe exportálva.
- [x] Zod-validáció címre, tartalomra, láthatóságra, azonosítóra, kurzorra és revízióra. Cím nélküli RHF-output és action-input összehangolva; hamis tulajdonosmezők kiszűrve.
- [x] Jogosultságszűrt lista 30 elemre lapozva, mikroszekundumos időpont/azonosító kurzorral; részletolvasás, létrehozás, szerkesztés és törlés a DAL-on át.
- [x] Tiptap vizuális rich-text szerkesztő Markdown-tárolással; a régi tartalom betöltéskor változatlan marad, a félkövér/dőlt/áthúzott szöveg, címsorok, idézetek, kód és egymásba ágyazott listák olvashatók.
- [x] Biztonságos `react-markdown` olvasónézet explicit HTML-elem engedélyezési listával; nyers HTML és képek nem lesznek aktív markupká, a linkek célcíme biztonságos protokollokra korlátozott.
- [x] Marked-alapú közös láthatószöveg-ellenőrzés: kód, formázott szöveg és listák elfogadottak, üres jelölések, HTML és képek nem számítanak tartalomnak.
- [x] RHF/Zod jegyzetszerkesztő címmel, vizuális formázó eszköztárral, láthatósággal, pending és validációs állapotokkal.
- [x] Papírcetlik stabil, azonosítóhoz rendelt pasztellszínekkel, formázott előnézettel és hozzáférhető szöveges metaadatokkal.
- [x] Teljes olvasási nézet, tulajdonosi szerkesztés/törlés, megerősítések, mentetlen szöveg megőrzése, böngészőfrissítési figyelmeztetés, hálózati hibák kezelése és késői válaszok érvénytelenítése.
- [x] Verzióütközésnél friss változat betöltése, szerkesztő újranyitása friss revízióval, külön megőrzött és másolható helyi szöveg.
- [x] `/app/notes` route, kezdeti szerveroldali adatbetöltés, loading UI, üres és hibás állapotok, lapozás. A kliens részlet-/listaolvasását hitelesített Server Function közvetíti; külön API/SWR nincs.
- [x] Jogosultsághoz kötött sidebar link és dashboard-hivatkozás; az áttekintés továbbra is fiktív adatokat mutat.
- [x] Tiptap roundtrip, formázás, validáció és renderelési biztonság tesztelve; célzott lint és TypeScript sikeres.

## Érintett fájlok

| Terület | Fájlok |
| --- | --- |
| Séma és típusok | `drizzle/schema.ts`, `drizzle/operations.ts`, `zod/schema.ts`, `types.ts` |
| Szerver | `lib/access.ts`, `dal/queries.ts`, `dal/mutations.ts` |
| Formázás és felület | `lib/note-formatting.ts`, `components/NoteContent.tsx`, `NoteRichTextEditor.tsx`, `NoteCard.tsx`, `NoteEditor.tsx`, `NoteBoard.tsx` |
| Adminisztráció | `scripts/manage-membership.ts` |
| Tesztek | `tests/formatting.test.ts`, `tests/access.test.ts`, a gyökér `package.json` `test:notes` parancsa |
| Alkalmazásintegráció | `src/app/app/notes/page.tsx`, `loading.tsx`, app layout és dashboard, sidebar, authorization konfiguráció/típusok, gyökér sémagyűjtő |

A tervezett külön `NoteDialog` helyett a modál és az állapotátmenetei a `NoteBoard` összetartozó felelősségében maradtak. A vizuális szerkesztőhöz Tiptap, a biztonságos olvasóhoz ReactMarkdown/remark-gfm, a láthatószöveghez Marked került a függőségek közé. A meglévő shadcn Button/Input/Skeleton és Radix Dialog/AlertDialog primitívek szolgálják a felületet. A Next.js telepített adatbetöltési, mutációs és revalidációs dokumentációja alapján készült a bekötés.

## Ellenőrzési eredmények

| Ellenőrzés | Eredmény és határ |
| --- | --- |
| `npm run test:notes` | **10/10 sikeres** a fő rich text változtatás után; a végső legacy fallback renderelés célzott formázási tesztjei külön **6/6 sikeresek** |
| `npx tsc --noEmit` | Sikeres a vizuális szerkesztő és a Markdown helper frissítése után |
| Célzott ESLint | A módosított notes komponensek, formázó helper, séma és teszt hibák és figyelmeztetések nélkül sikeresek |
| `npm run build` | A Tiptap-változással sikeres; TypeScript-fordítás és az összes route elkészült, a `/app/notes` dinamikus route. A későbbi, nem támogatott régi Markdown-csomópontokat szöveggé bontó reader beállítás után csak célzott teszt és lint futott |
| Drizzle schema export | A feature sémájából generált SQL kizárólag notes táblát, indexeket, FK-t, check constraint-eket és RLS-engedélyezést tartalmaz; DB-módosítás nem történt |
| Vizuális ellenőrzés | A korábbi statikus SSR-előnézet nem fedi le az új Tiptap szerkesztőt; hidratált desktop/mobil UI-t és mentési folyamatot még nem ellenőriztünk böngészőben |

A tesztek nem kapcsolódtak élő adatbázishoz, és nem igazolnak két valódi családtag közötti adatizolációt. A `.env*` fájlok nem módosultak; a migrációs mappába külön felhasználói engedéllyel került új, generált notes migráció, a régi fájlok változatlanok. Commit, push és deploy nem történt.

## Nyitott bevezetési lépések

- [x] Kifejezett felhasználói engedély a migrációs mappára vonatkozó AGENTS.md-határ feloldásához. A notes-only séma-változást kell bevezetni, más feature módosítása nélkül.
- [x] A céladatbázis és a korábbi migrációs állapot ellenőrzése; a notes migráció generálása, review-ja és alkalmazása a jóváhagyott folyamatban. Az RLS mellett a szerver adatbázis-szerepkörének tényleges olvasási/írási jogosultságát is igazolni kell.
- [ ] Az ellenőrzött családtagok azonosítása és explicit `notesMember` kiosztása a helyi eszközzel. A meglévő, megadott fióknál a kiosztás sikeres, korábbi szerepköre megmaradt. A másik megadott fiók még nem létezik; kiosztása az első Google-belépés után lehetséges.
- [ ] Élő létrehozás, újratöltés, szerkesztés, törlés, cím nélküli mentés és 30 elem feletti lapozás.
- [ ] Két bejelentkezett családtag: privát/családi olvasás, közvetlen tiltott action-hívások, tagságvisszavonás régi session mellett és párhuzamos szerkesztési konfliktus.
- [ ] Hidratált szerkesztő: formázógombok, teljes szöveg, mobil és billentyűzetes modálkezelés, hálózati hibák, mentetlen változtatások és SPA-visszalépés. A `beforeunload` nem blokkol minden SPA-navigációt; szükség esetén ehhez külön navigációvédelem kell.

A terv az `implementation/active` alatt marad, amíg a bevezetés és az elfogadási próbák nem teljesülnek. Befejezéskor `implementation/archive` alá kerül; a mérnöki specifikáció az `engineering/active` alatt marad.

## Development bevezetés — 2026-10-12

A beállított endpointot a Neon `homebase` projekt `development` ágához azonosítottuk. A production ágat nem módosítottuk. A bevezetés direct kapcsolattal, a telepített Drizzle migrátorral történt; `.env*` módosítás nélkül.

Az eredeti snapshotból hiányoznak a korábban más módon bevezetett közműtáblák. A teljes gyökérsémából generált diff ezért ezeket ismét létrehozta volna. A notes migráció az eredeti snapshot user/account tábláival és az új notes sémával, szűk exportból lett generálva. A notes-only SQL-t előbb dry runban átnéztük, majd visszagörgetett tranzakcióban kipróbáltuk. A generált `20261012163347_notes-board` migráció és snapshot bekerült a repositoryba, a migráció bejegyzése a development Drizzle naplójában szerepel. A régi migrációs fájl és snapshot változatlan; a közmű-snapshot eltérés külön karbantartási feladat marad.

Igazolt: cím nélküli létrehozás, privát alapérték, módosítás, megosztás, elavult revízió elutasítása, tulajdonosfeltétel és törlés, RLS engedélyezése. A tényleges `getNotesPage`/`getNoteById` és friss tagságellenőrzés két ideiglenes szintetikus taggal igazolta a privát adatizolációt, megosztott olvasást, családiról privátra váltást, 33 látható elem 30+3 lapozását, mikroszekundumos kurzort, duplikációmentességet és visszavont hozzáférés kizárását. A tesztfelhasználók és jegyzeteik eltakarítva, maradék tesztadat nulla.

Ezek a próbák élő development DB-/lekérdezési ellenőrzések; nem helyettesítik a teljes Google-belépéses böngészős próbát vagy a Server Action HTTP-határának külön tesztjét. A korábbi bevezetés előtti teszteredmények történeti állapotot írnak le.
