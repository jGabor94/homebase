"use server";

import { Dal } from "@/lib/dal";
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { invoicesTable, monthlyExpenseReportsTable } from "../drizzle/schema";
import { getMonthlyExpenseReport as getMonthlyExpenseReportQuery } from "./queries";
import { getGoogleAccess, GmailAccessError } from "../lib/google-access";
import { collectGmailDocuments, fetchGmailInvoicePdf } from "../lib/gmail";
import { getSafeInvoiceErrorMessage, InvoiceProcessingError } from "../lib/errors";
import { parsePdfDocument } from "../lib/pdf";
import { extractInvoiceRowsFromPdf } from "../lib/extract-invoice";
import { gmailDocumentReferenceSchema, invoiceMonthKeySchema, monthlyExpenseReportDeleteSchema, monthlyExpenseReportSaveSchema, monthlyExpenseReportSavedSchema } from "../zod/schema";
import type { ExpensePresetActionResult, GmailDocumentReference, GmailCollectionResult, InvoiceImportResult, InvoiceReportInput, MonthlyExpenseReportDeleteInput, MonthlyExpenseReportLoaded, MonthlyExpenseReportSaveInput, MonthlyExpenseReportSaved } from "../types";
import { toStoredInvoice } from "../utils/invoice-storage";

const validReportMonth = invoiceMonthKeySchema.refine((month) => {
  const year = Number(month.slice(0, 4));
  return year >= 2000 && year <= 2100;
}, { message: "A hónapnak 2000 és 2100 közé kell esnie." });

const publicError = (type: string) => {
  if (type === "unauthenticated") return { type, message: "A Gmail-számlák megtekintéséhez jelentkezz be." };
  if (type === "unauthorized" || type === "gmail-owner-required") return { type: "unauthorized", message: "Ehhez a funkcióhoz nincs hozzáférésed." };
  if (type.startsWith("zod-") || type === "validation-error") return { type: "validation-error", message: "Érvénytelen hónap vagy számlahivatkozás." };
  return { type: "invoice-import-error", message: "A számlafeldolgozás most nem sikerült. Próbáld újra, vagy vidd fel kézzel." };
};

const safeFailure = (error: unknown) => {
  if (error instanceof InvoiceProcessingError) return createErrorReturn({ type: error.code, message: error.message });
  if (error instanceof GmailAccessError) return createErrorReturn({ type: error.requiresReconnect ? "gmail-reconnect-required" : "gmail-access-error", message: error.message });
  const fallback = publicError("");
  return createErrorReturn({ type: "invoice-import-error", message: getSafeInvoiceErrorMessage(error, fallback.message) });
};

const gmailCollection = Dal.create({ cache: false })
  .$Input<[string]>()
  .schema({ input: z.tuple([validReportMonth]) })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "import" })
  .operation(async ({ user, input }) => {
    try {
      const access = await getGoogleAccess(user);
      const result = await collectGmailDocuments(access.accessToken, input[0]);
      return createSuccessReturn(result satisfies GmailCollectionResult);
    } catch (error) {
      return safeFailure(error);
    }
  });

const gmailInvoiceImport = Dal.create({ cache: false })
  .$Input<[GmailDocumentReference]>()
  .schema({ input: z.tuple([gmailDocumentReferenceSchema]) })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "import" })
  .operation(async ({ user, input }) => {
    try {
      const reference = input[0] as GmailDocumentReference;
      const access = await getGoogleAccess(user);
      const fetched = await fetchGmailInvoicePdf(access.accessToken, reference);
      const parsed = await parsePdfDocument(fetched.bytes);
      const result = await extractInvoiceRowsFromPdf(parsed, fetched.bytes, fetched.context);
      return createSuccessReturn(result satisfies InvoiceImportResult);
    } catch (error) {
      return safeFailure(error);
    }
  });

