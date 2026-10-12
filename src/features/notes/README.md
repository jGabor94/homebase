# Jegyzetek

Állapot: implementált és a konfigurált Neon `development` adatbázison bevezetett funkció. Egy megadott, létező fiók hozzáférése kiosztva; a másik megadott családtagnál az első Google-belépés még szükséges. Dátum: 2026-10-12.

A család saját üzenőfala egyszerű szöveges jegyzetekkel, alapvető formázással és papírcetli megjelenéssel. A felhasználó privát jegyzetet készíthet magának, vagy megoszthatja azt a családdal. A „publikus” ebben a feature-ben kizárólag családon belüli láthatóságot jelent.

## Működés

- Jegyzet létrehozása, megnyitása, szerkesztése és megerősítés utáni törlése.
- Opcionális cím, kötelező szöveg; félkövér, dőlt, felsorolás és számozott lista.
- Új jegyzet alapértelmezésben **Privát**. A tulajdonos bármikor **Családdal megosztott** állapotra válthat, majd visszaállíthatja privátra.
- Csak a tulajdonos szerkeszthet, törölhet és módosíthat láthatóságot. A család többi tagja a megosztott jegyzetet olvashatja.
- Az `/app/notes` üzenőfal a saját privát és a családdal megosztott jegyzeteket együtt mutatja, legutóbbi módosítás szerint rendezve.
- A jegyzetek meleg pasztellszínű papírcetlik, finom árnyékkal és visszafogott ragasztószalag-dekorációval. Mobilon egy oszlopba rendeződnek.

## Dokumentáció

- [Mérnöki specifikáció](docs/engineering/active/notes-board.md): követelmények, hozzáférés, formázás, adatmodell, megjelenés és hibás állapotok.
- [Implementációs terv](docs/implementation/active/notes-board.md): végrehajtási sorrend, tervezett fájlok, feladatállapotok és későbbi ellenőrzések.

## Kiinduló állapot és határok

A jelenlegi `/app` oldalon fiktív jegyzetek vannak. A valódi jegyzetfal a `/app/notes` route-on működik, a sidebarból és a bemutató jegyzetrészből elérhetően. A családtagi hozzáférés nem következik automatikusan a Google-belépésből: kizárólag az explicit `notesMember` szerepkörrel rendelkező felhasználók kapnak hozzáférést. Az admin szerepkör sem ad automatikusan betekintést a jegyzetekbe.

A `notes` tábla, indexek, FK, check constraint-ek és RLS a felhasználó külön jóváhagyása után, a `20261012163347_notes-board` Drizzle migrációval létrejöttek. A migráció naplózva van; a régi migráció változatlan. A konfigurált kapcsolat a `development` ágra mutat, a production ág nem változott. A megadott, létező fiók a korábbi szerepköre mellé kapott `notesMember` hozzáférést. A másik megadott fiók még nem létezik: az első Google-belépés után explicit kiosztás szükséges, nincs automatikus regisztrációs jogosultság. Környezeti fájl nem változott.

## Ellenőrzés

`npm run test:notes`: 5/5 sikeres, formázás, HTML-escape, inputvalidáció, cím nélküli mentési payload, hamis tulajdonosmezők kiszűrése és szerepkörök. Célzott ESLint és production build sikeres; a build a teljes TypeScript-ellenőrzést is elvégezte. Desktop és 390 px mobil statikus, fiktív adatos cetli-/szerkesztő-előnézet ellenőrzött.

A development adatbázison sikeres visszagörgetett migrációs próba, Drizzle-bevezetés és tárolási CRUD-/verzióellenőrzés futott. A tényleges notes lekérdezésekkel, két szintetikus taggal igazolt a privát/családi szűrés, a láthatóságváltás, a 30 elem feletti lapozás és a tagság visszavonása. A próba nem hagyott tesztfelhasználót vagy tesztjegyzetet. A teljes, Google-belépéssel induló hidratált böngészős munkafolyamat még nincs igazolva.

Az első változat egyetlen családot szolgál ki. Nem tartalmaz közös szerkesztést, hozzászólásokat, mellékleteket, értesítéseket, keresőt, címkéket, kitűzést vagy kézzel mozgatható cetliket.

## Családtagi hozzáférés kiosztása

Helyi adminisztratív eszköz: `scripts/manage-membership.ts`. Csak már létező felhasználóhoz adja hozzá a `notesMember` szerepkört, a többi szerepkört megtartva. Nem hoz létre új felhasználót vagy automatikusan jogosult Google-fiókot. A parancs meglévő konfigurációból olvassa az adatbázis-kapcsolatot, környezeti fájlt nem módosít.

```sh
# Előnézet: nincs adatváltozás.
npx tsx src/features/notes/scripts/manage-membership.ts grant csaladtag@example.test

# Kiosztás az ellenőrzött családtagnak.
npx tsx src/features/notes/scripts/manage-membership.ts grant csaladtag@example.test --apply

# Hozzáférés visszavonása, a jegyzetek törlése nélkül.
npx tsx src/features/notes/scripts/manage-membership.ts revoke csaladtag@example.test --apply
```

A kiosztás és visszavonás a következő szerveroldali ellenőrzéstől érvényesül, új bejelentkezés nélkül. A már megnyitott oldalt frissíteni kell a menü megjelenéséhez. A helyi parancs futtatásához az adatbázist elérő, megbízható adminisztrátori környezet kell; nem webes végpont.
