import { z } from "zod";
import type { CONSUMPTION_UNITS } from "./config";
import { expensePresetsTable, invoicesTable, monthlyExpenseReportsTable } from "./drizzle/schema";
import {
  aiInvoiceListSchema,
  additionalItemSchema,
  gmailCandidateSchema,
  gmailCollectionResultSchema,
  gmailDocumentReferenceSchema,
  invoiceImportResultSchema,
  invoiceMonthInputSchema,
  invoiceReportFormSchema,
  monthlyExpenseReportListItemSchema,
  monthlyExpenseReportLoadedSchema,
  monthlyExpenseReportSaveSchema,
  monthlyExpenseReportDeleteSchema,
  monthlyExpenseReportSavedSchema,
  invoiceRowSchema,
  expensePresetFormSchema,
  expensePresetIdSchema,
  updateExpensePresetSchema,
} from "./zod/schema";

export type InvoiceRowInput = z.infer<typeof invoiceRowSchema>;
export type ConsumptionUnit = typeof CONSUMPTION_UNITS[number];
export type AdditionalItemInput = z.infer<typeof additionalItemSchema>;
export type InsertExpensePreset = typeof expensePresetsTable.$inferInsert;
export type SelectExpensePreset = typeof expensePresetsTable.$inferSelect;
export type InsertMonthlyExpenseReport = typeof monthlyExpenseReportsTable.$inferInsert;
export type SelectMonthlyExpenseReport = typeof monthlyExpenseReportsTable.$inferSelect;
export type InsertInvoice = typeof invoicesTable.$inferInsert;
export type SelectInvoice = typeof invoicesTable.$inferSelect;
export type CompleteInsertInvoice = InsertInvoice & Omit<SelectInvoice, "createdAt" | "updatedAt">;
export type ExpensePresetList = Awaited<ReturnType<typeof import("./drizzle/operations").getExpensePresets>>;
export type ExpensePresetDto = ExpensePresetList[number];
export type ExpensePresetActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { type: string; message: string } };
export type ExpensePresetFormInput = z.infer<typeof expensePresetFormSchema>;
export type ExpensePresetIdInput = z.infer<typeof expensePresetIdSchema>;
export type UpdateExpensePresetInput = z.infer<typeof updateExpensePresetSchema>;
export type InvoiceReportInput = z.infer<typeof invoiceReportFormSchema>;
export type MonthlyExpenseReportSaveInput = z.infer<typeof monthlyExpenseReportSaveSchema>;
export type MonthlyExpenseReportDeleteInput = z.infer<typeof monthlyExpenseReportDeleteSchema>;
export type MonthlyExpenseReportSaved = z.infer<typeof monthlyExpenseReportSavedSchema>;
export type MonthlyExpenseReportLoaded = z.infer<typeof monthlyExpenseReportLoadedSchema>;
export type MonthlyExpenseReportListItemDto = z.infer<typeof monthlyExpenseReportListItemSchema>;
export type MonthlyExpenseReportList = Awaited<ReturnType<typeof import("./drizzle/operations").getMonthlyExpenseReports>>;
export type MonthlyExpenseReportItem = MonthlyExpenseReportList[number];
export type InvoiceMonthInput = z.infer<typeof invoiceMonthInputSchema>;
export type GmailCandidate = z.infer<typeof gmailCandidateSchema>;
export type GmailDocumentReference = z.infer<typeof gmailDocumentReferenceSchema>;
export type GmailCollectionResult = z.infer<typeof gmailCollectionResultSchema>;
export type InvoiceImportResult = z.infer<typeof invoiceImportResultSchema>;
export type AiInvoiceList = z.infer<typeof aiInvoiceListSchema>;
export type SummaryExportFormat = "pdf" | "png" | "txt";
export interface SummaryInvoiceExportRow {
  category: string;
  provider: string;
  amount: string;
  details: string[];
}
export interface SummaryAdditionalExportRow {
  name: string;
  amount: string;
}
export interface SummaryExportSnapshot {
  reportMonth: string;
  monthLabel: string;
  invoiceLines: string[];
  additionalLines: string[];
  invoiceRows: SummaryInvoiceExportRow[];
  additionalRows: SummaryAdditionalExportRow[];
  warnings: string[];
  total: string;
  half: string;
}
export type InvoiceField = InvoiceRowInput["manuallyEditedFields"][number];
export type InvoiceIssue = InvoiceRowInput["issues"][number];
export type InvoiceSource = InvoiceRowInput["sources"][number];
export type StoredGmailConnection = Awaited<ReturnType<typeof import("./drizzle/operations").getStoredGmailConnection>>;
export type UtilityHistoryMonth = Awaited<ReturnType<typeof import("./utils/consumption").buildUtilityHistoryMonth>>;
