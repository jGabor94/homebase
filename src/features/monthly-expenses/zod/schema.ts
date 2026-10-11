import z from "zod";
import { CONSUMPTION_UNITS, DOCUMENT_TYPES, INVOICE_CATEGORIES, INVOICE_FIELDS, INVOICE_ISSUES } from "../config";

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const optionalDateSchema = z.string().nullable().refine((value) => value === null || isCalendarDate(value), {
  message: "Adj meg valós, ÉÉÉÉ-HH-NN formátumú dátumot.",
});

const reportMonthSchema = z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/, {
  message: "Válassz valós hónapot.",
});

const evidenceSchema = z.object({
  page: z.number().int().min(1).max(30),
  quote: z.string().min(1).max(500),
});

const fieldEvidenceSchema = z.object({
  providerName: evidenceSchema.optional(),
  category: evidenceSchema.optional(),
  invoiceNumber: evidenceSchema.optional(),
  amountMinor: evidenceSchema.optional(),
  currency: evidenceSchema.optional(),
  dueDate: evidenceSchema.optional(),
  billingPeriod: evidenceSchema.optional(),
  issuedAt: evidenceSchema.optional(),
  consumptionQuantity: evidenceSchema.optional(),
  consumptionUnit: evidenceSchema.optional(),
});

const sourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("gmail"),
    messageId: z.string().min(1).max(200),
    fileName: z.string().min(1).max(200),
    attachmentId: z.string().min(1).max(2048).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value)).optional(),
    linkIndex: z.number().int().min(0).max(50).optional(),
    reportMonth: reportMonthSchema,
    invoiceIndex: z.number().int().min(1).max(10),
    sentAt: z.string().datetime().nullable(),
    receivedAt: z.string().datetime().nullable(),
    documentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    pages: z.array(z.number().int().min(1).max(30)).max(30),
  }).refine((source) => Boolean(source.attachmentId) !== (source.linkIndex !== undefined), {
    message: "A Gmail-forrás egy mellékletet vagy egy letöltőlinket jelölhet.",
  }),
  z.object({
    kind: z.literal("upload"),
    documentId: z.string().uuid(),
    fileName: z.string().min(1).max(200),
    documentHash: z.string().regex(/^[a-f0-9]{64}$/),
    reportMonth: reportMonthSchema,
    invoiceIndex: z.number().int().min(1).max(10),
    pages: z.array(z.number().int().min(1).max(30)).max(30),
  }),
]);

const invoiceConflictSchema = z.object({
  field: z.enum(INVOICE_FIELDS),
  keptValue: z.string().max(500).nullable(),
  incomingValue: z.string().max(500).nullable(),
  sourceLabel: z.string().max(200),
});

export const invoiceRowSchema = z.object({
  id: z.string().uuid(),
  providerName: z.string().trim().max(160, { message: "A szolgáltató neve legfeljebb 160 karakter lehet." }),
  category: z.enum(INVOICE_CATEGORIES),
  invoiceNumber: z.string().trim().max(120, { message: "A számlaszám legfeljebb 120 karakter lehet." }).nullable(),
  amountMinor: z.number().int({ message: "Az összeg fillérben, egész számmal adható meg." }).min(-9_000_000_000_000).max(9_000_000_000_000).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/, { message: "A pénznem három nagybetűből álljon." }).nullable(),
  dueDate: optionalDateSchema,
  billingPeriod: z.string().trim().max(160, { message: "Az időszak legfeljebb 160 karakter lehet." }),
  issuedAt: optionalDateSchema,
  consumptionQuantity: z.number().finite({ message: "Adj meg véges fogyasztási mennyiséget." }).min(0, { message: "A fogyasztás nem lehet negatív." }).max(1_000_000_000_000, { message: "A fogyasztási mennyiség túl nagy." }).nullable().default(null),
  consumptionUnit: z.enum(CONSUMPTION_UNITS).nullable().default(null),
  sentAt: z.string().datetime().nullable(),
  reportMonth: reportMonthSchema,
  documentType: z.enum(DOCUMENT_TYPES).nullable(),
  relatedInvoiceNumber: z.string().trim().max(120).nullable(),
  sources: z.array(sourceSchema).max(10),
  fieldEvidence: fieldEvidenceSchema,
  fieldOrigin: z.object({
    providerName: z.enum(["code", "ai", "manual"]),
    category: z.enum(["code", "ai", "manual"]),
    invoiceNumber: z.enum(["code", "ai", "manual"]),
    amountMinor: z.enum(["code", "ai", "manual"]),
    currency: z.enum(["code", "ai", "manual"]),
    dueDate: z.enum(["code", "ai", "manual"]),
    billingPeriod: z.enum(["code", "ai", "manual"]),
    issuedAt: z.enum(["code", "ai", "manual"]),
    consumptionQuantity: z.enum(["code", "ai", "manual"]).optional(),
    consumptionUnit: z.enum(["code", "ai", "manual"]).optional(),
  }),
  manuallyEditedFields: z.array(z.enum(INVOICE_FIELDS)),
  issues: z.array(z.enum(INVOICE_ISSUES)),
  conflicts: z.array(invoiceConflictSchema),
  reviewStatus: z.enum(["needs-review", "reviewed"]),
});

