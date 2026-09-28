# Architecture

<!-- Architecture rules are derived from the repository's implemented patterns. -->

## Alapelv

A projekt feature-first moduláris monolit. A route-ok az oldalak összeállításáért, a feature-ök az üzleti képességekért, a gyökérszintű modulok pedig a valóban megosztott infrastruktúráért felelnek.

Az architektúra célja nem a maximális rétegszám, hanem az, hogy egy funkció kódja együtt maradjon, az adatbázis-hozzáférés és a UI között pedig jól látható határ legyen. Ne hozz létre üres mappát, réteget vagy wrappert csak egy sablon kedvéért.

## Mappastruktúra

A `src/` mappa felépítése:

- `docs/` — mérnöki és implementációs fájlok az egész projektre vonatkozóan
- `drizzle/` — DB kapcsolat, seed, migrációk, a feature mappákból importált sémák összegyűjtve
- `app/` — Next.js App Router
- `components/` — globális React komponensek, amelyeket **több feature is használ**, vagy amelyek nem köthetők egyetlen feature-höz sem (pl. layout elemek, generic UI wrapperek). Feature-specifikus komponens ide **soha ne** kerüljön — az a `features/<feature-name>/components/` alá tartozik.
- `hooks/` — globális React hook-ok
- `lib/` — megosztott infrastruktúra és integrációk (pl. a DAL magja)
- `utils/` — tiszta helper függvények (pl. dátumformázás)
- `types/` — globális típusok
- `providers/` — globális context providerek
- `features/` — minden feature (pl. `users`) a gyökérhez hasonló struktúrát követ, kiegészítve feature-specifikus rétegekkel — részletek: `src/features/AGENTS.md`

A `src/components/` nem általános lerakóhely. Egy komponenst először a saját feature-ébe tegyél, és csak tényleges több-feature-ös használatkor emeld ki.

## Nextjs architectúra

- Alapértelmezésben használj React Server Componenteket, és csak akkor vezess be Client Componentet, ha valóban szükség van kliensoldali interakcióra, state-re vagy böngésző API-ra.
- A kliensoldali state-et tartsd a lehető legalacsonyabb komponensszinten, és csak addig emeld fel, ameddig azt több komponens közös használata ténylegesen indokolja.
- Az adatlekérést tartsd a lehető legközelebb ahhoz a Server Componenthez, amelyik ténylegesen használja az adatot. A route `page.tsx` maga is megfelelő adatbetöltési hely, ha az adat az oldal egészéhez vagy közvetlen rendereléséhez tartozik.
- Kezdeti adatlekéréshez ne használj `useEffect`-et, és a Server Component ne hívja meg a saját HTTP route-ját. Hívd közvetlenül a megfelelő DAL-függvényt, majd szükség esetén add tovább az eredményét Server vagy Client Componentnek.
- Ha a `page.tsx` route-szintű, blokkoló adatot vár meg, a betöltési UI-hoz elsősorban az ugyanabban a route segmentben lévő `loading.tsx` fájlt használd. Ne szervezz ki proxy async komponenst kizárólag azért, hogy a page-ben `Suspense` alá tudd tenni.
- Manuális `Suspense` boundary-t akkor használj, ha az oldal statikus váza előtt külön streamelhető, egymástól független async szekciók vannak. A testvér boundary-k lehetővé teszik, hogy ezek saját adatukat párhuzamosan kérjék le és egymástól függetlenül renderelődjenek.
- Ha az adat a kliensen változhat, újratöltődhet vagy mutáció után frissíteni kell, használj SWR-t. Az SWR kezdeti adata származhat Server Componentben lekért adatból.
- Ha ugyanazt az SWR-adatot több Client Component is használja, és célszerű közös cache/configuration biztosítása, használj SWR providert.
- Az adatlekérést lehetőség szerint a szerverhez legközelebbi rétegben végezd; ne küldj feleslegesen adatlekérési logikát a kliensre.
- Mutációkhoz Server Actiont használj. A DAL mutációs függvénye közvetlenül meghívható Server Actionként, ezért csak emiatt ne hozz létre külön API route-ot.
- API route-ot csak akkor vezess be, ha valóban HTTP végpontra van szükség, például kliensoldali SWR revalidációhoz, külső klienshez, webhookhoz vagy publikus API-hoz.
- A komponenshatárokat úgy alakítsd ki, hogy a `"use client"` direktíva a lehető legkisebb, de logikailag összetartozó részfára korlátozódjon.

## Streaming és Partial Prerendering

