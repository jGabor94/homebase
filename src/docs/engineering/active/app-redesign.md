# Homebase alkalmazásszintű redesign — mérnöki terv

Állapot: alap redesign implementálva; E1–E6 funkcionális bővítések tervezettek. Dátum: 2026-10-12.
Hatókör: publikus landing, Google-belépés, teljes hitelesített app shell, áttekintés, közművek, kimutatásszerkesztés, jegyzetek, beállítások, dialogok, exportok és rendszerállapotok.
Végrehajtás: [implementációs terv](../../implementation/active/app-redesign.md).

## 1. Cél és dokumentumhatár

A Homebase teljes vizuális és interakciós rendszerének újraalkotása a `.agents/app-design` 11 képéből. A cél következetes, világos, illusztrált családi alkalmazás sötét petrol navigációval, erős sans tipográfiával, pasztell funkciószínekkel és valóban mobilra tervezett használattal. A layout, tartalomhierarchia és munkafolyamatok is változnak; a puszta színcsere nem teljesíti a feladatot.

Ez a dokumentum az alkalmazásszintű redesign specifikációja; a konkrét eltéréseket és ellenőrzési státuszt az implementációs terv rögzíti. A jelenlegi működést továbbra is a README és az aktív feature-specifikációk írják le. A régi `.agents/DESIGN.md` krém–barna–olíva témája, serif címei, mobil oldalsávja és animált landingje a redesign bevezetésekor cserélendő. A jogosultsági, pénzügyi, adatkezelési és konfliktuskezelési invariánsok továbbra is kötelezők. A szabálydokumentumokat az alapkiadás új megjelenéséhez igazítottuk.

## 2. Referenciamátrix

Minden kép vizuálisan megvizsgált forrás. Az elérési utak a repository gyökeréhez képest értendők. A kész alkalmazás HTML-komponensekből épül; teljes képernyőkép nem használható interaktív oldal helyett.

| Kép a `.agents/app-design/` alatt | Kötelezően átveendő jelleg | Alkalmazási hely |
| --- | --- | --- |
| `home desktop.png` | Sötét sidebar, felső keresősáv, illusztrált fejléc, petrol összegkártya, kétsávos modulrács | `/app`, közös shell |
| `landing desktop.png` | Osztott hero, nagy sans cím, házillusztráció, döntött appelőnézet, négy pasztell blokk, otthonjelenet | `/` desktop |
| `landing mobile.png` | Önálló mobilkompozíció, egymás alatti CTA-k és funkcióblokkok | `/` mobil |
| `kozmu desktop 1.png` | Közmű- és metrikaváltó, KPI-panel + diagram, kategóriaáttekintés + mentett hónapok | Közmű kezdőnézet |
| `kozmu desktop 2.png` | Breadcrumb, hónapfejléc, importműveletek, részletes számlakártyák, jobb összegzés | Havi kimutatásszerkesztő |
| `kozmu mobile 1.png` | Illusztrált mobilfejléc, pasztell választók, egymás alatti panelek, alsó navigáció | Közmű kezdőnézet mobil |
| `kozmu mobile 2.png` | Mobil számlakártya és kategóriaszűrés, diagram, előzménylista | Mobil számla-/kategóriafókusz; nem a teljes szerkesztő helyettesítője |
| `notes desktop 1.png` | Íróasztal-illusztráció, szűrős toolbar, négysávos pasztell kártyarács | Jegyzetfal desktop |
| `notes desktop 2.png` | Széles dialog, tartalom balra, metaadatok jobbra, alsó műveletsáv | Jegyzetszerkesztő desktop |
| `notes mobile 1.png` | Saját keresősor, tördelődő szűrők, kompakt rács, alsó navigáció | Jegyzetfal mobil |
| `notes mobile 2.png` | Teljes képernyős szerkesztő, egymás alatti blokkok, alsó mentési sáv | Jegyzetszerkesztő mobil |

A telefonkeret, notch, státuszsáv és rendszer-home-indikátor prezentációs kellék, nem webes komponens. Hiányzó home-mobil, login-, settings-, export- és hibaállapot-referencia esetén az itt meghatározott közös rendszerből származik a megjelenés.

## 3. Kiinduló állapot és változástérkép

