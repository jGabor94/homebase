---
name: form-creation
description: Use this skill whenever creating a new form component. Defines the react-hook-form + zod wiring, and where the zod schema and the inferred input type must live.
---

# Form létrehozási konvenció

Minden form **react-hook-form**-mal és **zod** validációval készül, a `zodResolver`-en keresztül összekötve. A séma és a típus mindig két külön, fix helyen lakik — sose definiáld helyben, a komponensben.

## Hol mi lakik

| Mi | Hol | Példa |
|---|---|---|
| Zod séma | `features/<feature-name>/zod/schema.ts` | `setFormSchema` |
| Inferált input típus | `features/<feature-name>/types.ts` | `SetInput` |
| `useForm` hívás | a form komponensben | — |

## 1. Zod séma — `zod/schema.ts`

```typescript
export const setFormSchema = z.object({
    name: z.string().min(1, { message: "Gyűjtemény nevének megadása kötelező!" }),
    preferredTermLang: z.enum(languageCodes),
    preferredDefinitionLang: z.enum(languageCodes),
})
```

- A séma neve a form céljából képződik, camelCase, `FormSchema` szuffixummal
  (pl. `setFormSchema`, `userFormSchema`).
- Minden mezőnél adj meg magyar nyelvű, felhasználóbarát hibaüzenetet
  (`{ message: "..." }"`), ne az alapértelmezett zod hibaszöveget hagyd.
- Ha a mező egy meglévő enumra/union típusra hivatkozik (pl. nyelvkódok),
  azt importáld, ne írd be szó szerint még egyszer.

## 2. Inferált típus — `types.ts`

```typescript
export type SetInput = z.infer<typeof setFormSchema>
```

- A típusnév a séma nevéből képződik: a `FormSchema` szuffixot `Input`-ra
  cseréled, PascalCase-ben (pl. `setFormSchema` → `SetInput`,
  `userFormSchema` → `UserInput`).
- Ne írj kézzel duplikált interfészt a form mezőihez — mindig
  `z.infer<typeof ...>`-tal vezesd le, hogy séma-módosításkor a típus is
  frissüljön.

## 3. `useForm` a komponensben

```typescriptreact
const form = useForm<SetInput>({
    mode: "all",
    resolver: zodResolver(setFormSchema)
});
```

- Mindig `mode: "all"` — validáció blur-re, change-re és submitra is fusson.
- A `resolver` mindig `zodResolver(<séma>)`, ahol `<séma>` a `zod/schema.ts`-ből
  importált séma.
- A `useForm` generikus paramétere mindig a `types.ts`-ből importált,
  sémából levezetett input típus.

## Beküldés eredményének visszajelzése

Minden form eredménye `react-hot-toast`-tal jelenik meg (siker és hiba esetén is)
