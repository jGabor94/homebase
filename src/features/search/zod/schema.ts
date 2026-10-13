import { z } from "zod";

export const globalSearchQuerySchema = z.string().trim()
  .min(2, { message: "Adj meg legalább két karaktert a kereséshez." })
  .max(120, { message: "A keresés legfeljebb 120 karakter lehet." });

export const globalSearchItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  href: z.string().startsWith("/app/"),
  updatedAt: z.string().datetime().nullable(),
});

export const globalSearchGroupSchema = z.object({
  items: z.array(globalSearchItemSchema).max(10),
  error: z.string().nullable(),
});

export const globalSearchResponseSchema = z.object({
  notes: globalSearchGroupSchema,
  monthlyExpenses: globalSearchGroupSchema,
});