const normalizeFailure = <T,>(result: { success: true; data: T } | { success: false; error: { type?: string; message?: string } } | undefined) => {
  if (!result) return createErrorReturn({ type: "invoice-import-error", message: "A számlafeldolgozás nem adott eredményt." });
  if (result.success) return result;
  const type = result.error.type ?? "invoice-import-error";
  if (typeof result.error.message === "string" && result.error.message.length <= 300) {
    return createErrorReturn({ type, message: result.error.message });
  }
  return createErrorReturn(publicError(type));
};

export const collectGmailInvoices = async (reportMonth: string) => {
  try {
    return normalizeFailure(await gmailCollection(reportMonth));
  } catch (error) {
    return safeFailure(error);
  }
};

export const importGmailInvoice = async (reference: GmailDocumentReference) => {
  try {
    return normalizeFailure(await gmailInvoiceImport(reference));
  } catch (error) {
    return safeFailure(error);
  }
};

const saveMonthlyExpenseReportDal = Dal.create({ cache: false })
  .$Input<[MonthlyExpenseReportSaveInput]>()
  .schema({ input: z.tuple([monthlyExpenseReportSaveSchema]), output: monthlyExpenseReportSavedSchema })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async ({ input }) => {
    const { snapshot, expectedVersion } = input[0];
    try {
      const result = await db.transaction(async (transaction) => {
        let parent: { id: string; reportMonth: string; version: number; updatedAt: Date } | undefined;
        if (expectedVersion === null) {
          const [created] = await transaction.insert(monthlyExpenseReportsTable).values({
            id: crypto.randomUUID(), reportMonth: snapshot.reportMonth, version: 1, additionalItems: snapshot.additionalItems,
          }).onConflictDoNothing({ target: monthlyExpenseReportsTable.reportMonth }).returning({
            id: monthlyExpenseReportsTable.id, reportMonth: monthlyExpenseReportsTable.reportMonth,
            version: monthlyExpenseReportsTable.version, updatedAt: monthlyExpenseReportsTable.updatedAt,
          });
          parent = created;
        } else {
          const [updated] = await transaction.update(monthlyExpenseReportsTable).set({
            additionalItems: snapshot.additionalItems, version: expectedVersion + 1, updatedAt: new Date(),
          }).where(and(eq(monthlyExpenseReportsTable.reportMonth, snapshot.reportMonth), eq(monthlyExpenseReportsTable.version, expectedVersion)))
            .returning({
              id: monthlyExpenseReportsTable.id, reportMonth: monthlyExpenseReportsTable.reportMonth,
              version: monthlyExpenseReportsTable.version, updatedAt: monthlyExpenseReportsTable.updatedAt,
            });
          parent = updated;
        }
        if (!parent) return { kind: expectedVersion === null ? "month-conflict" as const : "version-conflict" as const };

        await transaction.delete(invoicesTable).where(eq(invoicesTable.reportId, parent.id));
        if (snapshot.invoices.length > 0) {
          await transaction.insert(invoicesTable).values(snapshot.invoices.map((invoice, position) => toStoredInvoice(invoice, parent.id, position)));
        }
        return {
          kind: "saved" as const,
          report: { id: parent.id, reportMonth: parent.reportMonth, version: parent.version, updatedAt: parent.updatedAt },
        };
      });

      if (result.kind === "month-conflict") return createErrorReturn({ type: "report-month-conflict", message: "Ehhez a hónaphoz már van mentett kimutatás. Nyisd meg a listából, vagy válassz másik hónapot." });
      if (result.kind === "version-conflict") return createErrorReturn({ type: "report-version-conflict", message: "Ezt a kimutatást közben máshol módosították. A helyi változtatásaid megmaradtak; töltsd be a legfrissebb mentést, vagy másold ki őket." });
      if (result.kind !== "saved" || !result.report) return createErrorReturn({ type: "report-storage-error", message: "A kimutatás most nem menthető. Próbáld újra." });
      return createSuccessReturn({ reportMonth: result.report.reportMonth, version: result.report.version, updatedAt: result.report.updatedAt.toISOString() });
    } catch {
      return createErrorReturn({ type: "report-storage-error", message: "A kimutatás most nem menthető. Próbáld újra." });
    }
  });

