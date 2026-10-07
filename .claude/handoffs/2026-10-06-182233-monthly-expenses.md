# Handoff: Homebase havi kiadások

## Session Metadata

- Dátum: 2026-10-06, Europe/Budapest.
- Projekt: C:/Users/jakuc/WebProjects/homebase.
- Branch: codex/project-readme.
- Több fejlesztési és hibajavítási kör átadása; nincs commit/push/deploy kérés.
- Ez a jegyzet a README-k, mérnöki és implementációs dokumentáció frissítésével együtt készült.

## Current State Summary

Privát családi alkalmazás, mock főoldallal és működő, Google-belépéssel védett havi számlabeolvasással. Gmail, PDF és kézi bevitel; hitel alapértéke 81 000 Ft, kódos felezés. A kimutatások csak a böngésző helyi űrlapállapotában élnek. A Gmail OAuth-kapcsolata tartós a meglévő account táblában. A felület sok rövidítésen és elrendezésjavításon ment át. Legutóbb 41 teszt, típusellenőrzés és célzott lint sikeres; ezt követően két mezőfelirat változott, új ellenőrzés nélkül. Jelen feladat csak a dokumentáció átadása, nincs háttérben folytatandó implementáció.

## Important Context

A felhasználó barátságos, kocsmai hangnemet kedvel, de a hibák miatti ismételt kézi tesztelést erősen sérelmezi. Bizonyítsd az eredményt valódi ellenőrzéssel, amikor indokolt/engedélyezett; ne állíts UI- vagy élő sikert mockolt vagy szintetikus próbából. Kis UI/szöveg változtatás után a repo tiltja az automatikus lint/typecheck/teszt/build/böngésző indítását. Backend hibajavításnál a konkrét tesztindokot közöld.

Az AI **fallback**, nem elsődleges olvasó. Az AI-primary váltás és a PDF-input ára felmerült, de nem készült el; a költségkutatás félbeszakadt. A legutóbbi elfogadott UI: **Szolgáltatás típusa** = víz/gáz/villany/hulladék/egyéb (`category`), **Számla típusa** = normál/jóváírás/helyesbítő/sztornó (`documentType`). A dokumentumtípus eltávolítását a felhasználó visszavonta: mindkettő megmarad!

## Immediate Next Steps

1. Olvasd el az AGENTS.md hivatkozott szabályait, a projekt és feature README-t, majd a feature aktív engineering/implementation dokumentumát. Ellenőrizd az aktuális branch-et és munkafát, mielőtt változtatsz; sok munka még nincs commitolva.
2. A felhasználó következő konkrét kérését kövesd. Ne indíts automatikusan DB-mentés implementációt, újraépítést, AI-primary váltást, commitot vagy deployt az itt felsorolt jövőbeli lehetőségek alapján.
3. Ha az AI-primary kérdés folytatódik, aktuális hivatalos Gateway/Gemini árakkal és PDF-tokenizációval válaszolj; döntés után a kódos normalizálás, számolás, forrásvalidáció és duplikációvédelem maradjon.

## Architecture Overview

Next.js 16.3.6 / React 19.2.8 / Tailwind 4; feature-first moduláris monolit. Auth.js Google, PostgreSQL/Drizzle account-adapter, Zod, react-hook-form, Vercel AI SDK 7.0.127, pdf-parse 2.4.5. Route → DAL → Drizzle olvasás; Gmail/PDF/AI szerver-only. Gmail import Server Action, PDF-feltöltés és előnézet HTTP Route Handler. A főoldal fiktív dashboard, a jegyzetek még fiktívek.

## Critical Files