| Terület | Meglévő megvalósítás | Redesign célja |
| --- | --- | --- |
| Téma | `src/app/globals.css`, meleg shadcn tokenek, Geist + Georgia | Új szemantikus paletta, sans címek, egységes felületek |
| Shell | `src/app/app/layout.tsx`, `src/components/app-sidebar/index.tsx`, shadcn Sidebar | Petrol desktop sidebar, világos topbar, mobil alsó navigáció és profilmenü |
| Landing | `src/app/page.tsx`, `LandingPromo.tsx` és CSS module | Referencia szerinti statikus illusztrált landing, valós funkciószövegek |
| Áttekintés | `src/app/app/page.tsx`, fiktív számlák, fix hitel, mock jegyzetek | Referencia szerinti modulok, jogosultságszűrt valós összesítések |
| Közművek | RSC page + `MonthlyExpensesForm.tsx`; lista/részlet lokális váltása | Áttekintő panelek és rendezett részletnézet; meglévő adatfolyam megőrzése |
| Diagram | `UtilityHistoryChart.tsx`, SVG, 12 mentett hónap, egységválasztó | 6/12 hónapos nézet, KPI-k, pasztell oszlopok, kiemelt aktuális pont |
| Jegyzetek | `NoteBoard`, `NoteCard`, `NoteEditor`, `NoteContent`; lapozott, verziózott szöveg | Kártyarács, keresés/szűrés/rendezés, reszponzív editor |
| Beállítások | `PresetSettingsForm.tsx`; közös tételsablonok | Ugyanazon design nyelvű formok és lista |
| Export/forrás | Saját dialogok, Canvas PNG, vektoros PDF, TXT | Új paletta és dialogkeret; változatlan snapshot és küldési határ |

Stack a feltárt checkout szerint: Next.js 16.3.6, React 19.2.8, Tailwind 4, shadcn new-york/Radix, Lucide, react-hook-form/Zod. Meglévő komponenseket kell továbbépíteni; UI-framework-csere nem indokolt.

## 4. Referenciák ellentmondásainak feloldása

- A képeken szereplő személy, e-mail, dátum és pénzösszeg minta, nem beégetendő adat. A 2026. október 12. felirat melletti „vasárnap” hibás: a hét napját mindig dátumformázó adja.
- A havi részlet képen a látható tételek nem adják ki a 109 337 Ft végösszeget. A valós összesítő kizárólag a domain számításait használja. Nincs automatikus 81 000 Ft hitel vagy képről átvett egyéb költség.
- A mobil közmű-kezdőkép aktív Áttekintés pontja hibás; `/app/monthly-expenses` alatt a Közművek aktív.
- A mobil kezdőkép „Közelgő fizetések” soraiban mentett kimutatások metaadatai keverednek. A két lista külön jelentésű: számlaesedékesség kontra mentett havi kimutatás.
- A közműmobilon a 38,2 m³ hat havi érték és az „Október” címke nem egyazon időablak. Minden KPI a kiválasztott időablakot nevezi meg.
- Víz, gáz és villany eltérő egységei nem összeadhatók. A dashboard összesített diagramja költséget mutat Ft-ban; fogyasztási nézetben kötelező kategória és egység választása.
- A gáz mértékegységét és fájlnevét nem szabad a kép mintájából kikövetkeztetni. A számla tényleges adata az igazságforrás.
- „Feldolgozva” nem jelent „Kifizetve”. Nincs fizetettségi mezőre épülő igazolt nyilvántartás; az esedékességlistát „Közelgő határidők” címmel kell megjeleníteni.
- A notes editor 100 karakteres címlimitje helyett a meglévő, szerverrel egyező 120 marad; a tartalomlimit 5000.
- A képek „több ezer család”, árazás és automatikus havi import állításai nem igazoltak. Ezek helyett a saját családi használatot és a felhasználó által indított importot kell bemutatni.

## 5. Designrendszer

### Paletta és felületi hierarchia

Az alábbi hex értékek vizuálisan becsült implementációs kiindulópontok, nem pixelből mért minták. A végső kontraszt és képi összevetés a megvalósításkor ellenőrzendő.

