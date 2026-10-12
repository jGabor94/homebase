# App routing, hitelesítés és közös sidebar

Állapot: implementált működés. Az élő Google OAuth/Gmail újracsatlakoztatási próba nem futott. Dátum: 2026-10-07.
Hatókör: alkalmazásszintű routing, Google-belépés, route-védelem és navigáció.
Végrehajtási terv: [implementation](../../implementation/archive/app-routing-auth-sidebar.md).

## Cél és hozzáférés

A publikus bemutatkozás, a bejelentkezés és a hitelesített alkalmazás külön route-on és elkülönített layout-felelősséggel működjön.

| Útvonal | Vendég | Bejelentkezett felhasználó | Felület |
| --- | --- | --- | --- |
| `/` | Megtekinthető | Megtekinthető, nincs automatikus átirányítás | Publikus landing |
| `/login` | Megtekinthető | Átirányítás `/app` címre | Kizárólag Google-belépés |
| `/app` | Átirányítás `/login` címre | Megtekinthető | Áttekintés, közös sidebar |
| `/app/*` | Átirányítás `/login` címre | A feature jogosultságai szerint | Közös app layout |
| `/monthly-expenses` | Átirányítás az új címre, majd login | Átirányítás `/app/monthly-expenses` címre | Régi cím kompatibilitása |
| `/settings` | Átirányítás az új címre, majd login | Átirányítás `/app/settings` címre | Régi cím kompatibilitása |

A hitelesítés nem ad automatikusan feature-jogosultságot. A közművek és a közös sablonbeállítások meglévő `monthlyExpenses.read` ellenőrzése megmarad. A jogosultság nélküli, de hitelesített felhasználó `/app` címre kerül; ez az áttekintés nem igényel közműjogosultságot, így nincs redirect-hurok.

## Implementáció előtti kiinduló állapot

- `src/app/page.tsx`: publikus, fiktív adatos dashboard, saját felső navigációval. Ez az áttekintés kerül `/app` alá; `/` önálló landinget kap.
- `/login`: Google-gomb, de sikeres belépés és meglévő session esetén még `/monthly-expenses` a cél.
- `src/features/authentication/lib/auth.config.ts`: létező `authorized` callback, üres védett útvonallistával és hibás `/home` céllal.
- `auth.ts`: Google és Credentials provider egyaránt elérhető. A saját `callbacks` objektum felülírja a konfiguráció callbackjeit, így az `authorized` nem öröklődik automatikusan.
- A feltárt checkoutban nincs gyökérszintű vagy `src/` alatti middleware/proxy belépőfájl. Implementáció előtt ismét ellenőrizni kell; ha közben megjelenik, azt kell integrálni, nem második belépőfájlt létrehozni.
- A közmű- és beállításoldal külön fejlécet tartalmaz. Nincs meglévő sidebar komponens vagy `components.json`; a szemantikus CSS-téma már létezik.
- A Gmail csatlakoztatás `/monthly-expenses` címre tér vissza, a sablonmutációk a régi oldalútvonalakat revalidálják.

## Route- és komponensstruktúra

```text
src/
  proxy.ts
  app/
    layout.tsx                    # globális HTML, betűk és stílusok
    page.tsx                      # publikus landing
    login/page.tsx                # Google-belépés
    app/
      layout.tsx                  # session guard és közös sidebar shell
      page.tsx                    # meglévő dashboard, mintaadatokkal
      monthly-expenses/
        page.tsx
        loading.tsx
      settings/page.tsx
    monthly-expenses/page.tsx     # kizárólag kompatibilitási redirect
    settings/page.tsx             # kizárólag kompatibilitási redirect
    api/                         # meglévő endpointok a jelenlegi címeken
  components/
    app-sidebar/index.tsx        # feature-független app navigáció
    ui/                          # shadcn által telepített primitívek
```

A tényleges URL-prefixhez fizikai `src/app/app` szegmens kell; egy `(app)` route group önmagában nem hozza létre az `/app` útvonalat. A gyökérlayout nem tartalmaz app navigációt vagy globális auth-követelményt. A route-oldalak megtartják a saját címeiket, adatbetöltésüket és üzleti tartalmukat, de a megismételt menüket eltávolítjuk.

## Hitelesítés és kérésfolyam

1. A Next.js kérésvédelmi belépője a NextAuth `auth` wrapperét futtatja. A telepített Next.js 16.3.6 dokumentációja szerinti fájlnév `src/proxy.ts`, a korábbi middleware szerepének megfelelően; middleware és proxy nem jön létre párhuzamosan.
2. A matcher kizárólag `/app/:path*` és `/login` oldalakat céloz. `/`, statikus assetek és `/api/auth/*` nem kerülnek auth-redirect mögé.
3. Az `auth.config.ts` az útvonalpolitika egyetlen forrása. A védettség feltétele pontosan `pathname === "/app" || pathname.startsWith("/app/")`; `/application` nem számít app route-nak. A hitelesítés feltétele létező `auth?.user`.
4. Vendég az app alatt `/login` címre kerül; hitelesített felhasználó a loginról `/app` címre. A minimális megoldás fix `/app` célt használ sikeres belépés után, nem vezet be új callback URL-paramétert.
5. `authConfig.pages.signIn` értéke `/login`. Az `auth.ts` a közös callbackeket explicit összeolvasztja saját `signIn`, `jwt` és `session` callbackjeivel. A proxy a teljes konfigurációból létrehozott `auth` wrappert használja a Node.js runtime-ban; nem készül eltérő session-alakot előállító második auth-példány.
6. Az `/app` szerverlayout sessiont ellenőriz; ez a shell védelme, nem a DAL helyettesítője. A feature-oldalak jogosultságellenőrzései és a Server Action / API / DAL hitelesítés megmaradnak.

