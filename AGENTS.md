<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Orchestráció:
.agents/orchestration.md


## Architektúra
.agents/architecture.md


## Branch-kezelés
.agents/gitmanagement.md


## Kódstílus
.agents/codestyle.md


# Ellenőrzés
.agents/codecheck.md

## Kötelező ellenőrzési korlát

Kisebb UI-, CSS-, szöveg- vagy egyszerű komponensmódosítás után TILOS automatikusan lintet, tesztet, typechecket, buildet, fejlesztői szervert vagy böngészőt indítani. Ilyenkor kizárólag a módosított kód logikai ellenőrzése engedélyezett, majd meg kell állni.

Ettől csak akkor lehet eltérni, ha:

- a felhasználó kifejezetten kéri az ellenőrzést;
- commit vagy push előtt a repository szabályai előírják; vagy
- konkrét, megnevezhető hibagyanú áll fenn. Ebben az esetben az ellenőrzés előtt röviden közölni kell az indokot.


# dokumentációs rendszer és feladathivatkozások kezelése
.agents/doscs.md


# Frontend design
.agents/frontend-design.md


# Weboldal leírása/célja
README.md tartalmazza


## Határok — ne nyúlj hozzájuk

- `drizzle/migrations` — generált migrációs fájlok, kézi szerkesztésük adatbázis-inkonzisztenciát okozhat
- `.env` és minden `.env*` fájl — érzékeny környezeti változók és kulcsok

Ha egy feladat ezekhez nyúlna, jelezd a felhasználónak ahelyett, hogy magad módosítanád.