| Szemantikus token | Kiinduló érték | Használat |
| --- | --- | --- |
| `background` | `#f5f8f9` | Világos appvászon |
| `foreground` | `#0b1628` | Címek, fő szöveg |
| `card`, `popover` | `#ffffff` | Panelek, dialogok |
| `muted` / `muted-foreground` | `#f1f4f6` / `#586b85` | Mezőhátterek, kísérőszöveg |
| `border`, `input` | `#e3e9ee` | Finom határok |
| `primary` / foreground | `#126574` / `#ffffff` | Navigáció, általános elsődleges CTA |
| `action-warm` / foreground | `#b34330` / `#ffffff` | Új jegyzet, hangsúlyos mentés/export |
| `sidebar` / foreground | `#10252d` / `#e8f2f5` | Sötét app navigáció |
| `sidebar-accent` / foreground | `#194b55` / `#ffffff` | Aktív menü |
| `ring` | `#087f8c` | Billentyűzetes fókusz |
| víz tone / ink | `#eaf5ff` / `#0764c9` | Vízikon és kategóriakártya |
| gáz tone / ink | `#fff0ee` / `#c93630` | Gázikon és kategóriakártya |
| villany tone / ink | `#fff7e5` / `#985b00` | Villanyikon és kategóriakártya |
| hulladék tone / ink | `#ecf8ee` / `#087b45` | Hulladékikon és kategóriakártya |
| egyéb tone / ink | `#f0f2f4` / `#526174` | Egyéb kategória |
| success / warning / destructive | `#087b45` / `#985b00` / `#b52d2d` | Állapotok, nem kategóriaszínek |

Shadcn tokenek és Tailwind v4 `@theme inline` mapping a globális CSS-ben; dekorációs és státuszszínekhez külön szemantikus változók. Az új meleg akciószín nem helyettesítheti a veszélyes művelet `destructive` szerepét. A notes pasztellszínei stabilan azonosítóhoz rendeltek, a láthatóságot külön felirat és ikon jelzi.

### Tipográfia, térköz, dekoráció

- Geist sans az egész appban, serif főcímek nélkül. Desktop oldalcím 48–64 px, mobil 32–40 px; landing desktop 56–72 px. `clamp` és rövidebb mobil sortörés, nem fix képméret.
- Panelcím 18–22 px, törzsszöveg 15–16 px, kísérőszöveg 13–14 px. Pénzösszegek `tabular-nums`, magyar számformátum.
- 4 px alapú térközskála; desktop panelbelső 20–24 px, mobil 16 px. Rácsköz 16–24 px. Panelradius 18–22 px, mező/gomb 10–14 px, badge pill.
- Finom hideg árnyék és határ; világos panel nem olvadhat a vászonba. Desktop sidebar kb. 240–256 px, topbar 72–80 px, tartalom legfeljebb 1440 px.
- Petrol összegkártyán és illusztráció körül enyhe gradient, hullám és halvány színfolt megengedett: az új referencia felülírja a régi teljes gradienttilalmat. Glassmorphism és neonfelület nem szükséges.
- Díszítő kézírás kizárólag illusztrációhoz tartozó rövid motívum; a lényegi cím és UI-szöveg élő szöveg.
- A jelenlegi globális `caret-color: transparent` eltávolítandó, az inputoknak látható kurzor kell.

### Reszponzív szerződés

| Szélesség | Shell | Tartalom |
| --- | --- | --- |
| 320–639 px | Kompakt logó/profil topbar, fix alsó nav | Egyoszlopos panelek; notes egy oszlop 480 px alatt |
| 640–1023 px | Alsó nav, kompakt felső sáv | Notes 2–3 oszlop a rendelkezésre álló kártyaszélesség szerint; közműpanelek szükség szerint egy oszlop |
| 1024 px fölött | Petrol sidebar + topbar | Dashboard 2 oszlop, havi szerkesztő kb. 2:1, notes 3 oszlop |
| 1280 px fölött | Ugyanaz | Notes 4 oszlop, ha a megmaradó tartalomszélesség legalább 1040 px |

A referencia mobil notes kétoszlopos rácsa csak legalább 220 px kártyaszélességnél alkalmazható. 320/375/390 px képernyőn az olvasható egyoszlopos változat az elfogadott adaptáció. DOM-sorrendet megváltoztató masonry helyett normál CSS grid.

Az alsó nav magassága kb. 64–72 px + safe-area; a tartalom és toast ennek megfelelő alsó helyet kap. Teljes képernyős editorban a nav helyét a mentési sáv veszi át. `100dvh`, belső görgetés és virtuális billentyűzet melletti használhatóság szükséges; a CTA nem takarhatja a fókuszált mezőt. A közműválasztók tördelődnek, nem okoznak oldalszintű vízszintes görgetést.

