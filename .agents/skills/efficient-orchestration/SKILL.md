---
name: efficient-orchestration
description: Tokenhatékony orchestráció kódolási, hibakeresési, refaktorálási, tesztelési és repository-módosítási feladatokhoz. Alapértelmezett orchestrátorként Sol Mediumot használ, és csak akkor delegál, ha az olcsóbb vagy megbízhatóbb a közvetlen végrehajtásnál.
---

# Hatékony orchestráció

Te vagy az elsődleges orchestrátor. Te felelsz a scope-ért, az architektúráért, a feladatbontásért, az integrációért, az ellenőrzésért és a végső eredményért.

# FONTOS! Ha nem tudsz LUNA modellelt létrehozni, jelezd nekem, és kezdeményezz interakciót!

## Alapértelmezett modellek

- Az elsődleges orchestrátor **Sol Medium**.
- A kisebb, jól körülhatárolt módosításokat is kiszervezheted **Luna High** modellnek. (CÉL A TOKENHATÉKONYSÁG!!!!)
- A jelentősebb implementációt delegáld **Luna High** modellnek.
- **Luna xHigh** csak valóban nehéz, többfájlos vagy hosszabb implementációhoz használható.
- Sol Mediumnál erősebb modellre csak konkrét kudarc vagy feloldatlan architekturális akadály után válts.
- Sol xHigh, Max vagy Ultra alapértelmezésben kerülendő, mert növelheti a tokenfogyasztást, a scope creepet és a túlbonyolítást.

## Útválasztás

Mindig a legolcsóbb, még megbízható megoldást válaszd.

### 1. Közvetlen út — alapértelmezett

Dolgozz alügynök nélkül.

Használd például:

- kérdésekhez és repository-feltérképezéshez;
- kisebb vagy egyfájlos módosításokhoz;
- egyszerű hibajavításhoz;
- Git-műveletekhez;
- célzott tesztekhez;
- egyértelmű refaktoráláshoz.

Ne hozz létre agent workflow-t, ha a delegálás többe kerülne, mint a közvetlen megoldás.

### 2. Implementációs út

Egyetlen, pontosan körülhatárolt munkacsomagot delegálj Luna Highnak (fast mode).

Használd, ha:

- több kapcsolódó fájlt kell módosítani;
- az implementáció jelentős, de az architektúra már tiszta;
- a feladat nagy része ismétlődő kódolás vagy tesztelés;
- a delegálás csökkenti Sol kontextus- és tokenhasználatát.

Sol Medium továbbra is felel a tervezésért, az architekturális döntésekért, az integrációért és a végső review-ért.

### 3. Összetett implementációs út

Luna xHigh csak akkor használható, ha Luna High várhatóan kevés lenne, mert a feladat valóban nehéz, több lépcsős vagy nagyobb, de jól körülhatárolt területet érint.

Ne válassz xHigh effortot pusztán azért, mert a feladat fontos.

### 4. Párhuzamos út

Legfeljebb két implementációs alügynököt használj.

Csak olyan független munkacsomagokat futtass párhuzamosan, amelyek:

- nem módosítanak azonos fájlokat;
- nem függenek közös, még eldöntetlen kérdéstől;
- külön ellenőrizhetők és integrálhatók.

Ne indíts több agentet ugyanannak a feladatnak a párhuzamos megoldására.

## Munkacsomagok

Az implementációs agent csak a szükséges kontextust kapja meg:

- pontos cél;
- releváns fájlok vagy könyvtárak;
- elvárt működés;
- fontos korlátozások;
- kifejezett nem-célok;
- elfogadási feltételek;
- célzott ellenőrző parancsok.

Kérj rövid befejezési jelentést:

- módosított fájlok;
- fontos implementációs döntések;
- lefuttatott tesztek és eredmények;
- megmaradt kockázatok vagy blokkolók.

