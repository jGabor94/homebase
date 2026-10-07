# App routing, hitelesítés és közös sidebar — implementáció

Állapot: implementálva és archiválva; ellenőrzési korlátok lent. Dátum: 2026-10-07.
Mérnöki specifikáció: [engineering](../../engineering/active/app-routing-auth-sidebar.md).
A routing, hitelesítés és közös app sidebar elkészült. Az alábbi checkboxok az elvégzett implementációt követik; a táblázat elvárt viselkedést ír le, a tényleges próbák eredménye külön szerepel.

## Előkészítés

- [x] Meglévő route-ok, auth callbackek, Google/Gmail visszatérési címek, jogosultságok és revalidációk feltérképezése.
- [x] Alkalmazásszintű mérnöki specifikáció elkészítése.
- [x] Implementáció előtt ellenőrizni az aktuális diffet, a telepített verziókat és az esetleg közben hozzáadott middleware/proxy fájlt. Önálló feladatbranch használata a repository szabályai szerint.
- [x] Elolvasni a releváns helyi Next.js guide-okat, a `shadcn` skillt és új React komponenseknél a komponensstílus skillt. A jelentősebb, körülhatárolt implementáció delegálása az orchestration szabályai szerint.

## 1. Auth és route-védelem

Érintett fájlok: `src/features/authentication/lib/auth.config.ts`, `src/features/authentication/lib/auth.ts`, új vagy meglévő `src/proxy.ts`.

- [x] Az `authorized` callbackben pontos `/app` és `/app/` alatti védelem; hitelesített loginlátogató átirányítása `/app` címre. A hibás `/home` cél és az üres protected route konfiguráció cseréje.
- [x] `pages.signIn: "/login"` rögzítése a közös konfigurációban.
- [x] A saját auth callbackek előtt a közös callbackek beemelése; a meglévő Google signIn, JWT, session és tokenmentési logika megtartása.
- [x] Credentials provider eltávolítása, a csak ehhez tartozó importok takarítása. Nem kell globális bcrypt dependency- vagy adatmodell-takarítás.
- [x] NextAuth `auth` wrapper bekötése a Next.js 16 proxy belépőjébe; matcher: `/app/:path*`, `/login`. Egyetlen belépőfájl maradjon.

## 2. Route-ok és layout

- [x] A jelenlegi `src/app/page.tsx` dashboardtartalmát `src/app/app/page.tsx` alá áthelyezni; fiktív adatokat és jelölésüket megtartani, saját menüt eltávolítani.
- [x] A gyökér `src/app/page.tsx` helyén egyszerű publikus landinget készíteni magyar bemutatkozással és belépési/app linkkel.
- [x] Új `src/app/app/layout.tsx`: szerveroldali session guard és közös app shell. A `src/app/layout.tsx` a globális HTML/font/stílus felelősségét tartja meg.
- [x] `src/app/monthly-expenses/page.tsx` és `loading.tsx` átvezetése `src/app/app/monthly-expenses/` alá; `src/app/settings/page.tsx` átvezetése `src/app/app/settings/page.tsx` címre.
- [x] Feature jogosultságellenőrzések megtartása; jogosultság hiányában redirect `/app` címre. A dashboard nem kap `monthlyExpenses.read` követelményt.
- [x] A régi `/monthly-expenses` és `/settings` oldal helyén csak `redirect` az új címre. Régi loading/header nem marad a redirect route-on.
- [x] A `/login` szerveroldali guard és Google `signIn` célja `/app`. A meglévő konfigurációhiány állapot és az OAuth hibák felhasználói visszajelzése rendezett.

## 3. Shadcn sidebar

Érintett fájlok: új `components.json`, generált UI-primitívek és hook/helper függőségeik, `src/components/app-sidebar/index.tsx`, `src/app/app/layout.tsx`, `src/app/globals.css`, szükség szerint `package.json` és `package-lock.json`.