## 6. Oldalak és interakciók

### Shell és navigáció

Közös menümodellből épül a desktop sidebar és a mobil alsó nav. Áttekintés mindig elérhető; Közművek/Beállítások a meglévő közműjog, Jegyzetek a friss notes hozzáférés alapján. Rejtett menüpont nem helyettesíti a DAL-védelmet. Mobil profilmenü biztosít kijelentkezést. Aktív állapot URL alapján, pontos `/app` egyezéssel és alroute-ok szegmenshatáros felismerésével.

Desktop topbar: kereső, Budapest szerinti aktuális dátum, profil; mobilon a keresés kompakt gombból nyílik, a notes oldal saját keresője látható. A globális keresés valódi jogosultságszűrt eredményeket ad: jegyzetcím/-tartalom, mentett hónap, szolgáltató és számlaszám; OAuth-adatokat és technikai forráshivatkozásokat nem keres. Minimum 2 karakter, 250–300 ms késleltetés, legfeljebb 10 találat domainenként; új kérés felülírja a korábbi eredményét. Cmd/Ctrl+K nyitás, Escape bezárás, fókusz-visszaadás.

A keresés új, külön végrehajtási csomag. A shell első szeletében nem jelenhet meg működést színlelő mező. A képen szereplő haranghoz nincs értesítési rendszer: addig elhagyandó, amíg a bővítési csomag elkészül; piros pont kizárólag valós olvasatlan eseményre jár.

### Landing és login

Nagy „Több idő a fontos dolgokra.” cím, rövid családi bemutató, Google-belépésre vezető `/login` CTA és `/app` link. Desktopon jobb oldali ház és perspektivikus, fiktív appelőnézet; mobilon külön crop/kompozíció, a CTA-t nem takaró előnézettel. Négy pasztell tartalomblokk csak megvalósult képességet állítson; a tervek/teendők a jegyzetek használati példái, nem külön naptárszolgáltatás. A biztonsági és működési hivatkozások valódi oldalszakaszokra vezetnek. Nincs kitalált árazás vagy felhasználószám.

A régi 20 másodperces animáció helyére statikus előnézet kerül. Login ugyanazon logót, petrol CTA-t, világos panelt és visszafogott otthonillusztrációt kapja. Google az egyetlen provider; konfigurációhiány és OAuth-hiba továbbra is látható, már hitelesített felhasználó `/app` címre kerül.

### Áttekintés

„Itt a teljes kép.” fejléc, sessionből származó köszöntés és házillusztráció. Desktopon 2 oszlop: havi közös költség + gyors műveletek; közműkártyák + hathavi költségdiagram; közelgő határidők + legutóbbi jegyzetek. Mobilon ugyanebben a sorrendben egy oszlop, a gyors műveletek 2×2 rácsban.

A havi közös kiadás a Budapest szerinti aktuális hónap mentett kimutatásából származik, beleértve az egyedi/sablonmásolt tételeket. Mentés nélkül „Ehhez a hónaphoz még nincs kimutatás”, nem nulla vagy korábbi hónap aktuálisként feltüntetve. A közműcsempék csak számlaköltséget mutatnak. A hathavi összes költségdiagram ugyanazt a fogalmat követi, mint a fő összegkártya; a közműdiagram külön megnevezést kap, ha csak közműveket mutat.

Változásjelző az előző naptári hónap összehasonlítható mentett adatából számolható; nulla alap vagy hiányos adat esetén „Nincs összehasonlítható adat”. Határidőlista ismert számlaesedékesség alapján, fizetettségi állítás nélkül. Jegyzetlista ugyanazt a tulajdonos/családi láthatóságszűrést használja, mint a notes feature. Jogosultság nélkül a megfelelő privát blokkok és gyors műveletek hiányoznak; a dashboard többi része működik.

### Közmű kezdőnézet és havi szerkesztő

