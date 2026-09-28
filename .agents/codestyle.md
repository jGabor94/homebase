# Code Style

## Általános elvek

- Írj egyszerű, közvetlen kódot. Ne vezess be absztrakciót egyetlen használati hely vagy feltételezett jövőbeli igény miatt.
- A fájlokat felelősség szerint bontsd, ne önkényes sorszámkorlát alapján.
- Az azonosítók, fájlnevek és kódkommentek angolul, a felhasználói szövegek a célközönség nyelvén legyenek.

## React komponensek

- Egy fájlban csak egy React komponens legyen.
- Kerüld a felduzzadt komponensfájlokat.
- Komponenst valódi önálló felelősség, újrafelhasználás, külön async boundary vagy Server/Client-határ miatt szervezz külön fájlba, ne pusztán a JSX rövidítése kedvéért.
- Kerüld az egyetlen felhasználási helyű proxy komponenseket, amelyek csak propokat továbbítanak vagy egy másik komponenst renderelnek változatlanul.
- Az egymástól el nem választható `Section`, `Panel`, `Content` és hasonló rétegeket tartsd egy komponensben. A fájlokra bontás ne teremtsen mesterséges komponenshierarchiát.
- Összetartozó komponenscsoport saját mappába kerüljön.
- A komponenscsoport belépési pontja `index.tsx` legyen.
- A route saját statikus váza, címei, leírásai, egyszerű JSX-kompozíciója és route-szintű adatbetöltése maradjon közvetlenül a `page.tsx` fájlban, amíg nincs valódi oka a kiszervezésnek.
- A `page.tsx` ne proxyzzon egyetlen feature-komponenst az oldal teljes tartalmaként. Előbb valósítsd meg benne mindazt, ami route-felelősség; az önálló részeket csak ezután szervezd ki a megfelelő feature mappába.
- Ha a `page.tsx` maga vár meg adatot, route-szintű fallbackhez használj `loading.tsx` fájlt. Lokális `Suspense` boundary-t az egymástól függetlenül streamelhető alrészek köré tegyél.

## Fájlméret és felelősségek

- Lehetőség szerint kerüld a több száz soros, felduzzadt fájlokat, nem csak React komponensek esetén.
- Ha egy fájl túl sok felelősséget kezel, bontsd kisebb, jól elkülönített modulokra.
- A felbontás funkcionális felelősségek mentén történjen, ne önkényes sorszámkorlát alapján.
- Kerüld az indokolatlanul nagy service-, utility-, DAL-, schema-, route- és konfigurációs fájlokat is.

## TypeScript típusok

- Az egyedi lekérdezések típusneve PascalCase formátumú legyen.
- A típusnévből maradjon el a függvény `get`, `find` vagy más igei prefixe.
- Ne írj kézzel duplikált interfészt olyan visszatérési alakhoz, amely `Awaited<ReturnType<typeof ...>>` segítségével levezethető.
- Tömbös visszatérési értéknél szükség esetén külön `List` és `Item` típust vezess le.

Példa:

```typescript
export type UserWithAccountsList = Awaited<
  ReturnType<typeof getUserWithAccounts>
>;

export type UserWithAccountsItem = UserWithAccountsList[number];
```

## Kódkommentek

- Kommentet csak nem nyilvánvaló döntéshez, invariánshoz, workaroundhoz vagy összetett algoritmushoz írj.
- Ne kommentáld elbeszélően azt, amit a kód önmagában világosan kifejez.
- Minden kódkomment és JSDoc **angolul** íródjon, függetlenül a kommunikáció nyelvétől.
- A komment a „miértet” rögzítse; a „mit” lehetőleg a névadás mondja el.
- Elavult vagy kikommentelt kódot ne hagyj a fájlban.

## Függvények és hibakezelés

- Komponensekhez, hookokhoz és kisebb műveletekhez preferáld a névvel ellátott `const` arrow function formát.
- Használj korai visszatérést hibás, üres vagy nem engedélyezett állapotnál.
- Független async műveleteket indíts párhuzamosan; szekvenciális `await` csak valódi adatfüggésnél legyen.
- A normál üzleti hibákat értékként kezeld. Kivétel váratlan technikai hibát jelentsen.