- [x] Shadcn projektkontextus felmérése, hivatalos `@shadcn` Sidebar dokumentáció és registry tartalom ellenőrzése; szükséges inicializálás és komponensfelvétel. A konkrét base/style választást az implementációs jelentésben rögzíteni, a meglévő témát megőrizni.
- [x] A generált kódot és importokat átnézni; az alias `@/`, Tailwind v4 és a projekt Lucide ikonkészlete szerint illeszteni.
- [x] Egy közös `SidebarProvider`, sidebar, tartalomterület és feliratozott mobil trigger az app shellben. A primitive base-nak megfelelő Link-kompozíció, nem feltételezett `asChild` API.
- [x] Áttekintés, Közművek, Beállítások és létező Jegyzetek szakaszlink; aktív útvonal kezelése, jogosultság szerinti menüláthatóság.
- [x] Minimális felhasználói profiladat és kijelentkezés `/` céllal; kliensre csak a szükséges megjelenítési adatok kerüljenek.
- [x] A dashboard, közművek és beállítások korábbi menüit eltávolítani. Egyetlen szemantikus fő tartalomterület, mobilon használható méretezés és a meglévő meleg sidebar színtokenek.

## 4. Kapcsolódó címek és dokumentáció

- [x] `src/features/monthly-expenses/dal/connection.ts`: Gmail `redirectTo` → `/app/monthly-expenses`.
- [x] `src/features/monthly-expenses/dal/presets.ts`: `revalidatePath` → `/app/settings` és `/app/monthly-expenses`.
- [x] Az áthelyezett oldalak és navigációk minden belső hivatkozását az új kanonikus címekre cserélni; az áttekintés szakaszlinkjeit ellenőrizni.
- [x] `/api/auth/[...nextauth]`, `/api/monthly-expenses/import`, `/api/monthly-expenses/source` és hozzájuk tartozó fetch címek megtartása. API/DAL auth és authorization nem kerül eltávolításra.
- [x] `README.md` és `src/features/monthly-expenses/README.md` aktuális route-jainak frissítése; a feature engineering dokumentumok régi URL-hivatkozásainak célzott frissítése. Archivált történeti tervek nem írandók át.
- [x] A `.agents/DESIGN.md` régi főoldal/menü leírásának összehangolása az új landing/app felosztással az alkalmazáskód elkészültekor.

## Ellenőrzési terv

A routingot és auth konfigurációt érintő architekturális változás után a repository komplex feladatokra vonatkozó build-előírása szerint történt ellenőrzés. A generált sidebar React hookja miatt célzott lint is futott. Az alábbi táblázat elfogadási eseteket sorol fel; a ténylegesen lefuttatott próbák és korlátok az eredményjelentésben szerepelnek.

| Eset | Elvárt eredmény |
| --- | --- |
| Vendég és hitelesített user GET `/` | Landing, nincs automatikus redirect, nincs sidebar vagy privát adat |
| Vendég GET `/login` | Egyetlen Google-belépési lehetőség |
| Hitelesített user GET `/login` | `/app`, nincs `/home` vagy régi cél |
| Vendég GET `/app`, `/app/monthly-expenses`, `/app/settings` | `/login`, privát tartalom nem jelenik meg |
| `/application` vagy nem létező app oldal | Nem véletlen prefix-védelem; hitelesített usernél megfelelő 404 |
| Google-belépés siker / elutasítás / konfigurációhiány | `/app` / érthető hiba / meglévő konfigurációhiány-jelzés |
| Auth providerlista és credentials közvetlen kérés | Csak Google, credentials belépés nem érhető el |
| Hitelesített user közmű read jog nélkül | `/app` megnyitható; közművek és beállítások nem hozzáférhetők, nincs redirect-hurok |
| Régi `/monthly-expenses`, `/settings` címek | Új kanonikus route-ra redirect, ott az auth védelem érvényesül |
| Auth callback, statikus asset és API kérés | Proxy nem akadályozza; API saját auth/error válasza megmarad |
| Gmail összekapcsolás és visszatérés | Meglévő külön consent flow, visszatérés `/app/monthly-expenses` címre |
| Sablon mentése | Új oldalútvonalak revalidációja |
| Desktop/mobil sidebar és kliensoldali navigáció | Közös shell, helyes aktív elem, billentyűzet/fókusz és mobil bezárás működik |
| Kijelentkezés, majd app megnyitása | `/`, majd app kérésre `/login` |