Kezdőnézet: illusztrált fejléc, víz/gáz/villany/hulladék/egyéb váltó, fogyasztás/költség kapcsoló; kiválasztott kategória KPI-k és diagram; kategóriaáttekintés és mentett hónapok. Alapablak utolsó 6 naptári hónap, választható 12; hiányzó hónap jelzett hiány, nem nulla. Az aggregáció és a diagram ugyanazt a szűrt adatsort használja. Átlag csak ismert, beszámítható hónapokra, az elemszám feltüntetésével. Előző hat hónapos változás csak teljes, azonos lefedettségű adatoknál jelenik meg; a jelenlegi, legfeljebb 12 mentett hónapos lekérés hiányát nem pótolja becslés.

Mentett hónap megnyitása továbbra is az oldal részletállapotába vezet. Megosztható belső célhoz `?month=YYYY-MM` paraméter használható; kizárólag mentett hónapra, validált és jogosultságellenőrzött betöltéssel. Új aktuális kimutatás indítása külön explicit művelet; queryparaméter nem menthet és nem hozhat létre adatot. A hónapléptető mentett hónapok közt navigál, dirty állapotban megerősítéssel. Nincs tetszőleges múltbeli új hónap létrehozása ebben a redesignban.

Részlet: breadcrumb, hónapcím és választó; Gmail/PDF/kézi számlafelvétel; szerkeszthető számlakártyák; külön számla nélküli tételek; összegzés és Fele; Mentés és Exportálás. Mobilon minden művelet megmarad, az összegzés a számlák után kerül, rövid alsó műveletsávból is elérhető. A mobil 2 képen látható kategóriafókusz opcionális szűrés a hónapon belül; az összegzés mindig az egész hónapot mutatja, és ezt kiírja.

A számlakártya fejlécében szolgáltató, szolgáltatástípus, számlaszám, összeg és feldolgozási állapot. Belső mezők: fogyasztási időszak, fogyasztás/egység, esedékesség, számla típusa, forrás és meglévő bizonyíték/konfliktusjelzés. Összecsukott részletek mobilon megengedettek, validációs hiba a rejtett rész megnyitását okozza. Új egységár-adatmező nem szükséges; derivált arány csak ismert, nem nulla fogyasztásból, „számított fajlagos költség” néven adható.

Mentett feltöltött PDF nem tárolt: visszanyitáskor érthető „A feltöltött fájl ebben a munkamenetben már nem érhető el” állapot. Gmail-előnézet csak a meglévő védett folyamatból. Gmail csatlakoztatás és import felirata az aktuális kapcsolatot követi; nincs automatikus havi háttérimport.

### Jegyzetfal és editor

Íróasztal-illusztrált fejléc; kereső, Összes/Privát/Megosztott szűrő, Legutóbbi/Legrégebbi/Cím szerinti rendezés, rács/lista kapcsoló, Új jegyzet. A keresés és a számlálók az összes jogosultan látható jegyzetre vonatkozzanak, ne csak a betöltött 30 sorra. Ehhez új szűrt, lapozott DAL-lekérés kell; változó keresés/szűrés/rendezés új kurzort indít. Az azonos időpontú sorok stabil id-tiebreakert kapnak. Mentés/törlés után az aktív lekérdezés és számlálók újrabetöltődnek.

Kártya: pasztell felület, láthatóságbadge, dátum, cím, formázott előnézet, valódi szerzőnév és monogram. A hárompontos művelet csak saját jegyzeten kínál szerkesztést/törlést. Nincs ragasztószalag-motívum vagy elforgatás. A lista alternatíva ugyanazokat az adatokat és műveleteket tartalmazza.

Desktop editor legfeljebb 1040 px, kb. 2:1 osztással: balra cím és szöveg, jobbra láthatóság és szerző; alul Mégse/Mentés. Mobilon teljes képernyős dialog, egyoszlopos blokkok és saját alsó mentési sáv. A jelenlegi félkövér/dőlt/lista formázás és biztonságos renderelő marad; az előnézet ugyanazt a renderelőt használja. 120/5000 karakteres számláló, privát alapérték, mentési hiba után megőrzött draft és verzióütközés-kezelés kötelező.

A képeken látható címkézés, emlékeztető, képcsatolás, pipálható feladat, több résztvevő-avatar, aláhúzás és link új képesség, nem meglévő mező. Ezeket a 9. szakasz bővítési csomagjai kezelik. Hiányzó szolgáltatás helyén nem maradhat működést színlelő vezérlő.

### Beállítások, export és rendszerállapotok