| File | Feladat |
| --- | --- |
| src/app/monthly-expenses/page.tsx | Védett oldal, kezdeti Gmail-kapcsolati állapot |
| src/features/monthly-expenses/components/MonthlyExpensesForm.tsx | Hónap, import, merge, háromgombos eszköztár és oldalsáv |
| src/features/monthly-expenses/components/InvoiceRowCard.tsx | Mezők, feliratok, bizonyítékok, átnézett státusz |
| src/features/monthly-expenses/components/SourcePreviewDialog.tsx | PDF Blob előnézet, PDF-tartalomtípus ellenőrzés |
| src/features/monthly-expenses/lib/extract-invoice.ts | Kódos kinyerés, pontos fallback feltétel és AI-merge |
| src/features/monthly-expenses/lib/ai.ts | Gateway strukturált válasz, sémahatárok, szöveg/PDF bemenet |
| src/features/monthly-expenses/lib/pdf.ts | PDF validálás, oldalszöveg, hash bufferátadás előtt |
| src/features/monthly-expenses/lib/gmail.ts | Gyűjtés, stabil MIME-hivatkozás, friss letöltési token |
| src/features/monthly-expenses/lib/google-access.ts | Tulajdonos/scope, OAuth refresh, profil és reconnect hiba |
| src/features/monthly-expenses/dal/queries.ts | Hitelesített Gmail-kapcsolati állapot |
| src/features/monthly-expenses/drizzle/operations.ts | Minimális account-projekció, nyers token nélkül |
| src/features/monthly-expenses/utils/source-evidence.ts | AI-érték és forrásidézet igazolása |
| src/features/monthly-expenses/utils/invoice-layout.ts | Szigorú oszlopos fizetési/keltezési blokkok |
| src/features/monthly-expenses/utils/index.ts | Deduplikáció, konfliktus, kézi értékvédelem és összesítés |
| src/features/monthly-expenses/config.ts | Kategóriák, limitek, issue címkék |
| src/features/monthly-expenses/zod/schema.ts | Form/import/AI séma |

## Files Modified

A munkafa már az átadás előtt sok módosított és untracked fájlt tartalmaz: README, csomagok, next/drizzle config, globális stílusok és főoldal, auth/account-adapter, jogosultságok; teljes havi feature és route-ok, login, output/design referencia. Ezek megőrzendők. Az utolsó változás a két típusmező és a bizonyítékfelirat átnevezése az InvoiceRowCardban. Ez a kör csak a két README-t, a feature két aktív tervét és ezt az átadást frissítette. A .agents szabályfájlok csak olvashatók; nem írtuk át őket.

## Decisions Made

- Kódos kinyerés először. AI indul nem olvasható PDF, nulla azonosított sor vagy hiányzó összeg/pénznem/határidő/számlaszám/időszak/documentType/issuedAt esetén. Provider/category önmagában nem trigger.
- AI dokumentumonként egy hívás, nem mezőnként; nincs retry loop. Szöveges inputnál számozott szöveg, rövid/képi oldal esetén PDF. Sémahatárokat a provider felé elhagyjuk, lokálisan minden Zod-korlát megmarad.
- Importált adat alapból átnézendő, még nulla technikai hiány mellett is. Az ellenőrzött státusz felhasználói döntés; keltezés nélkül nem engedett.
- Egyetlen „Havi kiadások” fejléc; lapos számlalista, nincs kategóriafejléc/üres helyőrző. A kategória megmarad, oldalsávban típus + szolgáltató + összeg.
- Mentett scope + refresh vagy érvényes access token rejti el az összekapcsolást. Visszavont consent import közben visszahozza; tárolt állapot nem bizonyít élő Google-hozzáférést.
- PDF sandbox ütközik a natív Chromium nézővel, eltávolítva. Validált PDF, explicit MIME, auth és tulajdonosvédelem megmarad.

## Work Completed and Verification

Gmail tesztfelhasználó/API hibák diagnosztikája; `(CET)` dátumkezelés; változó melléklet-token kezelése; Gateway auth és Gemini komplexitási hiba javítása. PDF hash korábban a kiürült parserbufferből számolódott: most előtte készül. MVM energiamix „földgáz” szava zavarta a villanybesorolást: első oldal elsőbbséget kap. ALFÖLDVÍZ oszlopos adatai támogatottak; kettőspont nem számlaszám/oldalhatár. Keltezés külön hiányjelzés és fallback.

