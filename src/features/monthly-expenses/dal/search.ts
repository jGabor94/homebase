import "server-only";
import { z } from "zod";
import { Dal } from "@/lib/dal";
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { searchMonthlyExpenseRecords } from "../drizzle/search";

const searchInputSchema = z.string().trim().min(2).max(120);
export const monthlyExpenseSearchItemSchema = z.object({
  reportMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  updatedAt: z.string().datetime(),
  providerName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
});
const monthlyExpenseSearchDal = Dal.create({ cache: false }).$Input<[string]>()
  .schema({ input: z.tuple([searchInputSchema]), output: z.array(monthlyExpenseSearchItemSchema) })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async ({ input }) => {
    try {
      return createSuccessReturn(await searchMonthlyExpenseRecords(searchInputSchema.parse(input[0])));
    } catch {
      return createErrorReturn({ type: "monthly-search-storage-error" });
    }
  });

export type MonthlyExpenseSearchItem = z.infer<typeof monthlyExpenseSearchItemSchema>;
export type MonthlyExpenseSearchResult =
  | { success: true; data: MonthlyExpenseSearchItem[] }
  | { success: false; error: { type: string; message: string } };

export const searchMonthlyExpenses = async (query: string): Promise<MonthlyExpenseSearchResult> => {
  try {
    const result = await monthlyExpenseSearchDal(query);
    if (result?.success) return { success: true, data: result.data };
    if (result && !result.success && result.error.type === "unauthenticated") {
      return { success: false, error: { type: "unauthenticated", message: "Jelentkezz be a közműkimutatások kereséséhez." } };
    }
    if (result && !result.success && result.error.type === "unauthorized") {
      return { success: false, error: { type: "unauthorized", message: "A közműkimutatások keresése nem érhető el a fiókodban." } };
    }
  } catch { /* Return the safe search error below. */ }
  return { success: false, error: { type: "monthly-search-error", message: "A közműkimutatások most nem kereshetők." } };
};
