import { z } from "zod";
import { invoiceMonthKeySchema } from "./schema";

const summaryLabelSchema = z.string().min(1).max(120).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));

export const summaryExportFormatSchema = z.enum(["pdf", "png", "txt"]);

export const sendSummaryEmailSchema = z.object({
  reportMonth: invoiceMonthKeySchema,
  format: summaryExportFormatSchema,
  total: summaryLabelSchema,
  half: summaryLabelSchema,
  attachmentBase64: z.string().min(1).max(2_800_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
