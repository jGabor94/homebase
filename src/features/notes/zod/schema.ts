import { z } from "zod";

const visibleText = (content: string) => content
  .replace(/^\s{0,3}(?:[-*+]\s+|\d+\.\s+)/gm, "")
  .replace(/(?:\*\*|__|\*|_)/g, "")
  .replace(/[\r\n\s]/g, "").length > 0;

export const noteContentSchema = z.string()
  .max(5000, { message: "A jegyzet legfeljebb 5000 karakter lehet." })
  .refine(visibleText, { message: "Írj legalább egy látható karaktert a jegyzetbe." });

export const noteFieldsSchema = z.object({
  title: z.union([
    z.string().trim().max(120, { message: "A cím legfeljebb 120 karakter lehet." }),
    z.null(),
  ]),
  content: noteContentSchema,
  visibility: z.enum(["private", "family"], { message: "Válassz érvényes láthatóságot." }),
});

export const noteFormSchema = noteFieldsSchema.extend({
  title: z.string().trim().max(120, { message: "A cím legfeljebb 120 karakter lehet." })
    .transform((value) => value || null),
});
export const noteCreateSchema = noteFieldsSchema;
export const noteUpdateSchema = noteFieldsSchema.extend({
  id: z.string().uuid({ message: "Érvénytelen jegyzetazonosító." }),
  expectedVersion: z.number().int().min(1).max(2_147_483_646),
});
export const noteDeleteSchema = z.object({
  id: z.string().uuid({ message: "Érvénytelen jegyzetazonosító." }),
  expectedVersion: z.number().int().min(1).max(2_147_483_647),
});
export const noteIdSchema = z.string().uuid({ message: "Érvénytelen jegyzetazonosító." });
export const noteCursorSchema = z.object({
  updatedAt: z.string().datetime({ message: "Érvénytelen lapozási időpont." }),
  id: noteIdSchema,
}).nullable();
export const noteCardSchema = z.object({
  id: noteIdSchema,
  ownerId: z.string().min(1),
  ownerName: z.string().nullable(),
  title: z.string().nullable(),
  content: noteContentSchema,
  visibility: z.enum(["private", "family"]),
  version: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const notePageSchema = z.object({
  notes: z.array(noteCardSchema),
  nextCursor: noteCursorSchema,
});