- A független lekérdezéseket indítsd el egymás blokkolása nélkül. A promise átadható annak az async Server Componentnek, amely ténylegesen feloldja.
- Testvér `Suspense` boundary-kat az egymástól függetlenül streamelhető részekhez használj.
- Partial Prerenderinget ne írj elő általános projektkonvencióként. Csak akkor használd, ha a választott Next.js verzióban tudatosan engedélyezett, és az adott route statikus/dinamikus felosztása ténylegesen profitál belőle.
- Caching, streaming, Server Component és PPR döntésnél olvasd el a repository `.next-docs` mappájának aktuális, telepített verzióhoz tartozó dokumentációját.

## Komponensfájlok felépítése

- Egy fájlnak egy elsődleges React komponensfelelőssége legyen. Kis, csak a szülő által használt render helper maradhat ugyanabban a fájlban.
- Kerüld a felduzzadt fájlokat.
- A komponenseket csak valódi felelősségi, újrafelhasználási, async streaming- vagy Server/Client-határ mentén bontsd külön fájlokba.
- Ne hozz létre olyan proxy komponenst, amely csak továbbadja a route propjait, vagy változatlanul visszarenderel egy másik komponenst.
- Ne válassz szét egyetlen, logikailag összetartozó és csak együtt használt UI-t `Section`, `Panel`, `Content` vagy hasonló komponensekre, ha a részeknek nincs önálló felelősségük.
- A kiszervezés különösen indokolt, ha egy frontend rész ismétlődést mutat.
- Az összetartozó komponenscsoportok, például egy navbar és annak alkomponensei, saját mappába kerüljenek.
- A komponenscsoport belépési pontja lehet `index.tsx`; ez szűk publikus felület legyen, ne mindent újraexportáló barrel.
- Azok a komponensek, amelyek csak egy feature-höz tartoznak, és nem sorolhatók azon belül alkomponenscsoportba, a `features/<feature-name>/components/` mappa gyökerébe kerüljenek.
- A route saját kompozíciója, statikus váza, route-specifikus szövege és közvetlen adatbetöltése elsődlegesen maradjon a `page.tsx` fájlban.
- Amit tisztán és átláthatóan meg lehet valósítani a `page.tsx` fájlban, azt ne proxyzd át feature-komponensbe. Csak az ezután fennmaradó, önálló felelősségű részeket szervezd ki a megfelelő `features/<feature-name>/components/` mappába.

## Komponensek elhelyezése

- Ha egy komponens **csak egy adott feature-höz** kapcsolódik, az a `features/<feature-name>/components/` alá kerül — **nem** a gyökér `src/components/` mappába.
- A gyökér `src/components/` kizárólag olyan komponenseknek van fenntartva, amelyeket **legalább két különböző feature** használ, vagy amelyek feature-független, generikus UI elemek.
- Ha bizonytalan vagy, hogy egy komponens globális-e, alapértelmezésben tedd a feature `components/` mappájába, és csak akkor emeld ki a gyökérbe, ha ténylegesen több feature igényli.

## Lekérdezések

Minden szerveroldali olvasást és mutációt csomagolj a DAL rétegbe. A query szerver-only függvény; a `dal/mutations.ts` publikus exportja Server Action.

- Server Componentből — beleértve a `page.tsx` fájlt is — a lekérdező DAL-függvényt közvetlenül hívd meg.
- Ne hozz létre API route-ot a kezdeti RSC-adatbetöltés közvetítésére, és ne fetch-eld a saját route-odat a szerverről.
- Kliensoldali újratöltéshez vagy más valódi HTTP-határhoz készíts vékony Route Handlert, amely közvetlenül a szükséges DAL-függvényt hívja.
- Mutációhoz használd közvetlenül a DAL-függvényt Server Actionként.
- Használd a `dal` skillt.
- Minden mutáció hagyományos API route helyett a `src/lib/dal` mappában található DAL segédprogrammal, a feature saját `dal/mutations.ts` fájljában legyen Server Actionként implementálva.

## Rétegződési szabály

Olvasási út: **komponens / route → `dal/queries` → `features/[featurename]/drizzle/operations` → `db`**

Mutációs út: **komponens / route → `dal/mutations` → `db` / tranzakció / feature-séma**