Saját Gmailből három eredeti októberi PDF letöltése és importja igazolt: két MVM villany és egy ALFÖLDVÍZ. Újraimport nem dupláz; keltezési javítás után mindhárom dátuma 2026-10-02, kódos bizonyítékkal és figyelmeztetés nélkül. Valódi PDF-ek és személyes azonosítók nem kerültek a repóba. Szintetikus számlával élő Gemini strukturált szöveges hívás sikeres. Legutóbbi tesztek 41/41; típusellenőrzés és célzott lint sikeres. Korábbi build sikeres, de nem a legutóbbi teljes állapot production ellenőrzése. A kizárólag felirati módosítás után és a dokumentációfrissítés során nem futtattunk alkalmazásteszteket.

## Assumptions Made

A saját Google-fiók konfigurációját a felhasználó biztosítja. A korábbi élő hozzáférés nem garantálja a következő sessionben az érvényes engedélyt. A manuális PDF szélesebb szolgáltatói körre használható, Gmailből csak a négy támogatott közmű. A hónap a kiküldés Budapest szerinti hónapja, nem fogyasztási időszak; teljesítés és keltezés külön adat.

## Potential Gotchas

- Teljesnek látszó téves kódos eredmény nem indít második AI-ellenőrzést. Ismeretlen elrendezésekre nincs golyóálló garancia.
- Gáz/MOHU/szkennelt és módosító dokumentumok élő referenciahalmaza nincs teljesen tesztelve. Szöveges idézetet az AI gyakran vizuálisan összetartozó, de parserben külön sorokra rendezett adatokból állít össze; a szigorú forrásellenőrzést ne kapcsold ki csendben.
- A külön böngésző-munkamenet csak loginig jutott. A beépített tesztböngészőben a szintetikus natív PDF-nézet üres maradt; valódi UI/PDF vizuális siker nem állítható.
- Korrekciós nettósítás nincs. Módosító dokumentumok és kapcsolódó eredetik konzervatívan kimaradnak; nincs automatikus pénznemváltás.
- A Gmail állapotot DB-adatokból becsüljük. Visszavonás import közben derül ki; új oldalbetöltésnél régi scope ismét kapcsoltnak látszhat, amíg az import nem ellenőrzi.
- A számlák újratöltéskor elvesznek. Ne keverd ezt az account tokenjeinek tartós tárolásával.

## Environment State

Változónevek: DATABASE_URL, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BOOTSTRAP_ADMIN_EMAIL, MONTHLY_EXPENSES_GMAIL_EMAIL, AI_GATEWAY_API_KEY, AI_GATEWAY_MODEL, MONTHLY_EXPENSES_INVOICE_HOSTS. Értékeket/kulcsokat ne írj ki és ne másolj dokumentumba. .env és minden .env* fájl, illetve drizzle/migrations kézi szerkesztése tilos. Az ideiglenes tesztscriptek és fixture szerver eltávolítva/leállítva; a felhasználó dev szervere lehet aktív, az átadás nem ellenőrizte.

A Git safe.directory eltérés miatt korábban parancsonkénti `git -c safe.directory=C:/Users/jakuc/WebProjects/homebase` kellett. Ne módosíts globális Git-konfigurációt. A branch és a sok nem commitolt változás megőrzendő.

## Deferred Items and Related Resources

Tartós számlamentés, valódi diagram/history, családi jegyzetek, PNG/Drive/e-mail, deploy, teljes UI-elfogadás és AI-primary költségdöntés külön feladat. Olvasd a projekt README-t, a feature README-t és a feature docs/engineering/active és docs/implementation/active invoice-import dokumentumát. A szabályforrás AGENTS.md és hivatkozásai; a Next.js telepített node_modules/next/dist/docs útmutatója kódírás előtt releváns.
