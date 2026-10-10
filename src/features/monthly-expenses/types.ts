import { z } from "zod";
import { expensePresetsTable } from "./drizzle/schema";
import {
  aiInvoiceListSchema,
  additionalItemSchema,
  gmailCandidateSchema,
  gmailCollectionResultSchema,
  gmailDocumentReferenceSchema,
  invoiceImportResultSchema,
  invoiceMonthInputSchema,
  invoiceReportFormSchema,
  invoiceRowSchema,
  expensePresetFormSchema,
  expensePresetIdSchema,
  updateExpensePresetSchema,
} from "./zod/schema";

export type InvoiceRowInput = z.infer<typeof invoiceRowSchema>;
export type AdditionalItemInput = z.infer<typeof additionalItemSchema>;
export type InsertExpensePreset = typeof expensePresetsTable.$inferInsert;
export type SelectExpensePreset = typeof expensePresetsTable.$inferSelect;
export type ExpensePresetList = Awaited<ReturnType<typeof import("./drizzle/operations").getExpensePresets>>;
export type ExpensePresetDto = ExpensePresetList[number];
export type ExpensePresetActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { type: string; message: string } };
export type ExpensePresetFormInput = z.infer<typeof expensePresetFormSchema>;
export type ExpensePresetIdInput = z.infer<typeof expensePresetIdSchema>;
export type UpdateExpensePresetInput = z.infer<typeof updateExpensePresetSchema>;
export type InvoiceReportInput = z.infer<typeof invoiceReportFormSchema>;
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
