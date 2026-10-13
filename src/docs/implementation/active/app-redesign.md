# Homebase alkalmazásszintű redesign — implementációs terv

Állapot: az alap redesign implementálva; kiterjesztett elfogadási próbák nyilvántartása folyamatban. Dátum: 2026-10-12.
Specifikáció: [mérnöki terv](../../engineering/active/app-redesign.md).
Tervezési branch: `codex/app-redesign-plan`. A folytatásban az alkalmazáskód és a design dokumentáció átállt. Adatbázis-séma és környezeti konfiguráció nem változott.

## 1. Végrehajtási keret

Az átállás függőség szerint rendezett, önállóan review-zható szeletekből áll. A közös témát és shellt egyszer kell kialakítani, utána az oldalakat ehhez migrálni. Nincs párhuzamos új alkalmazás vagy második UI-stack. A régi funkciók működését minden érintett feature-szelet végén meg kell őrizni.

Feladatonként külön `codex/` branch a repository szabályai szerint. Commit, push, PR, deploy és éles adatbázis-módosítás csak külön kért művelet. A referenciafájlok jelenleg untracked állapotúak; a megvalósítás előtt biztosítani kell, hogy a munkához rendelkezésre álljanak, és commit kérésekor tudatosan legyen eldöntve a bevételük. Ne módosítsd/töröld az eredeti 11 képet.

Kisebb UI-, szöveg- és komponensszelet után kizárólag logikai review; automatikus lint/typecheck/teszt/build/dev server/böngésző nem indul. A teljes, komplex redesign végén a projekt szabályai szerinti build és böngészős ellenőrzés szükséges. Konkrét hibagyanú miatti köztes futtatás előtt az okot röviden meg kell nevezni. Commit előtt lint és typecheck, push előtt build kötelező. Az alábbi tesztesetek tervezett ellenőrzések, nem lefutott eredmények.

## 2. Munkacsomagok és sorrend

Függőség: R0 → R1 → R2; ezután R3/R4/R5/R6/R7 egymástól részben független. R8 a dashboardhoz és az új shellhez kapcsolódik. R9 minden elkészült felület után integrációs kapu. E1–E6 az alap redesign után külön feature-bővítések.

### R0 — Referenciák és döntések rögzítése

- [x] Mind a 11 kép vizuális elemzése és desktop/mobil szerepének meghatározása.
- [x] Aktuális route-ok, komponensek, téma és adatkorlátok feltárása.
- [x] Képi ellentmondások, hiányzó funkciók és örökölt invariánsok rögzítése.
- [x] Alkalmazásszintű engineering és implementation dokumentumpár létrehozása.
- [ ] Implementáció kezdésekor újraolvasni a vonatkozó AGENTS/feature szabályokat, helyi Next.js dokumentációt és az érintett skilleket.
- [ ] Képméretek, tömörítés és reprodukálható referencia-munkapéldány jegyzékének felvétele; személyes mintaszöveg nem kerül publikus assetbe.

Készfeltétel: a megvalósító minden oldalt és döntést konkrét képre/specifikációra tud visszavezetni. A mérnöki terv becsült tokenszínei nem tekinthetők mért pixelértéknek.

### R1 — Design tokenek, primitívek és assetek