Ne kérj hosszú magyarázatot, feladatismétlést, spekulatív újratervezést vagy kapcsolódó, de nem kért fejlesztéseket.

## Végrehajtási szabályok

- Delegálás előtt vizsgáld meg a repository releváns részét.
- A nagy feladatokat bontsd kicsi, külön ellenőrizhető szeletekre.
- Javításkor ugyanazt az agentet használd újra, amíg a meglévő kontextusa hasznos.
- Javítási körben csak a hibás ellenőrzést és a szükséges eltérést add át.
- Ne engedj scope-bővítést vagy kéretlen refaktorálást.
- Ne módosíts nem kapcsolódó fájlokat.
- Teljes körű ellenőrzés helyett részesítsd előnyben a célzott tesztet, type-checket és lintet.
- Teljes production build csak külön kérésre, publikálás előtt vagy széles architekturális változás után fusson.
- Állj meg, amikor az elfogadási feltételek teljesültek.

## Ellenőrzés

- Mindig a repository `AGENTS.md` fájljában meghatározott ellenőrzési szabályokat kövesd.
- Ne futtass automatikusan buildet, lintet, typechecket vagy teszteket minden feladat végén.
- Az orchestrátor a feladat jellege és az `AGENTS.md` alapján dönti el, hogy szükséges-e ellenőrzés.
- Az implementációs alügynök csak az orchestrátor által kifejezetten megadott ellenőrzéseket futtathatja.
- Az alügynök saját döntésből nem futtathat teljes buildet, teljes lintet, typechecket vagy teljes tesztcsomagot.
- Felületi módosításnál elsődlegesen böngészőben ellenőrizd a megjelenést és a konzolhibákat.
- Szükség esetén csak a módosítással érintett fájlokat vagy területet linteld.
- Csak akkor futtass további ellenőrzést, ha alapos okod van feltételezni, hogy a módosítás hibát okozhat.
- Commit előtt mindig futtass lintet és typechecket.
- Commit előtt nem kötelező buildet futtatni.
- Git push előtt mindig futtass buildet.
- Nagy vagy komplex feladat után futtass buildet.
- Ha a felhasználó kifejezetten kér ellenőrzést vagy buildet, hajtsd végre.
- Soha ne állítsd, hogy egy ellenőrzés sikeres volt, ha azt nem futtattad le.

## Hiba és eszkaláció

Két sikertelen javítási vagy tesztelési kör után tekintsd az agentet elakadtnak.

Ezután csak egyet válassz:

- egyszer cseréld le egy új Luna agentre, szűkebb munkacsomaggal;
- a konkrét blokkolót add át egy Sol végrehajtónak;
- a blokkolt részt oldd meg közvetlenül Sol Mediummal.

Legfeljebb egy Sol implementációs fallback használható.

Erősebb Sol effort csak ehhez indokolt:

- feloldatlan architektúra;
- bizonytalan, több területet érintő változás;
- olcsóbb útvonalak után is nehéz hibakeresés;
- biztonságkritikus döntés;
- jelentős következményű végső ellenőrzés.

## Tokentakarékosság

- Ne használj alügynököt, ha a közvetlen munka olcsóbb.
- A legalacsonyabb, még megbízható modellt és effortot válaszd.
- Ne add át a teljes repositoryt, ha néhány célzott fájl elég.
- Kerüld az ismételt repository-szkennelést és a párhuzamos kutatást.
- Ne kérj narrációt a rutinmunkáról.
- Kis feladathoz ne generálj nagy tervdokumentumot.
- A terv mérete legyen arányos az implementációval.
- Több munkamenetes feladatnál használj rövid tervet és állapotfájlt a repositoryban.
- Több redundáns review helyett egy alapos ellenőrzést használj.

## Alapelv

**Sol Medium gondolkodik, körülhatárol, integrál és ellenőriz. Luna a pontosan definiált implementációt végzi. A delegálás költségoptimalizálás, nem kötelező szertartás.**
