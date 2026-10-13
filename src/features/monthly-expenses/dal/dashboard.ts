import "server-only";
import { z } from "zod";
import { Dal } from "@/lib/dal";
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { INVOICE_CATEGORIES } from "../config";
import { getExpensesDashboardData, getUtilityHistoryWindowData } from "../drizzle/dashboard";
import { getBudapestToday } from "../utils/dashboard";
import { utilityHistoryMonthSchema } from "../zod/schema";
import type { ExpensePresetActionResult } from "../types";
import type { ExpensesDashboard, UtilityHistoryWindow } from "../types/dashboard";

const reportMonthSchema = z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/);
const calendarMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const dashboardSchema = z.object({
  reports: z.array(z.object({
    reportMonth: calendarMonthSchema,
    totalMinor: z.number().int().nullable(),
    partial: z.boolean(),
  })).length(6),
  deadlines: z.array(z.object({
    id: z.string().uuid(),
    providerName: z.string(),
    category: z.enum(INVOICE_CATEGORIES),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amountMinor: z.number().int(),
    reportMonth: reportMonthSchema,
  })),
  current: z.object({
    reportMonth: reportMonthSchema,
    totalMinor: z.number().int(),
    halfFormatted: z.string(),
    partial: z.boolean(),
    categories: z.array(z.object({
      category: z.enum(INVOICE_CATEGORIES),
      amountMinor: z.number().int().nullable(),
      partial: z.boolean(),
    })),
    previous: z.object({
      reportMonth: reportMonthSchema,
      totalMinor: z.number().int(),
      percentage: z.number().int(),
    }).nullable(),
  }).nullable(),
});

const expensesDashboardDal = Dal.create({ cache: false })
  .$Input<[string]>()
  .schema({ input: z.tuple([reportMonthSchema]), output: dashboardSchema })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async ({ input }) => {
    try {
      return createSuccessReturn(await getExpensesDashboardData(input[0], getBudapestToday()));
    } catch {
      return createErrorReturn({ type: "report-storage-error", message: "A havi összesítő most nem tölthető be." });
    }
  });

export const getExpensesDashboard = async (month: string): Promise<ExpensePresetActionResult<ExpensesDashboard>> => {
  try {
    const result = await expensesDashboardDal(month);
    if (result?.success) return { success: true, data: result.data };
    if (result && !result.success && (result.error.type === "unauthenticated" || result.error.type === "unauthorized")) {
      return {
        success: false,
        error: {
          type: result.error.type,
          message: result.error.type === "unauthenticated"
            ? "Jelentkezz be a havi összesítő megtekintéséhez."
            : "Ehhez a funkcióhoz nincs hozzáférésed.",
        },
      };
    }
  } catch { /* Return the public storage error below. */ }
  return { success: false, error: { type: "report-storage-error", message: "A havi összesítő most nem tölthető be." } };
};

const utilityHistoryWindowDal = Dal.create({ cache: false })
  .$Input<[string]>()
  .schema({ input: z.tuple([reportMonthSchema]), output: z.array(utilityHistoryMonthSchema) })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async ({ input }) => {
    try {
      return createSuccessReturn(await getUtilityHistoryWindowData(input[0]));
    } catch {
      return createErrorReturn({ type: "report-storage-error", message: "A fogyasztási előzmények most nem tölthetők be." });
    }
  });

export const getUtilityHistoryWindow = async (month: string): Promise<ExpensePresetActionResult<UtilityHistoryWindow>> => {
  try {
    const result = await utilityHistoryWindowDal(month);
    if (result?.success) return { success: true, data: result.data };
    if (result && !result.success && (result.error.type === "unauthenticated" || result.error.type === "unauthorized")) {
      return {
        success: false,
        error: {
          type: result.error.type,
          message: result.error.type === "unauthenticated"
            ? "Jelentkezz be a fogyasztási előzmények megtekintéséhez."
            : "Ehhez a funkcióhoz nincs hozzáférésed.",
        },
      };
    }
  } catch { /* Return the public storage error below. */ }
  return { success: false, error: { type: "report-storage-error", message: "A fogyasztási előzmények most nem tölthetők be." } };
};
