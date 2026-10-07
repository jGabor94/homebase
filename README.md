# Homebase

A Homebase egy privát, családi használatra készülő webalkalmazás. Célja, hogy egy helyre gyűjtse a mindennapokat megkönnyítő funkciókat: elsőként a havi közműszámlák kezelését és elszámolását, valamint a személyes és családi jegyzeteket.

## Jelenlegi állapot

Frissítve: **2026-10-07**. Az aktuális működést ez a README és a feature dokumentációja írja le. A [korábbi átadási jegyzet](.claude/handoffs/2026-10-06-182233-monthly-expenses.md) az azóta továbbfejlesztett állapot történeti háttere.

A publikus főoldal (`/`) bemutatja az alkalmazást; a kizárólag Google-belépést kínáló `/login` oldal után az `/app` alatti családi dashboard látványterve jelenik meg fiktív közműadatokkal, diagrammal és jegyzetekkel. A **Havi kiadások** oldal (`/app/monthly-expenses`) már külön, bejelentkezéssel védett funkció: kézi számlafelvitel, PDF-beolvasás, saját Gmailből indított import és szerkeszthető havi összesítés. Számla nélkül előre felvehető névvel és összeggel egy ismert tétel; amikor megérkezik a számlája, az előre felvett sort kézzel kell törölni. A kimutatás egyelőre csak a nyitott oldalon él, újratöltéskor elvész; exportja későbbi funkció. A Gmail és az AI használatához saját konfiguráció szükséges; a számlatörténet, tartós mentés és jegyzetkezelés későbbi feladat. Részletek a [feature leírásában](src/features/monthly-expenses/README.md), a megjelenés szabályai a [design dokumentumban](.agents/DESIGN.md).

A `/` landing mindenki számára megtekinthető; egy 20 másodperces, néma, szüneteltethető animáció lebegő, perspektívában mozgó alkalmazásnézetekkel és fiktív adatokkal mutatja be a közműösszesítést és a készülő jegyzeteket. Csökkentett mozgás beállításánál statikus előnézet jelenik meg. A `/login` csak vendégeknek jelenik meg; hitelesítve `/app` címre irányít. Az `/app` és aloldalai NextAuth proxy-védelemmel és szerveroldali ellenőrzéssel működnek. A régi `/monthly-expenses` és `/settings` címek az új app útvonalakra irányítanak. Részletek: [app routing és auth](src/docs/engineering/active/app-routing-auth-sidebar.md).

## Havi közmű kimutatás

Az app sidebarjából elérhető **Beállítások** oldalon (`/app/settings`) a család közös átalányai és más tételsablonjai tartósan menthetők. Minden, a Havi kiadásokhoz jogosult felhasználó ugyanazt a listát kezeli. Az összegzésben mentett sablon vagy egyedi tétel választható; a havi kimutatásba kerülő másolat megőrzi a hozzáadáskori nevet és összeget.
Az alapértelmezettnek jelölt sablonok automatikusan, külön másolatként kerülnek az új kimutatásba. A havi összegzés a számlákat és a felvett tételeket tartalmazza; nincs automatikusan hozzáadott hitelösszeg.

Az **Összegzés** tételei egy sorban jelennek meg névvel, szerkeszthető összeggel és törlésgombbal. A mentett sablon neve sima szöveg, az egyedi tételé szerkeszthető. A „Tétel hozzáadása” megnyitja a választót, és automatikusan betölti a közös sablonokat; külön frissítésgomb nincs. Az „Összesen” után egyetlen „Fele” sor látszik, egész forintra kerekített összeggel. A háttérben a számítás fillérpontos marad. A közös sablonok működését a [mérnöki dokumentáció](src/features/monthly-expenses/docs/engineering/active/expense-presets.md) részletezi.

A Gmail OAuth-hozzáférése a meglévő account táblában megmarad; ez különbözik a még hiányzó számlamentéstől. Mentett kapcsolatnál az eszköztár e-mailes beolvasást kínál, nem új összekapcsolást. Az adatkinyerés jelenleg kódos feldolgozással indul, az AI hiányos eredménynél fallback. Az AI elsődlegessé tétele felmerült, de nem lett implementálva; a PDF-küldés költségbecslése nyitott kérdés.