- [x] Az auth route-politika és callback-összeolvasztás célzott regresszióellenőrzése a meglévő tesztinfrastruktúrához illesztve.
- [x] `npm run build` az implementáció komplexitása miatt; szükséges környezeti konfiguráció hiányát blokkolóként jelezni, `.env*` módosítása nélkül.
- [x] A hozzáférési route-okat vendég HTTP-kérésekkel, a sidebart meglévő hitelesített sessionnel desktopon és mobilon ellenőrizni. Új Google/Gmail consent és kijelentkezés nem indult; ezek nem minősülnek élőben igazolt esetnek.
- [x] Ellenőrizni a diffet, és csak ténylegesen teljesült lépéseket kipipálni. Commit/push külön felhasználói kérés; commit előtt lint és typecheck, push előtt build szükséges a repository szabályai szerint.

## Lezárás

- [x] A mérnöki dokumentum státuszát az implementált működésre frissíteni; az engineering fájl az `active` mappában marad.
- [x] Az eredményeket és a fennmaradt korlátokat ebben a tervben rögzíteni, majd a kész tervet `src/docs/implementation/archive/app-routing-auth-sidebar.md` alá helyezni; a kölcsönös relatív linkeket az új helyhez igazítani.

## Eredményjelentés

- A Next.js 16 `src/proxy.ts` a teljes Auth.js konfigurációt használja; az `authorized` callback öröklése helyreállt. A providerlista élő HTTP-válaszban kizárólag Google.
- A dashboard `/app`, a közművek `/app/monthly-expenses`, a sablonbeállítások `/app/settings` alatt működnek, közös sidebarral és változatlan feature jogosultságokkal.
- Shadcn: hivatalos `@shadcn` registry, Radix / new-york stílus, meglévő témához igazított sidebar tokenek. A CLI által generált primitívek kompozíciós API-ja megmaradt; az app komponensek FC/default export stílust használnak.
- Célzott auth teszt: `npx tsx --test src/features/authentication/tests/routing.test.ts`, 11 sikeres teszteset, 0 hiba.
- Célzott lint: az érintett route-, auth-, sidebar- és DAL-fájlok ellenőrzése; a generált `use-mobile` effect-state hibáját `useSyncExternalStore` javította. A hibás fájl újralintelve sikeres; a fókuszjavítás után a sidebar lintje is sikeres.
- `npm run build`: sikeres fordítás, TypeScript, statikus generálás, minden új route és Proxy látható. Az első sandboxos futás Windows útvonal-hozzáférés miatt leállt, a teljes helyi hozzáféréssel futtatott build sikeres.
- Futó helyi alkalmazás, vendég HTTP-próba: `/` és `/login` 200; `/app` és mindkét feature 307 `/login` célra; régi oldalroute-ok 307 új címre; `/application` 404. OAuth hiba-paraméteres login 200.
- Böngészőpróba meglévő hitelesített sessionnel: landing, app áttekintés, közművek, beállítások és hitelesített `/login` → `/app` átirányítás működik. Desktop 1440 px, telefon 390 px: sidebar megjelenés, mobil nyitás, navigáció utáni bezárás, Escape és a nyitógombra visszaálló fókusz ellenőrizve. A vizsgált oldalak konzoljában nincs warning/error.
- Gmail visszatérési cím és sablon-revalidáció átvezetése kódreview-val igazolt. Új Google OAuth/Gmail consent, kijelentkezés, sablonmutáció és külön jogosultság nélküli élő session nem lett elindítva; meglévő DAL és permission védelem változatlan.
- `.env*` és migrációk érintetlenek. Commit és push nem történt.