Érintett: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/{button,input,skeleton,sheet,sidebar}.tsx`; új szükséges shadcn primitívek a `src/components/ui/` alatt; assetek `public/images/homebase/` alatt.

- [x] Új világos/petrol shadcn paletta és Tailwind theme mapping; `action-warm`, kategória- és státusztokenek.
- [x] Geist sans címrendszer, konzisztens radius/árnyék/térköz, látható caret és fókusz.
- [x] Gombvariánsok: petrol primary, meleg kiemelt művelet, outline, ghost, destructive. Loading/disabled állapotok.
- [x] Meglévő UI primitívek auditja: kizárólag szükséges shadcn elemek hozzáadása, nem teljes registry telepítése.
- [x] Ház-, notes íróasztal-, nappali/kutya- és növényasset előállítása a referencia alapján; mobil/desktop crop; méret és forrás dokumentálása.
- [x] Közös márkajel és ténylegesen újrahasznált oldalcím/illusztráció komponens; logó nem raster szöveg.
- [x] `.agents/DESIGN.md` tartalmának összehangolása az új célállapottal a repository engedélyezett írási folyamatán keresztül; a régi téma nem marad kötelezőként az új mellett.

Készfeltétel: a referenciák fő palettája, sans tipográfiája és panelkezelése elérhető szemantikus osztályokkal. Az assetek nem tartalmaznak beégetett személyes adatot, navot vagy formot. A már működő oldalakon a tokenváltás olvashatósága megmarad.

Kockázat: az export külön Canvas/PDF palettát használ; azt R7-ben is migrálni kell. A régi, közvetlen hex értékek nem frissülnek a CSS-tokenektől.

### R2 — Közös desktop és mobil shell

Érintett: `src/app/app/layout.tsx`, `src/components/app-sidebar/index.tsx`, szükség szerint `src/components/ui/sidebar.tsx`, `src/hooks/use-mobile.ts`; javasolt új `src/components/app-topbar/index.tsx`, `src/components/mobile-navigation/index.tsx`, `src/lib/app-navigation.ts`, `src/providers/` közös toast-szolgáltató.

- [x] Egyetlen jogosultságszűrt menüdefiníció; az aktív URL felismerése desktopon és mobilon azonos.
- [x] Sidebar petrol felület, cyan aktív jel, alsó családi motívum, valódi profil és sign-out.
- [x] Világos desktop topbar és kompakt mobil logó/profil; Budapest szerinti dátum. A kereső/harang helye csak elkészült szolgáltatással jelenik meg.
- [x] 1024 px shellváltás összehangolása a meglévő Sidebar saját breakpointjával; ne legyen egyszerre alsó nav és második oldalsávtrigger.
- [x] Alsó mobil nav safe-area-val és megfelelő tartalmi paddinggel; jogosultság nélkül kevesebb elem egyenletesen kitölti a sort.
- [x] Mobil profilmenü/kijelentkezés, skip link, látható fókusz, hosszú név/e-mail kezelése.
- [x] Egy toast-megjelenítési stratégia; ne legyen duplikált Toaster, a notes toastjai is láthatók legyenek, az alsó navot ne takarják.

Készfeltétel: az `/app` alatti összes route az új shellt kapja, a publikus oldalak külön maradnak. Read-jog, notes tagság és sign-out ugyanúgy működik. Header nem renderel külön második main elemet.

### R3 — Landing és Google-login

Érintett: `src/app/page.tsx`, `src/app/login/page.tsx`, `src/features/landing/components/LandingPromo.tsx`, `LandingPromo.module.css`; szükség szerint a landing feature új önálló illusztrációs/előnézet komponensei.

- [x] Osztott desktop hero, mobilra külön elrendezett appelőnézet és illusztráció; fiktív, személytelen demo.
- [x] A 20 másodperces animált promó helyett referencia szerinti statikus kompozíció. Használaton kívüli CSS és animáció eltávolítása.
- [x] Négy pasztell funkcióblokk és otthonjelenet; működő szakaszlinkek, `/login` és `/app` CTA-k.
- [x] Valós szövegek: nincs árazás, társadalmi bizonyíték vagy automatikus háttérimport-ígéret.
- [x] Login arculati átállítása, Google-only form, OAuth-hiba és konfigurációhiány állapotának megtartása.
- [x] LCP-kép, `sizes` és méretek a helyi Next image útmutató alapján, reduced-motion tisztelete.

Készfeltétel: mindkét landingreferencia fő tartalomhierarchiája felismerhető; 320 px-en a hero/előnézet nem fedi el a CTA-kat. A login flow nem változik designművelettől.

### R4 — Közmű kezdőnézet és diagram

Érintett: `src/app/app/monthly-expenses/page.tsx`, `loading.tsx`, `src/features/monthly-expenses/components/UtilityHistoryChart.tsx`, `MonthlyExpensesForm.tsx`; szükség szerint új `utility-overview/` komponenscsoport a feature-ben; `dal/queries.ts`, `drizzle/operations.ts`, `utils/consumption.ts`, `types.ts` csak indokolt adatkiterjesztéskor.

- [x] Kategória-/metrikaváltó, KPI-panel, diagram, kategóriaáttekintés és mentett hónaplista referencia szerinti kompozíciója.
- [x] Egy közös helyi kiválasztás a KPI és diagram számára; 6/12 naptári hónapos ablak; a backend és a megjelenített naptári hiányok összehangolása.
- [x] Aktuális havi összeg/fogyasztás, kiválasztott ablak összege/átlaga, lefedettség és hiányjelzés; százalék csak igazolt összehasonlíthatóságnál.
- [x] Egységek külön kezelése, nincs kWh/m³/MJ keverés vagy nullahelyettesítés.
- [x] Lista legújabb hónapkiemeléssel; Új kimutatás csak az aktuális hiányzó hónapra és sikeres listabetöltésnél.
- [x] Mentés/törlés után a lista és diagram a mentett állapotot követi; lokális szerkesztés nem számít mentett előzménynek.
- [x] Mobil 1 kompozíció adaptálása; valós kimutatáslista nem „közelgő fizetések” néven szerepel.

Készfeltétel: a `kozmu desktop 1` és `kozmu mobile 1` vizuális iránya teljesül, a korábbi fogyasztási invariánsok és szöveges adattábla megmaradnak.

### R5 — Havi kimutatás és számlakártyák

Érintett: `MonthlyExpensesForm.tsx`, `InvoiceRowCard.tsx`, `AdditionalExpenseRow.tsx`, `SourcePreviewDialog.tsx`; szükség szerint új `report-editor/` komponenscsoport. A parent form saját üzleti állapotát megtartja; csak önálló UI-felelősség kerül külön fájlba.

- [x] Breadcrumb, hónapcím, mentett hónapválasztó és léptetők; a fejléchez nincs szükség proxy route-komponensre.
- [x] Validált `month` query belépés dashboard/keresés számára; nem létező hónap érthető hiba és listára visszalépés, nincs implicit létrehozás.
- [x] Dirty kimutatás eldobásának megerősítése listavisszalépés, hónapváltás és új appnavigáció előtt.
- [x] Gmail kapcsolat/import, PDF, kézi számla pasztell műveletkártyákon; minden jelenlegi pending/hiba/részleges import állapot megmarad.
- [x] Számlakártyák rendezett fejléce és mezőrácsa; mobilon összecsukható részletek, hibánál megnyitás. Számla típusa és szolgáltatás típusa külön marad.
- [x] Feldolgozási státusz a meglévő issues/conflicts/ellenőrzés alapján, nem fizetettségből; preview hiányára saját állapot.
- [x] Összegzés egész hónapra, egyedi/sablontétel-választó, helyes Fele; Mentés és Exportálás elkülönítése.
- [x] Mobil teljes szerkesztő és opcionális kategóriafókusz a `kozmu mobile 2` alapján. A kiválasztott kategória nem változtatja a havi végösszeget.
- [x] Desktop sticky összegzés, mobil takarásmentes alsó műveletsáv és elérhető összegző panel.

Készfeltétel: a `kozmu desktop 2` részletképe felismerhető; mobilon is elvégezhető minden import/szerkesztés/mentés/export művelet. Egyetlen meglévő domainművelet sem tűnik el a redesign miatt.

### R6 — Jegyzetfal és reszponzív editor

Érintett: `src/app/app/notes/page.tsx`, `loading.tsx`, `src/features/notes/components/{NoteBoard,NoteCard,NoteEditor,NoteContent}.tsx`, `dal/queries.ts`, `dal/mutations.ts`, `drizzle/operations.ts`, `zod/schema.ts`, `types.ts`; önálló toolbar csak valós felelősség esetén.

- [x] Íróasztal-illusztrált fejléc, pasztell kártyák, privát/megosztott badge, szerzőmonogram, valódi dátum.
- [x] Összes/Privát/Megosztott, keresés, sorrend és rács/lista; 30 soros stabil, szűrt lapozás, globális count az engedélyezett halmazból.
- [x] Keresési/szűrési input Zod-séma, bound SQL paraméterek, tulajdonos/láthatóság predikátum minden query és count esetén.
- [x] Queryváltáskor kurzorreset és korábbi async válasz érvénytelenítése; üres szűrt eredmény külön az üres jegyzetfaltól.
- [x] Normál grid 1–4 oszloppal; nincs vizuális masonry miatti DOM-átrendezés. Hárompontos menü és megnyitás nem egymásba ágyazott gomb.
- [x] Desktop 2:1 editor, mobil teljes képernyős dialog; kizárólag egy editorpéldány és egy formállapot, breakpointváltás nem töröl draftot.
- [x] Radio-kártyás láthatóság, szerzőmegjelenítés, 120/5000 számlálók, létező formázás és biztonságos előnézet.
- [x] Dirty close, pending, hiba, verziókonfliktus és draft-visszaállítás; fókuszvisszaadás és mobil billentyűzet kezelése.
- [x] Címke/emlékeztető/melléklet kontroll csak a megfelelő E-csomag elkészülte után jelenik meg.

Készfeltétel: mind a négy notes kép kompozíciója felismerhető a működő képességeknél. Más családtag jegyzete továbbra is csak olvasható. Keresés/count/lapozás nem szivárogtat privát adatot, és nem csak a betöltött első oldalt szűri.

### R7 — Settings, dialogok, export és állapotok

Érintett: `src/app/app/settings/page.tsx`, `PresetSettingsForm.tsx`, `ExpenseSummaryExportDialog.tsx`, `SourcePreviewDialog.tsx`, `src/features/monthly-expenses/lib/summary-export-layout.ts`, `utils/summary-export.ts`, szükség szerint `src/app/app/loading.tsx`, `error.tsx`, route-specifikus loading/error felületek.

- [x] Sablonlista/form arculati átállítása, név/összeg/default/művelet hierarchiával; a shared snapshot szabály változatlan.
- [x] Export- és forrásdialogok azonos header/footer/fókusz/reszponzív rendszerrel.
- [x] PDF/PNG új szín- és tipográfiai hierarchia; vektoros PDF-szöveg, Liberation Sans magyar betűk, közös layout és tördelés megőrzése.
- [x] Hosszú nevek, sok tétel, hiányjelzés, túlcsordulás és tartalomhoz igazított oldal kezelése.
- [x] E-mail címzett/tárgy/teljes szöveg előnézet és explicit küldés; readonly/send OAuth-határ és 2 MiB limit megmarad.
- [x] Globális és feature betöltő/üres/hiba/részleges/pending/tiltott állapotok teljességi ellenőrzése az új témában.

Készfeltétel: nincs bent maradt krém/barna export vagy legacy dialog; sem a képfájl, sem a PDF nem veszít adatot, és a redesign nem változtatja a levelek tartalmát vagy küldési triggerét.

### R8 — Valódi dashboard és globális keresés

Érintett: `src/app/app/page.tsx`; feature DAL/operations szűk dashboard-projekciói; javasolt `src/features/monthly-expenses/components/dashboard-expenses/`, `src/features/notes/components/RecentNotes.tsx` csak szükséges önálló részekre; új `src/features/search/{components,dal,zod,types.ts}`.

- [x] Mock bills/loanPayment/notes helyett valós, jogosultságszűrt olvasás. Aktuális mentett hónap, előző havi összehasonlítás, kategóriaköltség, hat hónap és ismert határidők.
- [x] Jegyzetblokknak ugyanaz a friss tagság-/láthatóságellenőrzés, mint a notes oldalnak; limitált preview DTO.
- [x] Független betöltés és hibák: jegyzethiba nem tünteti el a közműpanelt; joghiánynál megfelelő blokkok és gyors műveletek hiányoznak.
- [x] Gyors műveletek működő céljai: explicit új jegyzet, aktuális kimutatás indítása/megnyitása és kézi számlafelvétel, Közművek, Settings. Navigációs intent nem futtat mutációt.
- [x] Globális keresés feature-DAL-okból, minimum 2 karakter és limitek; egységes találat DTO, hibás/üres/pending állapot.
- [x] Cmd/Ctrl+K, billentyűzetes találatválasztás, mobil panel, fókuszvisszaadás, késői válaszok kivédése.
- [x] Találat megnyitása validált hónap-/jegyzetazonosítóra, céloldalon újbóli jogosultságellenőrzéssel. Láthatóságváltás után korábbi találat nem adhat hozzáférést.

Készfeltétel: a `home desktop.png` modulhierarchiája valódi adatokkal működik, mobilra az engineering adaptáció érvényes. A kereső nem tölti le előre a teljes családi adatkészletet.

### R9 — Integrációs és vizuális elfogadás

- [ ] Minden route és dialog összevetése a neki rendelt referenciával; külön screenshot a 11 kompozíció megfeleltetéséhez. Képernyőkép csak tesztadatot tartalmazzon.
- [ ] 320/390/768/1024/1440 px, 200% zoom, hosszú magyar cím/összeg és mobil virtuális billentyűzet.
- [ ] Keyboard/fókusz/contrast/reduced-motion/diagramtábla ellenőrzés, safe-area és toast pozíció.
- [ ] Komplex redesignhoz böngészős próba és konzolhibák ellenőrzése a felhasználó által biztosított hozzáféréssel, majd szükséges célzott tesztek és build.
- [ ] README, `.agents/DESIGN.md`, routing dokumentum és érintett feature-specifikációk megjelenési állításainak összehangolása. A régi funkcionális invariánsokat nem kell újraírni.
- [ ] Alap redesign és E-csomagok elkészültségének külön rögzítése; blokkolt külső OAuth/élesadat-próba ne szerepeljen sikeresként.
- [ ] Befejezett implementációs terv áthelyezése az `implementation/archive` alá csak az alap redesign összes készfeltételének teljesülésekor; az engineering az `active` alatt marad.

## 3. Későbbi feature-bővítések a teljes képi célhoz

Ezek külön végrehajtható csomagok, jelenleg mind tervezett. Nem szükséges a core vizuális átállás előtt megvalósítani őket, de nélkülük nem állítható, hogy a képek minden látható funkciója elkészült.

| Azonosító | Csomag és fájlterület | Függőség / készfeltétel |
| --- | --- | --- |
| E1 | Notes címkék: schema/types/Zod/DAL/editor/filter/count | R6; külön notes engineering, saját címke + kapcsolat, DB-bevezetési terv |
| E2 | Strukturált checklist: notes tartalommodell/parser/editor/mutations | R6; régi szöveg kompatibilis, tulajdonosi írás és verzióvédelem |
| E3 | Link/aláhúzás és szerkesztési undo/redo | R6; parser whitelist, veszélyes protokollok tiltása, round-trip tesztek |
| E4 | Privát jegyzetképek és thumbnail | R6; tároló, hozzáférés, méret/format limit, törlési lifecycle |
| E5 | Notes emlékeztető + app értesítések | R2/R6; ütemező, timezone, deduplikáció, valós unread állapot |
| E6 | Családtag-avatar DTO és megosztás megjelenítése | R6; igazolt tagságlista, nincs kitalált résztvevő vagy új megosztási jog |

Sémát igénylő E-csomag előtt a védett migrációs/környezeti fájlhatárt jelezni kell a felhasználónak. A generált migrációkat nem szabad kézzel szerkeszteni; élő sémabevezetés külön művelet. Értesítési ütemező szolgáltatásának kiválasztása és melléklet-tároló költsége külön döntés, nem designból következő tény.

## 4. Ellenőrzési mátrix

| Terület | Kötelező próba az érintett komplex csomag végén | Sikerkritérium |
| --- | --- | --- |
| Auth/nav | Vendég, belépett jog nélkül, közműjog, notes tag, visszavont tag | Nincs tiltott adat, helyes menü és szervervédelem |
| Kimutatás | Új aktuális hónap, megnyitás, módosítás, reload, törlés, dirty váltás, párhuzamos verzió | Sem csendes adatvesztés, sem felülírás |
| Import | Gmail nem csatlakoztatott/csatlakoztatott/lejárt, részleges PDF, duplikált jelölt | Működő állapotok, sikeres sorok megmaradnak |
| Diagram/KPI | Nincs adat, hiányzó hónap, nulla, hiányzó fogyasztás, vegyes egység, jóváírás | Domainszabály szerinti érték és hiányjelzés |
| Dashboard | Nincs aktuális hónap, egyik feature hibás/tiltott, nulla előző hónap | Valós adatok és független fallback, nincs hamis százalék |
| Notes | Saját privát, saját családi, más családi, tiltott id, version conflict | Tulajdonosi írás és szűrt olvasás megmarad |
| Notes keresés | 30+ jegyzet, szűrés/rendezés/lapozás/count, gyors queryváltás | Teljes jogosult halmaz, stabil kurzor, késői válasz nem ír felül |
| Globális keresés | Közmű-only/notes-only/nincs jog, név/id keresés, törölt/privátra váltott találat | Limitált biztonságos DTO, újraellenőrzött cél |
| Export | PDF/PNG/TXT, hosszú sor/sok tétel/ékezet/hiány, 2 MiB limit | Adattartalom azonos, éles PDF, explicit e-mail-kattintás |
| Mobil/editor | Safe-area, billentyűzet, viewportváltás, bezárás, háttérscroll | Draft megmarad, nincs takarás, fókusz visszatér |

Lehetséges célzott parancsok, kizárólag a fent rögzített futtatási feltételek mellett:

- Közmű domainmódosítás: `npm run test:monthly-expenses` vagy az érintett tesztfájlok `tsx --conditions=react-server --test` futtatása.
- Notes parser/access bővítés: `npm run test:notes`; új query/cursor/keresés teszteknél célzott fájlok, a szükséges server conditionnel.
- Auth útvonalregresszió: `npx tsx --test src/features/authentication/tests/routing.test.ts`.
- Commit kapu: `npm run lint`, `npx tsc --noEmit`; teljes komplex redesign/push kapu: `npm run build`.

Reverzibilis, alacsony hatású tisztán vizuális változtatáshoz ne írj implementációt tükröző tesztet. Új teszt ott indokolt, ahol új aggregáció, query-szűrés, kurzor, jogosultság, parser vagy állapotátmenet valódi hibát előz meg.

## 5. Bevezetés, visszalépés és kockázatok

Az alap redesignhoz tervezetten nincs új adatbázisoszlop. A dashboard/keresés/filter a meglévő tárolt adatokból és új szűk lekérdezésekből dolgozik. Az E-csomagok sémabevezetését ettől külön kell kezelni. Fejlesztés alatt átmenetileg lehet vegyes megjelenés a branch-en; a teljes új téma csak R9 után tekinthető bevezetettnek.

Visszalépéskor az összetartozó témát/shellt/oldalakat együtt kell visszaállítani; nem elég csak a CSS-tokeneket. A meglévő kimutatás- és notes-adatformátum megőrzése teszi lehetővé a korábbi alkalmazásverzióra visszatérést. Commit nélküli munkában csak az adott feladat saját módosításai vonhatók vissza, a felhasználó referenciái nem.

| Kockázat | Kezelés |
| --- | --- |
| Referenciából hiányzó tiszta illusztrációs asset | R1 elején előállítás; a layout csak végleges mobil/desktop arányokkal zárható le |
| Képi funkciók még nincsenek implementálva | E1–E6 elkülönített állapot, hamis kontroll és ígéret nélkül |
| Globális téma érinti a régi formokat/dialogokat | R1 után route-onkénti migráció, R7 exportpaletta és R9 teljességi audit |
| Nagy parent form refaktorálása megtöri az importot | RHF/state/async azonosítók maradnak a felelős gyökérben; csak indokolt UI kiszervezés |
| Hiányos előzményből hamis KPI vagy százalék készül | Azonos domainaggregáció, explicit lefedettség és összehasonlíthatósági szabály |
| Notes count/keresés átugorja a hozzáférésszűrést | Ugyanaz az SQL-jogosultságpredikátum minden lekérésben, negatív tesztek |
| Mobil új navigáció dirty formot eldob | Közös elhagyási ellenőrzés a belső navigációkhoz, browser unload külön kezelve |
| Élő Google-próba nem elérhető | Az igazolt és nyitott állapot külön jelentve, nem kitalált siker |

## 6. Tervezési eredmény és aktuális státusz

Elkészült: a 11 referencia elemzése, alkalmazásszintű célrendszer, oldalmátrix, mobiladaptáció, konkrét fájlokra bontott implementációs csomagok, függőségek, funkcionális bővítések és elfogadási kapuk.

Az alap redesign kódja és a négy illusztráció elkészült. A valós dashboard, közmű kezdő-/részletnézet, notes keresés/filter/rendezés/count/editor, globális keresés és settings/export felületek implementálva. E1–E6 továbbra is külön tervezett bővítések; adatbázis-módosítás nem történt.

## 7. Implementációs eltérések és igazolt ellenőrzések

- A shell 1024 px-től desktop sidebar; a kimutatás szerkesztő kétoszlopos felosztása 1280 px-től indul, hogy a sidebar mellett a mezők olvashatók maradjanak. 1024–1279 px-en egymás alatti számlák/összegzés.
- A közmű KPI/diagram ugyanazon kiválasztásból dolgozik; az alsó kategóriaáttekintés külön a lekért 12 hónap ismert költségeit mutatja, ezt felirata jelzi.
- Az illusztrációk 1200 px-es WebP-k, a sidebar növény 320 px-es. Egy forrásból adaptált mobilkompozíció, külön fiktív HTML-appelőnézet. Assetforrás és promptok: engineering/active/app-redesign-assets.md.
- A navigációs őr a belső linkeket és programozott keresőnavigációt védi, a feature-ök külön kezelik a dirty bezárást és beforeunload eseményt. A böngésző saját SPA-visszalépésének teljes blokkolása továbbra sem igazolt.
- npm run test:monthly-expenses: 84/84 sikeres, ebből 6 új dashboard teszt. A végső bounds-javítás után a 6 dashboard teszt külön is sikeres.
- npm run test:notes: 9/9 sikeres. Query-schema és auth routing célzott együttes futtatás: 15/15 sikeres.
- A böngészős próbák igazolták a mentett aktuális havi dashboardot, a közmű részletmegnyitást, a MVM globális keresést és billentyűzetes találatnyitást, a notes új szerkesztőt, biztonságos formázott előnézetet és drafteldobási megerősítést, valamint a settings és exportmodal renderelését.
- A böngészős megtekintés során nem történt adatmentés, törlés, Gmail-import, OAuth-consent vagy e-mail-küldés. Második felhasználóval a live jogosultsági negatív matrix, valós mobil virtuális billentyűzet és az összes referencia testadatú screenshotja még nincs igazolva.
- A teljes terv az active mappában marad, amíg a kiterjesztett R9 elfogadási sorok is teljesülnek. Az alapkiadás implementációja elkészült, ez nem állítja az E-csomagok elkészülését.

Végső reszponzív DOM-próba: landing, dashboard, notes, közmű kezdőnézet/részlet és settings 320/390/768/1024/1440 px-en. A feltárt közmű kategóriasor- és számlakártya-overflow javítva, a 320 px-es újrapróba takarás- és vízszintes overflow nélkül. Desktop/monthly részlet és notes editor, mobil notes preview és exportmodal vizuálisan megtekintve. Konzolban alkalmazáshiba nem jelent meg; a korábbi LCP-figyelmeztetés eager headerképekkel javítva. A full live jogosultsági/OAuth, fizikai mobilbillentyűzet és 200%-os zoom mátrix nincs teljes egészében igazolva.

Végső kódkapu: az összes módosított/új TS és TSX fájl célzott ESLintje sikeres, a production build fordítása és TypeScript-ellenőrzése sikeres. git diff --check sikeres. A saját whitespace-módosításokkal véletlenül érintett, feladathoz nem kapcsolódó fájlok eredeti állapota visszaállítva.