- A `features/[featurename]/drizzle/operations.ts` újrahasznosítható nyers olvasásait a `dal/queries.ts` csomagolja be.
- A mutáció maradhat közvetlenül a `dal/mutations.ts` fájlban, különösen tranzakció vagy több tábla összehangolt módosítása esetén. Ne hozz létre mechanikus operation wrappert csak a rétegszám növeléséért.
- UI kód vagy route handler **soha ne hívjon közvetlenül** `features/[featurename]/drizzle/operations`-t.
- Ne ugorj át réteget, és ne fordítsd meg a hívási irányt.

## Drizzle séma és típusok

Új Drizzle tábla létrehozásának pontos konvencióját (`pgTable`, névadás, kulcsok, megosztott időbélyegek) és a hozzá tartozó `Insert`/`Select` típusok generálását a **`drizzle-schema` skill** írja le.
Új séma létrehozásakor vagy módosításakor mindig azt kövesd.
A gyökér `drizzle/` mappa a feature mappák `drizzle/schema.ts` fájljaiból importálja össze a globális Drizzle sémakészletet.
Új sémát mindig a feature `drizzle/schema.ts` fájljába adj hozzá, ne a gyökér `drizzle/` mappába.

## Egyedi lekérdezések típusai

Ha a `features/[featurename]/drizzle/operations.ts` fájlban egy olyan függvény van, például join, aggregáció vagy szűkített mezőlista, amelynek visszatérési típusa eltér a tábla nyers `Select<Name>` típusától, akkor ahhoz is generálj típust a feature `types.ts` fájljába, a függvény visszatérési típusából levezetve:

```typescript
export type UserWithAccounts = Awaited<ReturnType<typeof getUserWithAccounts>>;
```

- A típusnév a függvény nevéből képződik PascalCase formában, a `get` / `find` / stb. igei prefix nélkül.
- Példa: `getUserWithAccounts` → `UserWithAccounts`.
- Ha a függvény tömböt ad vissza, és az elemek típusára külön is szükség van, vezesd le az elemtípust is:

```typescript
export type UserWithAccountsList = Awaited<
  ReturnType<typeof getUserWithAccounts>
>;

export type UserWithAccountsItem = UserWithAccountsList[number];
```

- Ne írj kézzel duplikált interfészt egy `operations.ts` függvény visszatérési alakjához.
- Mindig `Awaited<ReturnType<typeof ...>>` segítségével vezesd le a típust a `types.ts` fájlban, hogy a séma módosulásakor a típus is frissüljön.
- Ez a szabály csak az **egyedi**, nem tiszta `Select` / `Insert` lekérdezésekre vonatkozik.
- Ha egy `operations.ts` függvény egyszerűen egy tábla sorát adja vissza, nem kell külön típus; elég a séma `Select<Name>` típusa a `drizzle-schema` skill szerint.

## Formok

Minden form `react-hook-form` és Zod validáció használatával készüljön.
A pontos konvenciót — séma és típus helye, `useForm` beállítás, pending állapot és alkalmazásszintű visszajelzés — a **`form-creation` skill** írja le.
Új form létrehozásakor mindig azt kövesd.

## Server és Client komponensek

- A route és a kezdeti adatkompozíció alapértelmezésben React Server Component legyen.
- Az interaktív, logikailag összetartozó feature-rész lehet egy Client Component gyökér. Ne aprózd szét mesterségesen, de ne emeld a klienshatárt a szükségesnél magasabbra.
- Ha csak egy kisebb résznek kell kliensoldali működés, azt szervezd ki külön Client Componentbe.
- Az állapotot tartsd a lehető legalacsonyabb szinten.
- Csak annyira emeld fel az állapotot, amennyire feltétlenül szükséges.

## Szerver- és kliensadat együttműködése

A szerver által betöltött adat legyen a kezdeti igazságforrás. Ha ugyanaz az adat a kliensen módosul vagy újravalidálódik, a Server Component kérje le a kezdeti adatot, a feature provider adja át fallbackként a kliens cache-nek, a feature hook pedig stabil cache-kulccsal olvassa és mutálja. Route Handler csak a kliensoldali HTTP-frissítéshez vagy más valódi HTTP-határhoz kell.

Lokális UI-állapot maradjon lokális. Több, szorosan együttműködő feature-komponens közös állapotához használj feature providert; összetett állapotátmenetekhez reducer előnyösebb egymásra épülő `useState` hívásoknál.

## UI-technológia határa

Ez a dokumentum szándékosan nem választ UI component libraryt, CSS-megoldást vagy ikonkészletet. Ezek projektindításkor meghozandó technológiai döntések; az itt leírt modul-, adat- és komponenshatárok a választott megjelenítési rétegtől függetlenek.