A számlák kategóriacímek és üres helyőrzők nélkül jelennek meg; az oldalsáv típus, szolgáltató és összeg szerint sorolja őket. **Szolgáltatás típusa**: víz, gáz, villany, hulladék vagy egyéb. **Számla típusa**: normál, jóváírás, helyesbítő vagy sztornó. A két mező külön adat, mindkettő szerkeszthető.

Az elsődleges fejlesztési cél a meglévő **Havi közmű kimutatás** plugin munkafolyamatának webes megvalósítása. A webalkalmazás ezt tartós adatbázis-tárolással, visszakereshető számlatörténettel, diagramokkal és kimutatásokkal egészíti ki.

### Tervezett munkafolyamat

1. A felhasználó kiválasztja az elszámolás évét és hónapját.
2. A rendszer a csatlakoztatott Gmail-fiókból összegyűjti a támogatott szolgáltatók számlaértesítőit, és feldolgozza a hozzáférhető számlákat.
3. A webfelületen áttekinthetők a kinyert adatok és az esetleges hiányok.
4. A számlaadatok adatbázisba kerülnek, és elkészül a havi költségösszesítés, valamint a megosztott költségből utalandó rész.
5. A kimutatás a webfelületen megtekinthető, PNG-ként letölthető, és a plugin mintájára Google Drive-ba menthető.
6. A mentett kimutatáshoz e-mail-értesítő készülhet. A küldés előtt a felhasználó látja a címzettet és a teljes tartalmat, majd külön jóváhagyja a küldést.

A Gmail- és Drive-integrációhoz a webalkalmazásban is megfelelő hozzáférést kell kialakítani; a Codexben csatlakoztatott plugin önmagában nem ad hozzáférést a webes rendszernek.

### Az elszámolás alapjai

A plugin jelenlegi működése adja a webes változat kiinduló szabályait:

- Támogatott tételek: **MVM gáz**, **MVM villany**, **ALFÖLDVÍZ víz/szennyvíz** és **MOHU hulladék**. A Telekom és más szolgáltatók számlái nem részei ennek az összesítésnek.
- A havi besorolás a számlaértesítő kiküldésének hónapja alapján történik, **Europe/Budapest** időzónában. A fogyasztási időszak ettől eltérhet.
- A már kifizetett számlák is beleszámítanak a közös költségbe. Az összesítés a számla bruttó összegét használja.
- Az összesítés a számlákat és az előre felvett havi tételeket tartalmazza; nincs automatikusan hozzáadott hitelösszeg.
- A költségmegosztás **50–50%**: a számítás egész fillérrel történik, a „Fele” kijelzés egész forintra kerekít. Például 109 337 Ft összesen esetén 54 669 Ft jelenik meg.
- Ugyanaz a számla csak egyszer számítható be. Az emlékeztetők, helyesbítések, sztornók és jóváírások kezelésének el kell kerülnie a dupla elszámolást.
- Hiányzó adatot a rendszer jelez, és nem helyettesít becsült értékkel. A kimutatás készítése nem indít számlafizetést.

### Tárolandó adatok és kimutatások

A tervezett számlanyilvántartás szolgáltatónként tárolja a számlaszámot, a fizetendő bruttó összeget, a fizetési határidőt, a fogyasztási vagy elszámolási időszakot, valamint a kiküldési dátumot és az elszámolási hónapot. A számla kelte, kiküldése és fogyasztási időszaka külön adatként kezelendő.

A forráslevélhez vagy számladokumentumhoz tartozó kapcsolat segíti az adatok visszaellenőrzését. A havi hitelösszeg és költségmegosztás is az adott elszámoláshoz tartozik, így egy későbbi beállításváltozás nem írja át a korábbi hónapokat. Az ismételt feldolgozás nem hozhat létre ugyanarról a számláról újabb példányt.

A tárolt adatokból a következő nézetek készülnek majd:

