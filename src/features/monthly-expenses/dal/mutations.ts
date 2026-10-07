"use server";

import { Dal } from "@/lib/dal";
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { z } from "zod";
import { getGoogleAccess, GmailAccessError } from "../lib/google-access";
import { collectGmailDocuments, fetchGmailInvoicePdf } from "../lib/gmail";
import { getSafeInvoiceErrorMessage, InvoiceProcessingError } from "../lib/errors";
import { parsePdfDocument } from "../lib/pdf";
import { extractInvoiceRowsFromPdf } from "../lib/extract-invoice";
import { gmailDocumentReferenceSchema, invoiceMonthKeySchema } from "../zod/schema";
import type { GmailDocumentReference, GmailCollectionResult, InvoiceImportResult } from "../types";

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