Beállítások ugyanazon sans fejlécet, pasztell szekciójelölést és világos formpaneleket használják. A közös sablonok szerkesztése, alapértelmezett jelölése és hibakezelése megmarad; nincs képről kitalált profil-, tagság- vagy integrációadmin.

Exportmodal, PDF és PNG ugyanazt a petrol/világos arculatot követi. TXT adatai változatlanok. A vektoros PDF, magyar ékezetek, hosszú név/sok sor tördelése, részleges adatok, 2 MiB e-mail-limit, snapshot, címzett- és levéltartalom-előnézet, külön küldési kattintás továbbra is kötelező. Designmódosítás nem indíthat levelet vagy Drive-mentést.

Minden oldalnak van valódi betöltő, üres, részleges, hiba és jogosultsághiányos állapota. Skeleton a végső rács arányait követi. Hiba nem jelenhet meg üres listaként. Egységes toast stílus és megjelenítési stratégia szükséges, mobil nav fölötti pozícióval; a meglévő notes értesítések is biztosan kapjanak Toastert.

## 7. Mérnöki felépítés és adatfolyam

- A gyökérlayout marad HTML/font/téma felelősségű; az `/app` layout szerveroldali session- és menüjog-ellenőrzést végez. Route-címek, oldalkompozíció és kezdeti adatlekérés a `page.tsx` fájlokban maradnak.
- Megosztott elemek: márkajel, app topbar, mobil nav, oldalcím/illusztráció, státuszbadge, közös dialog és shadcn primitívek. Globális komponens csak több feature-ben vagy feature-függetlenül használt UI.
- Közműszámla és diagram a monthly-expenses feature-ben; jegyzetkártya/editor a notes feature-ben; landing dekoráció a landing feature-ben. Dashboard adatait az illetékes feature DAL-jából kell kérni, nem UI-ból hívott nyers operationsből.
- Olvasás: RSC/Server Function → hitelesített DAL query → feature Drizzle operations → DB. Írás: RHF/Zod form → DAL Server Action → szervervalidáció és jogosultság → feltételes/tranzakciós írás.
- A kereső új keresési koordinációja a saját `src/features/search` alatt, a feature-ök DAL-jain keresztül működik. Ne legyen az app layoutban minden számla/jegyzet előtöltve. Kliensoldali HTTP-frissítés esetén vékony Route Handler és SWR; puszta vizuális váltáshoz nincs új API/provider.
- A dashboard független feature-olvasásai párhuzamosak, külön hibát adhatnak. Ha egymástól függetlenül streamelhető panelek készülnek, indokolt testvér Suspense; route-blokkoló lekéréshez `loading.tsx`.
- Felhasználófüggő jegyzet és keresési eredmény nem kerül közös felhasználóközi cache-be. Böngészőnek csak a rendereléshez szükséges DTO jár; OAuth token, teljes user-sor és technikai forrásadat nem.
- Klienshatár a navigáció-interakció, keresés, formok és választók körül; teljes route nem válik klienskomponenssé. Dirty form megőrzése/eldobásának megerősítése minden új navigációs belépési pontnál kötelező.

## 8. Illusztrációk, hozzáférhetőség és teljesítmény

A referenciákban lévő ház, íróasztal/növény/bögre, nappali/kutya és sidebar növény külön, tiszta assetként szükséges. A megadott képek kész kompozíciók, nem kész, átlátszó illusztrációs források. Implementáció elején külön kivágott/újraalkotott asseteket kell előállítani a referenciák alapján, beégetett UI-szöveg és személyes adat nélkül. Javasolt hely `public/images/homebase/`; assetjegyzék rögzíti a forrást, felhasználást, méretet és mobil cropot. Képgeneráláskor az imagegen skill használatos; logó és Lucide ikon marad vektoros.

`next/image`, explicit méret/arány és `sizes`, csak a fő LCP-kép előtöltése a telepített verzió API-ja alapján; kisebb dekorációk lazy. A landing-előnézet külön fiktív tartalmú asset vagy HTML-kompozíció, nem a személyes adatokat tartalmazó eredeti kép közvetlen publikálása. Hero-asset célsúly legfeljebb kb. 250 KB, kis dekoráció kb. 80 KB; a képminőség a végső összevetésen ellenőrzendő.