- havi és éves közműköltségek;
- szolgáltatónkénti bontás és költségarányok;
- hónapok közötti összehasonlítás és költségváltozás;
- közművek, hitel és teljes közös költség külön megjelenítése;
- korábbi elszámolások és utalandó összegek visszakeresése.

## Privát és családi jegyzetek

A másik kezdeti funkció jegyzetek létrehozása, szerkesztése és törlése lesz, kétféle láthatósággal:

| Láthatóság | Hozzáférés | Példa |
| --- | --- | --- |
| Privát | Csak a jegyzet tulajdonosa láthatja. | Személyes ötletek, saját emlékeztetők. |
| Családdal megosztott | A család tagjai láthatják. | Bevásárlási jegyzet, közös program részletei, háztartási tudnivalók. |

A jegyzet tulajdonosa szabályozza a láthatóságot. A közös szerkesztés jogosultságainak részletei a funkció tervezésekor tisztázandók.

## Hozzáférés és adatkezelés

A Homebase a család saját használatára készül. A számlákhoz és a megosztott jegyzetekhez családi hozzáférés szükséges; a privát jegyzeteket kizárólag a tulajdonosuk érheti el. A jogosultságokat szerveroldalon is érvényesíteni kell.

A számlaadatok, a jegyzetek és az integrációs hozzáférések személyes adatok. Ezek nem kerülhetnek a forráskódba vagy a repository dokumentációjába. A megosztható kimutatás csak az elszámoláshoz szükséges adatokat tartalmazza; a technikai forráshivatkozások a belső nyilvántartásban maradnak.

## Technológiai alapok

A projekt jelenlegi függőségei:

- **Next.js 16.3.6**, App Router és **React 19.2.8**;
- **TypeScript**;
- **Tailwind CSS 4**;
- **PostgreSQL**, **Drizzle ORM** és Drizzle Kit;
- **NextAuth / Auth.js** a hitelesítéshez;
- **Zod** az adatok validálásához.

A számlabeolvasás Vercel AI SDK-t és AI Gatewayt, a PDF-feldolgozás `pdf-parse` csomagot, az űrlap react-hook-formot használ. A projekt feature-first moduláris monolitként szerveződik; a részletes fejlesztési szabályok az [AGENTS.md](AGENTS.md) fájlban találhatók.

## Helyi fejlesztés

A függőségek telepítése és a fejlesztői szerver indítása:

```bash
npm install
npm run dev
```

Az alkalmazás alapértelmezetten a [localhost:3000](http://localhost:3000) címen érhető el. A publikus landing mellett az `/app` áttekintés mock adatokat mutat; a Havi kiadások funkció beállításait és jelenlegi korlátait a [feature dokumentációja](src/features/monthly-expenses/README.md) tartalmazza.

## Tervezett fejlesztési sorrend

A legutóbbi funkcióteszt-futtatás **41 sikeres tesztet** adott; a Gmail-állapotkezelés típusellenőrzése és célzott lintje is sikeres. Két MVM villany- és egy ALFÖLDVÍZ-PDF élő Gmail-letöltése, beolvasása és duplikációszűrése igazolt. A keltezés javítása után mindhárom eredeti PDF kódosan, forrásbizonyítékkal olvasható. Élő gáz-, MOHU-, szkennelt PDF-próba és a teljes bejelentkezett böngészős munkafolyamat még nincs igazolva. A későbbi felirati UI-módosítások és a dokumentációfrissítés után nem indult új futtatás.

1. Családi bejelentkezés és hozzáférési jogosultságok kialakítása.
2. Havi közműszámlák feldolgozása, adatbázis-tárolása és webes elszámolása.
3. A közműadatokból diagramok, összehasonlítások és korábbi kimutatások megjelenítése.
4. A plugin PNG-exportjának, Drive-mentésének és jóváhagyás utáni e-mail-küldésének webes megvalósítása.
5. Privát és családdal megosztott jegyzetek bevezetése.

A további funkciók a család tényleges mindennapi igényei alapján kerülnek be az alkalmazásba.