export const additionalItemSchema = z.object({
  id: z.string().uuid({ message: "Érvénytelen tételazonosító." }),
  presetId: z.string().uuid().optional(),
  name: z.string().trim().max(120, { message: "A tétel neve legfeljebb 120 karakter lehet." }).refine((value) => value.length > 0, {
    message: "Add meg a tétel nevét.",
  }),
  amountMinor: z.number().int({ message: "Adj meg érvényes összeget." }).min(0, { message: "Az összeg nem lehet negatív." }).max(9_000_000_000_000, { message: "Az összeg túl nagy." }).nullable().refine((value): boolean => value !== null, {
    message: "Add meg az összeget.",
  }),
  isDefault: z.boolean(),
});

export const invoiceReportFormSchema = z.object({
  reportMonth: reportMonthSchema,
  invoices: z.array(invoiceRowSchema).max(100, { message: "Egy kimutatásban legfeljebb 100 számlasor lehet." }),
  additionalItems: z.array(additionalItemSchema).max(100, { message: "Egy kimutatásban legfeljebb 100 számla nélküli tétel lehet." }),
}).superRefine((report, context) => {
  const ids = new Set<string>();
  const addId = (id: string, path: Array<string | number>) => {
    if (ids.has(id)) context.addIssue({ code: "custom", message: "A kimutatás sorazonosítói nem ismétlődhetnek.", path });
    ids.add(id);
  };
  report.invoices.forEach((invoice, index) => {
    addId(invoice.id, ["invoices", index, "id"]);
    if (invoice.reportMonth !== report.reportMonth) context.addIssue({ code: "custom", message: "Minden számlának a kiválasztott hónaphoz kell tartoznia.", path: ["invoices", index, "reportMonth"] });
    invoice.sources.forEach((source, sourceIndex) => {
      if (source.reportMonth !== report.reportMonth) context.addIssue({ code: "custom", message: "A számlaforrás hónapja nem egyezik a kimutatáséval.", path: ["invoices", index, "sources", sourceIndex, "reportMonth"] });
    });
  });
  report.additionalItems.forEach((item, index) => addId(item.id, ["additionalItems", index, "id"]));
});

export const monthlyExpenseReportSaveSchema = z.object({
  snapshot: invoiceReportFormSchema,
  expectedVersion: z.number().int().min(1).max(2_147_483_646).nullable(),
});
export const monthlyExpenseReportDeleteSchema = z.object({
  reportMonth: reportMonthSchema,
  expectedVersion: z.number().int().min(1).max(2_147_483_647),
});
export const monthlyExpenseReportListItemSchema = z.object({
  reportMonth: reportMonthSchema,
  version: z.number().int().min(1),
  updatedAt: z.string().datetime(),
  rowCount: z.number().int().min(0),
  totalMinor: z.number().int(),
  totalOverflow: z.boolean(),
});
export const monthlyExpenseReportSavedSchema = z.object({
  reportMonth: reportMonthSchema,
  version: z.number().int().min(1),
  updatedAt: z.string().datetime(),
});
export const monthlyExpenseReportLoadedSchema = z.object({
  reportMonth: reportMonthSchema,
  version: z.number().int().min(1),
  snapshot: invoiceReportFormSchema,
});