const publicReportError = (type: string) => {
  if (type === "unauthenticated") return { type, message: "Jelentkezz be a kimutatás mentéséhez." };
  if (type === "unauthorized") return { type, message: "Ehhez a funkcióhoz nincs hozzáférésed." };
  if (type === "report-month-conflict") return { type, message: "Ehhez a hónaphoz már van mentett kimutatás. Nyisd meg a listából, vagy válassz másik hónapot." };
  if (type === "report-version-conflict") return { type, message: "Ezt a kimutatást közben máshol módosították. A helyi változtatásaid megmaradtak; töltsd be a legfrissebb mentést, vagy másold ki őket." };
  if (type.startsWith("zod-") || type === "validation-error") return { type: "validation-error", message: "Ellenőrizd a kimutatás hónapját, sorait és összegeit." };
  return { type: "report-storage-error", message: "A kimutatás most nem menthető. Próbáld újra." };
};

export async function saveMonthlyExpenseReport(snapshot: InvoiceReportInput, expectedVersion: number | null): Promise<ExpensePresetActionResult<MonthlyExpenseReportSaved>> {
  try {
    const result = await saveMonthlyExpenseReportDal({ snapshot, expectedVersion });
    if (result?.success) {
      try { revalidatePath("/app/monthly-expenses"); } catch { /* The page reads fresh database data on navigation. */ }
      return { success: true, data: result.data };
    }
    if (result && !result.success) return { success: false, error: publicReportError(result.error.type) };
  } catch { /* Return the public storage error below. */ }
  return { success: false, error: publicReportError("report-storage-error") };
}

export async function loadMonthlyExpenseReport(reportMonth: string): Promise<ExpensePresetActionResult<MonthlyExpenseReportLoaded>> {
  try {
    const result = await getMonthlyExpenseReportQuery(reportMonth);
    if (result.success) return { success: true, data: result.data };
    return { success: false, error: result.error };
  } catch { /* Return the public storage error below. */ }
  return { success: false, error: { type: "report-storage-error", message: "A kimutatás most nem tölthető be." } };
}

const deleteMonthlyExpenseReportDal = Dal.create({ cache: false })
  .$Input<[MonthlyExpenseReportDeleteInput]>()
  .schema({ input: z.tuple([monthlyExpenseReportDeleteSchema]) })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async ({ input }) => {
    const { reportMonth, expectedVersion } = input[0];
    const [deleted] = await db.delete(monthlyExpenseReportsTable)
      .where(and(eq(monthlyExpenseReportsTable.reportMonth, reportMonth), eq(monthlyExpenseReportsTable.version, expectedVersion)))
      .returning({ reportMonth: monthlyExpenseReportsTable.reportMonth });
    if (!deleted) return createErrorReturn({ type: "report-delete-conflict", message: "A kimutatást közben módosították vagy törölték. Frissítsd az oldalt a törlés előtt." });
    return createSuccessReturn(deleted);
  });

export async function deleteMonthlyExpenseReport(input: MonthlyExpenseReportDeleteInput): Promise<ExpensePresetActionResult<{ reportMonth: string }>> {
  try {
    const result = await deleteMonthlyExpenseReportDal(input);
    if (result?.success) {
      try { revalidatePath("/app/monthly-expenses"); } catch { /* The local list also removes the deleted report. */ }
      return { success: true, data: result.data };
    }
    const type = result && !result.success ? result.error.type : "report-storage-error";
    if (type === "unauthenticated") return { success: false, error: { type, message: "Jelentkezz be a kimutatás törléséhez." } };
    if (type === "unauthorized") return { success: false, error: { type, message: "Ehhez a funkcióhoz nincs hozzáférésed." } };
    if (type === "report-delete-conflict") return { success: false, error: { type, message: "A kimutatást közben módosították vagy törölték. Frissítsd az oldalt a törlés előtt." } };
    if (type.startsWith("zod-")) return { success: false, error: { type: "validation-error", message: "Érvénytelen kimutatásazonosító vagy verzió." } };
  } catch { /* Return a public error without database details. */ }
  return { success: false, error: { type: "report-storage-error", message: "A kimutatás most nem törölhető. Próbáld újra." } };
}
