import "server-only";
import { Dal } from "@/lib/dal";
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { getExpensePresets as getExpensePresetsQuery, getMonthlyExpenseReport as getMonthlyExpenseReportQuery, getMonthlyExpenseReports as getMonthlyExpenseReportsQuery, getStoredGmailConnection } from "../drizzle/operations";
import { hasStoredGmailConnection } from "../utils/gmail-connection";
import { expensePresetDtoSchema, monthlyExpenseReportListItemSchema, monthlyExpenseReportLoadedSchema } from "../zod/schema";
import type { ExpensePresetActionResult, ExpensePresetDto, MonthlyExpenseReportItem, MonthlyExpenseReportLoaded } from "../types";
import { z } from "zod";

export const getGmailConnectionStatus = Dal.create({ cache: false }).authenticate()
  .authorize({ resource: "monthlyExpenses", action: "import" })
  .operation(async ({ user }) => {
    const owner = (process.env.MONTHLY_EXPENSES_GMAIL_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL)?.trim().toLowerCase();
    if (!owner || user.email?.trim().toLowerCase() !== owner) return createSuccessReturn({ connected: false });
    const account = await getStoredGmailConnection(user.id);
    return createSuccessReturn({ connected: hasStoredGmailConnection(account) });
  });

const expensePresetsDal = Dal.create({ cache: false })
  .schema({ output: z.array(expensePresetDtoSchema) })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async () => {
    try {
      return createSuccessReturn(await getExpensePresetsQuery());
    } catch {
      return createErrorReturn({ type: "preset-storage-error", message: "A közös tételek most nem tölthetők be. Próbáld újra." });
    }
  });

const safeExpensePresetResult = (result: unknown): ExpensePresetActionResult<ExpensePresetDto[]> => {
  if (result && typeof result === "object" && "success" in result && result.success === true && "data" in result && Array.isArray(result.data)) {
    return { success: true, data: result.data as ExpensePresetDto[] };
  }
  if (result && typeof result === "object" && "success" in result && result.success === false && "error" in result) {
    const error = result.error;
    if (error && typeof error === "object" && "type" in error && error.type === "unauthenticated") {
      return { success: false, error: { type: "unauthenticated", message: "Jelentkezz be a közös tételek megtekintéséhez." } };
    }
    if (error && typeof error === "object" && "type" in error && error.type === "unauthorized") {
      return { success: false, error: { type: "unauthorized", message: "Ehhez a funkcióhoz nincs hozzáférésed." } };
    }
  }
  return { success: false, error: { type: "preset-storage-error", message: "A közös tételek most nem tölthetők be. Próbáld újra." } };
};

export const getExpensePresets = async (): Promise<ExpensePresetActionResult<ExpensePresetDto[]>> => {
  try {
    return safeExpensePresetResult(await expensePresetsDal());
  } catch {
    return { success: false, error: { type: "preset-storage-error", message: "A közös tételek most nem tölthetők be. Próbáld újra." } };
  }
};

const monthlyExpenseReportListDal = Dal.create({ cache: false })
  .schema({ output: z.array(monthlyExpenseReportListItemSchema) })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async () => {
    try {
      return createSuccessReturn(await getMonthlyExpenseReportsQuery());
    } catch {
      return createErrorReturn({ type: "report-storage-error", message: "A mentett kimutatások most nem tölthetők be." });
    }
  });

export const getMonthlyExpenseReports = async (): Promise<ExpensePresetActionResult<MonthlyExpenseReportItem[]>> => {
  try {
    const result = await monthlyExpenseReportListDal();
    if (result?.success) return { success: true, data: result.data };
  } catch { /* Return the public storage error below. */ }
  return { success: false, error: { type: "report-storage-error", message: "A mentett kimutatások most nem tölthetők be." } };
};

const monthlyExpenseReportDal = Dal.create({ cache: false })
  .$Input<[string]>()
  .schema({ input: z.tuple([monthlyExpenseReportLoadedSchema.shape.reportMonth]), output: monthlyExpenseReportLoadedSchema })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async ({ input }) => {
    try {
      const report = await getMonthlyExpenseReportQuery(input[0]);
      if (!report) return createErrorReturn({ type: "report-not-found", message: "Ehhez a hónaphoz nincs mentett kimutatás." });
      return createSuccessReturn({ reportMonth: report.reportMonth, version: report.version, snapshot: report.snapshot });
    } catch {
      return createErrorReturn({ type: "report-storage-error", message: "A kimutatás most nem tölthető be." });
    }
  });

export const getMonthlyExpenseReport = async (reportMonth: string): Promise<ExpensePresetActionResult<MonthlyExpenseReportLoaded>> => {
  try {
    const result = await monthlyExpenseReportDal(reportMonth);
    if (result?.success) return { success: true, data: result.data };
    if (result && !result.success && (result.error.type === "unauthenticated" || result.error.type === "unauthorized" || result.error.type === "report-not-found")) {
      return { success: false, error: { type: result.error.type, message: result.error.type === "unauthenticated" ? "Jelentkezz be a kimutatás megnyitásához." : result.error.type === "unauthorized" ? "Ehhez a funkcióhoz nincs hozzáférésed." : "Ehhez a hónaphoz nincs mentett kimutatás." } };
    }
  } catch { /* Return the public storage error below. */ }
  return { success: false, error: { type: "report-storage-error", message: "A kimutatás most nem tölthető be." } };
};