A proxy útvonalvizsgálata nem végez új adatbázis-lekérdezést. A meglévő JWT/session működés és Google tokenmegőrzés változatlan üzleti felelősség marad. A kizárólag Google-belépéshez a Credentials providert és csak az általa használt importokat el kell távolítani az auth konfigurációból; jelszóoszlopokat, migrációkat és más feature-öket nem kell módosítani.

A normál bejelentkezés csak az identitáshoz szükséges Google scope-okat használja. A Gmail-hozzájárulás továbbra is külön, meglévő művelet; annak visszatérési címe `/app/monthly-expenses`. Az OAuth callback útvonala továbbra is `/api/auth/callback/google`.

## Landing, login és sidebar

- A landing rövid magyar Homebase-bemutatkozást és `/login` címre vezető belépési lehetőséget kínál. Nem tölt be számlákat, sessiontől függő privát adatot vagy app sidebart. Bejelentkezett felhasználó számára is közvetlenül megtekinthető; lehet rajta statikus `/app` hivatkozás.
- A login megtartja a Google-konfiguráció hiányát jelző állapotot. Elutasított vagy megszakított OAuth esetén érthető magyar hiba jelenik meg, nem sikeres belépést imitáló átirányítás.
- Az app shell valódi shadcn Sidebar komponensekből épül, egyetlen `SidebarProvider` alatt. A tartalom és a mobil nyitógomb az `/app` layoutban kap helyet. Az interaktív sidebar kis klienskomponens, a layout és az oldalak alapértelmezetten szerverkomponensek.
- Menüpontok: Áttekintés `/app`; Közművek `/app/monthly-expenses`; Beállítások `/app/settings`. A két utóbbi csak a meglévő read jogosultsággal látszik. A 2026-10-12-én implementált Jegyzetek menüpont `/app/notes` címre mutat, friss adatbázis-adatból ellenőrzött notes hozzáféréssel. A részletes hozzáférési és bevezetési szabályokat a [notes specifikációja](../../../features/notes/docs/engineering/active/notes-board.md) írja le.
- Az aktív Áttekintés csak pontos `/app` egyezésnél aktív; a többi oldal szegmenshatárral illeszkedik. A Jegyzetek szakaszlink nem kap hamis oldalaktív állapotot.
- Desktopon oldalsáv, mobilon a shadcn által biztosított nyitható panel működik, feliratozott triggerrel, billentyűzetes vezérléssel, fókuszkezeléssel és bezárással. A navigáció `next/link` hivatkozásokat használ.
- A sidebar footerében a sessionből származó név/e-mail és kijelentkezés szerepel; OAuth token vagy teljes sessionobjektum nem kerül klienspropba. Kijelentkezés után a cél `/`.
- A meglévő meleg krém, terrakotta és olíva téma marad. A szükséges sidebar tokenek ehhez igazodnak, a shadcn inicializálás nem írhatja felül a meglévő design teljes témáját.

## Kompatibilitás és határok

A régi oldalroute-ok átmeneti szerveroldali redirectek, privát tartalom nélkül. A Gmail visszatérését, belső linkeket és `revalidatePath` hívásokat az új kanonikus címekre kell átvezetni. Az `/api/monthly-expenses/*` címek és kliensoldali fetch hívásaik változatlanok; ezek saját szerveroldali auth- és jogosultságellenőrzéssel működnek, nem HTML-login redirecttel.

Nem része a feladatnak adatbázis-módosítás, új szerepkör, családi meghívás, tartós kimutatásmentés vagy jegyzetkezelés. `.env*` és `drizzle/migrations` nem módosítható. A szükséges környezeti beállítások hiányát jelezni kell, értékeiket nem szabad dokumentálni.

## Elfogadási feltételek és források

A hozzáférési táblázat minden állapota teljesül, az `/app` alatti oldalak közös sidebart kapnak, a Google az egyetlen auth provider, a meglévő feature-jogosultság és Gmail-flow megmarad. Nincs redirect-hurok, duplikált menü vagy régi célra mutató belső navigáció/revalidáció. A részletes ellenőrzési esetek az implementációs tervben szerepelnek.

Verzióhoz illesztett helyi források: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `03-layouts-and-pages.md`, valamint `01-app/02-guides/authentication.md`. A Next.js dokumentáció különbséget tesz a proxy optimista ellenőrzése és az adatközeli jogosultságvédelem között.

Az auth wrapper és az `authorized` callback működésének forrása az [Auth.js Next.js referencia](https://authjs.dev/reference/nextjs). A sidebar összetételének forrása a [shadcn Sidebar dokumentáció](https://ui.shadcn.com/docs/components/sidebar); a konkrét primitive API-t implementációkor a választott registry/base szerint kell ellenőrizni.

## Implementációs döntések

A sidebar a hivatalos @shadcn registry Radix / new-york komponenseit használja, cn osztályösszevonással és tw-animate-css animációkkal. A mobil breakpointot useSyncExternalStore követi; a mobil panel bezárásakor a fókusz a shell nyitógombjára tér vissza. Az OAuth hibák célja szintén /login, az error query többszörös értéke normalizált.
