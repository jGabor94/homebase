# Dokumentációs szabályok

## Könyvtárszerkezet

- `src/docs/engineering/active`: rendszer szintű, aktuális mérnöki dokumentumok.
- `src/docs/engineering/archive`: lecserélt vagy már nem aktuális mérnöki dokumentumok.
- `src/docs/implementation/active`: rendszer szintű, folyamatban lévő implementációs tervek.
- `src/docs/implementation/archive`: befejezett implementációs tervek.
- `src/features/<feature>/docs/...`: ugyanennek a feature-specifikus megfelelője.

## Hatókör

- Több feature-t érintő dokumentum a `src/docs` alá kerüljön.
- Egyetlen feature-t érintő dokumentum az adott feature saját `docs` mappájába kerüljön.
- A feature dokumentum ne másolja a rendszer szintű szabályokat; szükség esetén hivatkozzon rájuk.

## Dokumentumtípusok

- Az `engineering` dokumentum a célt, követelményeket, szabályokat, adatfolyamot, architektúrát, invariánsokat és edge case-eket írja le.
- Az `implementation` dokumentum a végrehajtási lépéseket, érintett fájlokat, teszteket, döntéseket és feladatállapotokat tartalmazza.

## Használati szabályok

- A hivatkozott dokumentum teljes tartalmát olvasd el kontextusként.
- Ne kezeld automatikusan a teljes dokumentumot új feladatként.
- Először vizsgáld meg, mi van már implementálva.
- Csak a hiányzó vagy kifejezetten módosítandó részeket valósítsd meg.
- Git diffre hivatkozó feladatnál kizárólag a diffben hozzáadott vagy módosított követelmény az új feladat.
- A változatlan részek meglévő követelmények és háttérinformációk.
- Ne implementálj újra működő részeket.
- Ne végezz szükségtelen refaktorálást.

## Active és archive

- Az aktuális engineering dokumentum maradjon az `active` mappában akkor is, ha az első implementáció elkészült.
- A befejezett implementation dokumentum kerüljön az `archive` mappába.
- Lecserélt engineering dokumentum csak akkor kerüljön archívumba, ha már nem az aktuális működést írja le.
- Az archivált dokumentum nem tekintendő aktuális követelménynek, hacsak a feladat külön nem hivatkozik rá.

## Fájlnevek

- Használj kisbetűs, kötőjeles, beszédes neveket.
- Ugyanahhoz a feladathoz az engineering és implementation dokumentum fájlneve mindig legyen azonos.
- Példa: `engineering/active/reddit-score.md` és `implementation/active/reddit-score.md`.
- Ne használj `final`, `v2`, `new-plan` vagy hasonló neveket; a verziózást a Git végzi.


# Feladathivatkozások kezelése

Ha a felhasználó egy feladat nevére hivatkozik, például:

```text
Hajtsd végre a `reddit-score` feladatot.
```

akkor keresd meg az adott feladathoz tartozó dokumentumokat az érintett dokumentációs mappákban.
Nem feltétlenül van mindig engineering fájl. Ilyen esetben csak az implementációs fájlra hagyatkozz

Elsődlegesen ezeket keresd:

```text
docs/engineering/active/<feladat-neve>.md
docs/implementation/active/<feladat-neve>.md
```

A keresés történhet rendszer szinten:

```text
src/docs/...
```

vagy feature szinten:

```text
src/features/<feature>/docs/...
```