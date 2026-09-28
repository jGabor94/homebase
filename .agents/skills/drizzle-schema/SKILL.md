---
name: drizzle-schema
description: Use this skill whenever creating or extending a Drizzle table in a feature's `drizzle/schema.ts` file. Defines the table definition conventions (withRLS, naming, timestamps) and the required companion type exports in `types.ts`.
---

# Drizzle séma létrehozási konvenció

## Tábla definíció

Új táblát **mindig** `pgTable.withRLS(...)`-szal hozz létre, sosem sima
`pgTable(...)`-lal — a projektben minden táblán RLS van, kivétel nincs.

A gyökér `src/drizzle/schemaTypes.ts` tartalmazza a táblák közt megosztott
oszlop-definíciókat (jelenleg: `createdAt`, `updatedAt`). Ha egy új, több
táblán is ismétlődő oszlopmintát vezetsz be, azt is ide vedd fel megosztott
exportként — ne másold be ugyanazt a definíciót több `schema.ts`-be.

## PÉLDA TÁBLA DEFINÍCIÓ
```typescript
import { createdAt, updatedAt } from "@/drizzle/schemaTypes";

export const dubbingsTable = pgTable.withRLS("dubbings", {
  id: text().primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  storagePath: text("storage_path"),
  mimeType: varchar("mime_type", { length: 100 }).default("audio/mpeg").notNull(),
  status: varchar({ length: 20 }).default("queued").notNull(),
  progress: integer().default(0).notNull(),
  errorMessage: text("error_message"),
  attempts: integer().default(0).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
}, (table) => [
  unique("dubbings_storage_path_key").on(table.storagePath),
]);
```

### Névadási szabályok

- **Tábla neve** (a `withRLS` első paramétere): többes szám, snake_case,
  angolul (pl. `"dubbings"`, `"accounts"`).
- **Exportált konstans neve**: a tábla nevéből `Table` szuffixummal,
  camelCase (pl. `dubbingsTable`, `accountsTable`).
- **Oszlop property neve** (JS oldal): camelCase (pl. `userId`, `storagePath`).
- **Oszlop DB neve**: snake_case.
  - Ha a property egyetlen szóból áll, és camelCase-ben megegyezik a
    snake_case alakkal (pl. `id`, `status`, `progress`), **nem kell** explicit
    nevet megadni.
  - Ha a property több szóból áll (pl. `userId`, `sourceUrl`, `storagePath`,
    `errorMessage`), **mindig** add meg explicit módon a snake_case DB nevet
    második paraméterként, pl. `text("user_id")`, `varchar("mime_type", { length: 100 })`.

### Kötelező/gyakori mezők

- Ha a táblának van létrehozási/módosítási időbélyege, **soha ne** definiáld
  helyben, hanem importáld a gyökér `drizzle/schemaTypes.ts`-ből, és úgy
  vedd fel a mezők közé, ahogy fent a `dubbingsTable` példában:
  ```typescript
  import { createdAt, updatedAt } from "@/drizzle/schemaTypes";
  // ...
  createdAt,
  updatedAt,
  ```
  Ez a két oszlop központilag van definiálva (`createdAt` = `default(now())`,
  `updatedAt` = `default(now())` + `$onUpdate(() => new Date())`), így minden
  táblán konzisztens a viselkedésük — ne írj hozzájuk saját `timestamp(...)`
  definíciót.


## Kötelező típusgenerálás

Minden új táblához **azonnal** vegyél fel hozzá `Insert`/`Select` típust a
feature gyökerében lévő `types.ts`-be, a Drizzle `$inferInsert` /
`$inferSelect` segítségével:

```typescript
export type InsertDubbing = typeof dubbingsTable.$inferInsert;
export type SelectDubbing = typeof dubbingsTable.$inferSelect;
```

- A típusnév a tábla nevéből képződik `Table` szuffix nélkül, PascalCase-ben
  (pl. `dubbingsTable` → `Dubbing`, `accountsTable` → `Account`).
- Ezt a lépést sose hagyd ki — nem lehet olyan tábla, aminek nincs
  `Insert<Name>`/`Select<Name>` párja a `types.ts`-ben.
- Ezeket a generált típusokat használd mindenhol, ahol a tábla soraira
  hivatkozol (DAL réteg, Zod séma be-/kimenete, komponens props, server
  action paraméterek/válaszok) — ne írj kézzel duplikált interfészt vagy
  inline típust ugyanarra az adatstruktúrára.
- Kézzel írt típust csak akkor hozz létre, ha a tábla típusától eltérő,
  levezetett/kompozit alakra van szükség (pl. join eredménye, DTO extra
  mezőkkel) — ilyenkor is az `Insert`/`Select` típusból építkezz
  (`Pick`, `Omit`, `&` intersection), ne írd újra a mezőket.