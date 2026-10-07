# Homebase design

## Irány és referencia

A Homebase privát családi tér: barátságos, otthonos és nyugodt, nem vállalati dashboard. A főoldal vizuális referenciája az `output/imagegen/homebase-dashboard-v2.png` kép. A felület valódi HTML-elemekből épül, nem a képből készült háttér.

Minimalista csempés elrendezés, jól olvasható tartalom, sok levegő. Kerülendők a gradiensek, glassmorphism, neon/lila hangsúlyok, túlzott animációk, marketingblokkok és dekorációs zsúfoltság.

## Színek és téma

| Token | Érték | Szerep |
| --- | --- | --- |
| background | #faf6ee | Meleg krém oldalháttér |
| foreground | #42271e | Sötétbarna fő szöveg |
| card | #fffcf7 | Elefántcsont csempe |
| muted-foreground | #796d61 | Másodlagos szöveg |
| border | #e9dfd1 | Finom meleg keretek |
| primary | #b5573f | Terrakotta elsődleges művelet |
| primary-foreground | #ffffff | Gombfelirat |
| accent | #78815c | Olívazöld diagram és navigáció |
| note-yellow | #fff4d6 | Bevásárlási jegyzet |
| note-peach | #fce9dd | Családi programjegyzet |
| note-sage | #edf0dc | Személyes jegyzet |

A globális CSS-ben shadcn-kompatibilis szemantikus változók és Tailwind v4 `@theme inline` mapping legyen. Elsőként egységes világos téma készül; az operációs rendszer sötét módja nem változtatja meg automatikusan a képen jóváhagyott megjelenést.

## Tipográfia és felületek

- Törzsszöveg: a meglévő Geist sans betűcsalád; címek: visszafogott Georgia serif, amely magyar ékezeteket is megjelenít, új fontletöltés nélkül.
- A főcím nagy, de nem marketing-hero: „Jó itthon.”, alatta „Számlák, tervek és minden, ami közös.”
- Csempecímek 26–30 px, törzsszöveg 15–16 px, másodlagos címkék 12–14 px. Mobilon a főcím kisebb.
- Csempesarkok 18–20 px, egy pixeles keret, nagyon finom meleg árnyék. Gombok és címkék kisebb lekerekítést kapnak.
- Tartalomszélesség legfeljebb 1280 px, csempék között 20–24 px. Desktopon 24–28 px belső tér, mobilon 20 px.
- Lucide vonalas ikonok. A házikó a márkajel része, egy apró nap a köszöntésnél az egyetlen hangsúlyos dekoráció.

## Főoldal

1. Fejléc: homebase márkajel, Áttekintés / Közművek / Jegyzetek navigáció, J monogramos profiljelzés.
2. Köszöntés és a bemutatott hónap: 2026. szeptember.
3. Desktopon két oszlop: kb. 58% „A havi közös”, 42% „Így alakult a rezsi”. Tablet és mobil méreten a panelek egymás alá kerülnek.
4. Számlák: gáz 12 400 Ft, villany 18 600 Ft, víz 8 200 Ft, hulladék 4 800 Ft; közművek összesen 44 000 Ft. Hitel 81 000 Ft. Teljes összeg 125 000 Ft, utalandó fele 62 500 Ft. A generált kép 124 000 / 62 000 Ft összege számtani hiba, a megvalósítás a tételekből számolja a helyes összeget.
5. Hat havi egyszerű olívazöld oszlopdiagram, hitel nélkül. A tengely 0–80 000 Ft, a szeptemberi oszlop 44 000 Ft. Hozzáférhető szöveges megfelelő szükséges.
6. „A hűtőajtón” jegyzetrész, „Közös és saját jegyzeteink” alcímmel. Desktopon három csempe, kisebb képernyőkön egymás alatt: Bevásárlás (családi), Hétvégi program (családi), Ötletek (privát).

## Mock működés és hozzáférhetőség

- A főoldal kizárólag fiktív mintaadatokat használ. Ezt egy visszafogott rövid megjegyzés jelzi.
- A navigáció létező oldalszakaszokhoz vezet. Még nem megvalósított művelet nem tettetheti az adatmentést vagy levélküldést; a bemutató műveletek legyenek egyértelműen letiltva vagy helyi, működő előnézetet nyissanak.
- Nem része ennek a lépésnek a Gmail, Drive, hitelesítés, adatbázis, valódi jegyzetszerkesztés vagy hónapváltás.
- Magyar dokumentumnyelv, szemantikus fejléc/nav/main/section, egy h1, következetes címsorhierarchia.
- A privát/családi állapot szöveggel és ikonnal is jelenjen meg. Dekorációs ikonok ne kerüljenek a képernyőolvasó felolvasásába.
- Billentyűzettel használható navigáció, látható fókusz, legalább 44 px interaktív célpontok, elegendő kontraszt, vízszintes oldalgörgetés nélkül.
- Stílusok a JSX Tailwind utility osztályaiban; globális CSS kizárólag a témához és alapbeállításokhoz. Ne kerüljön be nagy diagramkönyvtár egy statikus mock diagram miatt.

