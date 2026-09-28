# AGENTS.md — features/

Ez a fájl a `src/features/` alatti egyes feature-mappákra (pl. `users/`, `folders/`, `classes/` stb.) vonatkozó specifikus szabályokat írja le. Az általános projektinformációkért lásd a gyökér `AGENTS.md`-t.

## Feature mappa felépítése

Minden feature mappa (pl. `features/users/`) a gyökér `src/` struktúráját tükrözi — lehet benne saját `components/`, `hooks/`, `lib/`, `utils/`, `types.ts`, `providers/`, csak feature-specifikus tartalommal.

Ez a pontos mappastruktúra és a gyökérhez képest a **különbség**:

```
features/
  <feature-name>/
    docs/
      engineering/
        active/
        archive/
      implementation/
        active/
        archive/
    dal/
      queries.ts       # GET jellegű lekérdezések
      mutations.ts     # mutációs lekérdezések (create/update/delete)
    drizzle/
      schema.ts        # Drizzle séma definíció
      operations.ts    # nyers Drizzle adatbázis lekérdezések (pl. getUserById)
    zod/
      schema.ts        # feature-specifikus Zod sémák
    components/
    hooks/
    lib/
    utils/             # segédfüggvények stb.
    types.ts           # feature mappában minden típus gyűjtőhelye
    README.md          # feature leírása
    providers/
```

# zod/schema.ts
felduzzadt schema.ts fájl esetén szervezd a sémákat külön fájlba

# utils/
alapesetben index.ts-be menjen minden. felduzzadt index.ts fájl esetén szervezd a utils-eket külön fájlba
