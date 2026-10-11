# Havi összegzés exportálása

Frissítve: **2026-10-10**.

## Cél és adatkezelési határ

Az aktív kimutatás **Összegzés** oldalsávján **Mentés** és **Exportálás…** gomb jelenik meg. A Mentés a teljes `invoices` és `additionalItems` állapotot tárolja; az összesítés újranyitáskor ezekből számolódik. Az adatmodell, verzióütközés és adatbázis-hozzáférés a [havi kimutatásmentési specifikációban](monthly-report-storage.md) szerepel.

Az export forrása az oldalsó összegzőben látható adatok pillanatképe: a hónap, a számlák szolgáltatástípusa, szolgáltatója és kijelzett összege, az összes számla nélküli tétel neve és összege, az **Összesen** és az egész forintra kerekített **Fele**. A közös tételek, például hitel, akkor szerepelnek, ha az aktuális összegzőben is jelen vannak. Az export nem az eredeti számla-PDF-eket vagy a teljes számlaadatbázis-modellt csomagolja.

A számlasorokat az aktuális számlaadatokból származó **számlaszám**, **fizetési határidő** és **fogyasztási időszak** egészíti ki mindhárom exportformátumban. A határidő `ÉÉÉÉ.HH.NN.` alakban jelenik meg, időzóna-konverzió nélkül; az időszak a megadott szöveget őrzi. Hiányzó alapadatnál „Nincs megadva” szerepel. A számla nélküli tételek nem kapnak ilyen mezőket.

## Felhasználói folyamat

1. Az Exportálás… megnyit egy fókuszkezelt, billentyűzettel használható modalt; az aktuális összegző adatairól pillanatkép készül.
2. PDF, kép (PNG) vagy szöveg (UTF-8 TXT) választható. A magyar ékezetek minden formátumban megmaradnak. Hosszú szöveg és sok sor nem vágható le; a PDF többoldalas lehet.
3. A **Letöltés** a kiválasztott fájlt menti. Az **E-mail küldése** ugyanennek a fájlnak a bájtjait használja mellékletként.
4. A címzett rögzített: **sz.marcsi85@gmail.com**. Magyar tárgy és levélsablon tartalmazza az elszámolás hónapját és a kijelzett összegeket. A modal a címzettet, tárgyat és teljes levélszöveget megmutatja a küldés előtt.
5. Küldés csak a felhasználó gombnyomására történik, siker- vagy hibaüzenettel. Folyamatban lévő művelet alatt ismételt kattintás tiltott.

Hiányos számla vagy tétel exportálható: a kijelzett hiányjelzés megmarad, nem keletkezik becsült összeg vagy újraszámolt „teljes” eredmény. Import közben az export nem nyitható meg. Túlcsordulási figyelmeztetés az exportban is látható. Az exportálás nem ment adatbázisba.

## Architektúra és hozzáférés

A kliens a pillanatképből készíti el a TXT/PNG/PDF fájlt. A PDF szövege és alakzatai vektorosak, nagyításkor élesek, a szöveg kijelölhető; nem oldalnyi PNG-képek beágyazásából áll. A helyi Liberation Sans normál és félkövér TTF a PDF-be ágyazva őrzi meg a magyar ékezeteket, külső fontszolgáltatás nélkül. A fontok és SIL OFL licencük a `public/fonts` mappában vannak.

A PDF és a nagy felbontású PNG közös, mobilra tervezett Homebase-elrendezést követ: 360 egység szélesség, keskeny margó, kompakt betűméretek, egyoszlopos kártyák. A kártya bal felső részén szerepel a név, a jobb felső sarkában vele egy sorban az összeg; a számlák neve félkövér, alapadataik a fejléc alatt jelennek meg. A két fejlécmező külön szélességet kap, így hosszú név vagy összeg esetén sem fedik egymást; az Összesen és Fele kártyákon nagy méretű érték jelenik meg. Krém alap, barna szöveg, terrakotta kiemelés és tagolt számla- és tétellista segíti az olvasást. A csatolt példa a tagolás inspirációja, nem másolandó sablon. A számlakártyák a név alatt kisebb, visszafogott színű sorokban mutatják a számlaszámot, a fizetési határidőt és a fogyasztási időszakot. A hosszú nevek tördeltek, a hosszú PDF 360 × 640 pontos álló oldalakra lapozódik; a 1296 pixel széles PNG magassága a tartalomhoz igazodik. Az exportmodal választói és műveletgombjai mobilon egymás alatt, szélesebb képernyőn egymás mellett jelennek meg.

A PNG Canvas-rajzolással készül, a PDF-könyvtár és fontok csak igény szerint töltődnek be. A letöltés Blob-alapú, a lokális URL felszabadul.

A szokásos havi PDF először tartalomhoz igazított, egyoldalas elrendezést kap: a lap magassága követi a tételeket és a végösszegeket, így az Összesen és Fele nem kerül külön oldalra a rögzített lapmagasság miatt. Legfeljebb 960 pontos tartalom egy oldalon marad; ennél hosszabb kimutatás továbbra is lapozott, olvasható exportot ad.

A levélküldés feature DAL Server Action, a szerver ellenőrzi a munkamenetet, a közműimport-jogot és a kijelölt Gmail-postafiók tulajdonosát. A rögzített címzett, MIME-típus és fájlnév szerveroldali szabály, kliens nem választhat más címzettet. A bemenet Zod-validált; a base64, méret és fájlformátum külön ellenőrzött. A fájl nem kerül tartós tárolóba, naplóba vagy Drive-ba.

A meglévő `gmail.readonly` kapcsolat változatlanul elég importhoz. Küldéshez külön, felhasználó által indított OAuth-consent kér `gmail.send` engedélyt, az olvasási scope megőrzésével. A Google-átirányítás eldobhatja a helyi kimutatást; előtte a felület figyelmeztet, és letöltést javasol. A tokenfrissítés, lejárat és postafiók-azonosság ellenőrzése a meglévő Google-access infrastruktúrát használja. `.env*` fájlokat ez a munka nem módosít.

A Gmail API RFC MIME-üzenetet fogad base64url `raw` mezőben, melléklettel: [hivatalos küldési leírás](https://developers.google.com/workspace/gmail/api/guides/sending), [scope-ok](https://developers.google.com/workspace/gmail/api/auth/scopes). Automatikus újraküldés nincs; hálózati bizonytalanság esetén a felület nem állíthat sikeres kézbesítést. A melléklet legfeljebb **2 MiB** lehet, a meglévő 4 MB-os Server Action kéréslimiten belül maradó base64 bemenettel. Nagyobb fájlnál az e-mail küldése hibát ad, a letöltés továbbra is elérhető.

Kapcsolódó dokumentum: [számlabeolvasás](invoice-import.md), [implementáció](../../implementation/archive/summary-export.md).