Magyar nyelv, egy h1, nav/main/section szemantika, skip link. Minden kontroll billentyűzettel használható, legalább 44 px célterülettel. Normál szöveg kontrasztcél 4,5:1; nagy szöveg és szükséges vizuális vezérlőjel 3:1. Szín mellé mindig felirat/ikon. Dekoráció `alt=""`; nincs teljes képként felolvasott UI. Diagramhoz hozzáférhető adattábla. Dialog title/description, fókuszcsapda, Escape és fókuszvisszaadás. Reduced-motion mellett nincs szükségtelen mozgás; 200%-os zoomnál és hosszú magyar tartalomnál sincs levágott művelet.

## 9. Új képességek és külön bővítési csomagok

Az alap redesign része a valódi dashboard, globális keresés, notes keresés/szűrés/rendezés/listanézet és új reszponzív szerkesztő. Ezek meglévő adatokra épülő lekérdezés- és UI-bővítések; a teljes referenciákhoz további domainfunkciók kellenek:

| Csomag | Szükséges mérnöki munka | Bevezetési feltétel |
| --- | --- | --- |
| Címkék | Tulajdonoshoz kötött normalizált címke és note–tag kapcsolat, keresés/lapozás/count, Zod, DAL, editor | Külön feature-specifikáció és sémabevezetési eljárás |
| Checklist | Strukturált listaelemek és checked állapot, tulajdonosi írás, verzióütközés, régi szöveg kompatibilitása | Előbb adatformat-döntés; családi olvasó nem kap szerkesztési jogot |
| Formázásbővítés | Aláhúzás/link AST és engedélyezési lista, URL-protokoll validáció, azonos preview-renderelés | Biztonságos round-trip és regressziótesztek |
| Képcsatolás | Privát tároló, engedélyezett formátum/méret, auth-védett kiszolgálás, törlési lifecycle | Tároló és hozzáférési terv; nem publikus assetkönyvtár |
| Emlékeztető/értesítés | Szerveridő, Europe/Budapest UI, ütemező, deduplikált esemény, olvasott állapot | Külön háttérfolyamat és kézbesítési döntés; addig nincs harangbadge |
| Résztvevő-avatarok | Igazolt családtaglista és szükséges DTO | Meglévő megosztás nem válik egyéni címzettes megosztássá |

E csomagok tervezési helye szerepel a teljes app célképében, de az első redesign kiadás ezek nélkül is önállóan használható. Sémát vagy környezetet igénylő csomag végrehajtása előtt jelezni kell a projekt védett fájlhatárát; `.env*` és `drizzle/migrations` kézi módosítása nem megengedett. A jelen feladat csak dokumentumkészítés, nem adatbázis-bevezetés.

## 10. Elfogadási feltételek

1. Minden felsorolt route, loading/hiba/üres állapot, szerkesztő és export az új designrendszert követi; nincs bent maradt serif, krém–barna shell vagy eltérő legacy dialog.
2. A 11 kép szerepe visszakövethető a referenciamátrixból és az implementációs csomagokból. Desktopon és mobilon a domináns kompozíció felismerhető, nem csupán azonos színű.
3. Közös jogosultságszűrt desktop/mobil nav, helyes aktív állapot, mobil profil/kijelentkezés, takarásmentes safe-area.
4. Közműimport, kézi szerkesztés, mentés, visszatöltés, törlés, verziókonfliktus, sablonmásolat, PDF-előnézet-korlát és explicit e-mail-küldés megmarad.
5. Dashboard és keresés csak valódi, hozzáférhető adatot mutat; hiányzó adat nem becsült nulla. Vegyes fogyasztási egységek nem keverednek.
6. Notes privát alapérték, tulajdonosi írás, friss tagságellenőrzés, biztonságos formázás és draftmegőrzés működik az új editorral is.
7. 320/390/768/1024/1440 px és 200% zoom mellett olvasható tartalom, elérhető műveletek, nincs oldalszintű vízszintes overflow. A valós szöveghossz fontosabb a hibás képi mintánál.
8. Az alapkiadás és a még nem implementált bővítések állapota egyértelmű; nincs dekoratív, működést színlelő kontroll.

Helyi verzióforrások: `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`, `11-css.md`, `12-images.md`. Implementációkor az érintett Server/Client, caching, navigáció és image API dokumentációját ismét a telepített csomagból kell ellenőrizni.