export const expensePresetFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Add meg a tétel nevét." }).max(120, { message: "A név legfeljebb 120 karakter lehet." }),
  amountMinor: z.number().int({ message: "Adj meg érvényes összeget." }).min(0, { message: "Az összeg nem lehet negatív." }).max(9_000_000_000_000, { message: "Az összeg túl nagy." }).nullable().refine((value): boolean => value !== null, {
    message: "Add meg az összeget.",
  }),
  isDefault: z.boolean(),
});

export const expensePresetIdSchema = z.string().uuid({ message: "Érvénytelen sablonazonosító." });

export const updateExpensePresetSchema = expensePresetFormSchema.extend({ id: expensePresetIdSchema });

export const expensePresetDtoSchema = z.object({
  id: expensePresetIdSchema,
  name: z.string().min(1).max(120),
  amountMinor: z.number().int().min(0).max(9_000_000_000_000),
  isDefault: z.boolean(),
});

export const invoiceMonthInputSchema = z.object({
  year: z.number().int().min(2000, { message: "Az év nem lehet korábbi 2000-nél." }).max(2100, { message: "Az év legfeljebb 2100 lehet." }),
  month: z.number().int().min(1, { message: "Válassz hónapot 1 és 12 között." }).max(12, { message: "Válassz hónapot 1 és 12 között." }),
});

export const invoiceMonthKeySchema = reportMonthSchema;

export const gmailDocumentReferenceSchema = z.object({
  reportMonth: reportMonthSchema,
  messageId: z.string().regex(/^[\w-]{1,200}$/, { message: "Érvénytelen Gmail-üzenetazonosító." }),
  fileName: z.string().min(1).max(200),
  attachmentId: z.string().min(1).max(2048).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value)).optional(),
  linkIndex: z.number().int().min(0).max(50).optional(),
}).refine((reference) => Boolean(reference.attachmentId) !== (reference.linkIndex !== undefined), {
  message: "A Gmail-forrás egy mellékletet vagy egy letöltőlinket jelölhet.",
});

export const extractedInvoiceFieldSchema = z.object({
  value: z.string().max(500).nullable(),
  evidence: evidenceSchema.nullable(),
});

export const aiInvoiceSchema = z.object({
  providerName: extractedInvoiceFieldSchema,
  category: z.object({
    value: z.enum(INVOICE_CATEGORIES).nullable(),
    evidence: evidenceSchema.nullable(),
  }),
  invoiceNumber: extractedInvoiceFieldSchema,
  amount: extractedInvoiceFieldSchema,
  currency: extractedInvoiceFieldSchema,
  dueDate: extractedInvoiceFieldSchema,
  billingPeriod: extractedInvoiceFieldSchema,
  issuedAt: extractedInvoiceFieldSchema,
  consumption: extractedInvoiceFieldSchema.default({ value: null, evidence: null }),
  documentType: z.object({
    value: z.enum(DOCUMENT_TYPES).nullable(),
    evidence: evidenceSchema.nullable(),
  }),
  relatedInvoiceNumber: extractedInvoiceFieldSchema,
});

export const aiInvoiceListSchema = z.object({
  invoices: z.array(aiInvoiceSchema).max(10),
});

export const gmailCandidateSchema = z.object({
  id: z.string().min(1),
  messageId: z.string().min(1),
  fileName: z.string().min(1),
  kind: z.enum(["attachment", "link"]),
  attachmentId: z.string().optional(),
  linkIndex: z.number().int().optional(),
  sentAt: z.string().datetime().nullable(),
  receivedAt: z.string().datetime().nullable(),
});

export const gmailCollectionResultSchema = z.object({
  candidates: z.array(gmailCandidateSchema),
  // Transport completeness only; document availability and uncertain candidates use warnings.
  complete: z.boolean(),
  warnings: z.array(z.string()),
  searchedMessages: z.number().int().min(0),
});

export const invoiceImportResultSchema = z.object({
  invoices: z.array(invoiceRowSchema),
  warnings: z.array(z.string()),
});

export const utilityHistoryMonthSchema = z.object({
  reportMonth: reportMonthSchema,
  series: z.array(z.object({
    category: z.enum(INVOICE_CATEGORIES),
    unit: z.enum(CONSUMPTION_UNITS).nullable(),
    consumption: z.number().finite().nullable(),
    costMinor: z.number().int().nullable(),
    missingConsumptionCount: z.number().int().min(0),
    excludedCostCount: z.number().int().min(0),
  })),
});
