import { INVOICE_FIELDS } from "../config";
import type { AdditionalItemInput, InvoiceField, InvoiceIssue, InvoiceRowInput, InvoiceSource } from "../types";
import { formatMinorAsHuf, splitMinorAmount } from "./money";
import { isInvoiceCostEligible } from "./eligibility";
export { isInvoiceCostEligible, isUtilityConsumptionEligible } from "./eligibility";
export { buildUtilityHistoryMonth, parseConsumptionQuantityInput, parseExplicitConsumption } from "./consumption";

const unique = <T,>(items: T[]) => [...new Set(items)];

export const createEmptyInvoice = (reportMonth: string, category: InvoiceRowInput["category"] = "other"): InvoiceRowInput => ({
  id: crypto.randomUUID(),
  providerName: "",
  category,
  invoiceNumber: null,
  amountMinor: null,
  currency: "HUF",
  dueDate: null,
  billingPeriod: "",
  issuedAt: null,
  consumptionQuantity: null,
  consumptionUnit: null,
  sentAt: null,
  reportMonth,
  documentType: "invoice",
  relatedInvoiceNumber: null,
  sources: [],
  fieldEvidence: {},
  fieldOrigin: Object.fromEntries(INVOICE_FIELDS.map((field) => [field, "manual"])) as InvoiceRowInput["fieldOrigin"],
  manuallyEditedFields: [],
  issues: [],
  conflicts: [],
  reviewStatus: "needs-review",
});

export const createManualInvoiceRow = createEmptyInvoice;

export const createEmptyReport = (reportMonth: string) => ({
  reportMonth,
  invoices: [] as InvoiceRowInput[],
  additionalItems: [] as AdditionalItemInput[],
});

const cleanValue = (value: unknown) => value === null || value === undefined || value === "" ? null : String(value);

const sourceKey = (source: InvoiceSource) =>
  source.kind === "upload"
    ? `upload:${source.documentId}:${source.invoiceIndex}`
    : source.attachmentId
      ? `gmail:${source.messageId}:attachment:${source.attachmentId}:${source.invoiceIndex}`
      : `gmail:${source.messageId}:link:${source.linkIndex}:${source.invoiceIndex}`;

const sourceDocumentKey = (source: InvoiceSource) =>
  source.documentHash ? `document:${source.documentHash}:${source.invoiceIndex}` : null;

const canonicalProviderName = (providerName: string) => {
  const value = providerName.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("hu-HU").replace(/[^a-z]/gu, "");
  if (/^mvm(?:$|next|zrt|energiakereskedelmi)/u.test(value)) return "mvm";
  if (/^alfoldviz(?:$|zrt|kft|korlatolt)/u.test(value)) return "alfoldviz";
  if (/^mohu(?:$|mol|zrt|kft)/u.test(value)) return "mohu";
  return value;
};

const invoiceIdentity = (invoice: InvoiceRowInput) => {
  if (!invoice.invoiceNumber) return null;
  return `${canonicalProviderName(invoice.providerName)}|${invoice.category}|${invoice.invoiceNumber.trim().toLocaleLowerCase("hu-HU")}`;
};

const sourceHashes = (invoice: InvoiceRowInput) =>
  invoice.sources.flatMap((source) => source.documentHash ? [`${source.documentHash}:${source.invoiceIndex}`] : []);

export const getInvoiceMergeKeys = (invoice: InvoiceRowInput) => {
  const identity = invoiceIdentity(invoice);
  return unique([
    invoice.id,
    ...(identity ? [`invoice:${identity}`] : []),
    ...sourceHashes(invoice).map((hash) => `hash:${hash}`),
    ...invoice.sources.flatMap((source) => sourceDocumentKey(source) ?? []),
    ...invoice.sources.map((source) => `source:${sourceKey(source)}`),
  ]);
};

const hasSameDocument = (left: InvoiceRowInput, right: InvoiceRowInput) => {
  const documentKeys = new Set(left.sources.map(sourceDocumentKey).filter((key): key is string => key !== null));
  if (!right.sources.some((source) => {
    const key = sourceDocumentKey(source);
    return key !== null && documentKeys.has(key);
  })) return false;

  const leftIdentity = invoiceIdentity(left);
  const rightIdentity = invoiceIdentity(right);
  return !leftIdentity || !rightIdentity || leftIdentity === rightIdentity;
};

const hasSameDocumentIndex = (left: InvoiceRowInput, right: InvoiceRowInput) => {
  const documentKeys = new Set(left.sources.map(sourceDocumentKey).filter((key): key is string => key !== null));
  return right.sources.some((source) => {
    const key = sourceDocumentKey(source);
    return key !== null && documentKeys.has(key);
  });
};

const isBlank = (value: unknown) => value === null || value === undefined || value === "";

const comparableValue = (field: InvoiceField, invoice: InvoiceRowInput) => {
  const value = invoice[field];
  return field === "amountMinor" && typeof value === "number" ? String(value) : cleanValue(value);
};

const addConflict = (current: InvoiceRowInput, incoming: InvoiceRowInput, field: InvoiceField) => {
  const incomingSource = incoming.sources[0];
  const incomingValue = comparableValue(field, incoming);
  if (!incomingValue || current.conflicts.some((conflict) => conflict.field === field && conflict.incomingValue === incomingValue)) return current;

  return {
    ...current,
    issues: unique([...current.issues, "conflict" as const]),
    conflicts: [...current.conflicts, {
      field,
      keptValue: comparableValue(field, current),
      incomingValue,
      sourceLabel: incomingSource?.fileName ?? "Másik forrás",
    }],
    reviewStatus: "needs-review" as const,
  };
};

const mergeMatchedInvoice = (current: InvoiceRowInput, incoming: InvoiceRowInput) => {
  let merged = current;
  const manuallyEdited = new Set(current.manuallyEditedFields);

  for (const field of INVOICE_FIELDS) {
    const currentValue = merged[field];
    const incomingValue = incoming[field];
    if (isBlank(incomingValue)) continue;
    if (field === "providerName" && canonicalProviderName(String(currentValue ?? "")) === canonicalProviderName(String(incomingValue))) continue;
    if (manuallyEdited.has(field)) {
      if (!isBlank(currentValue) && cleanValue(currentValue) !== cleanValue(incomingValue)) {
        merged = addConflict(merged, incoming, field);
      }
      continue;
    }

    if (isBlank(currentValue)) {
      merged = {
        ...merged,
        [field]: incomingValue,
        fieldOrigin: { ...merged.fieldOrigin, [field]: incoming.fieldOrigin[field] },
        fieldEvidence: { ...merged.fieldEvidence, [field]: incoming.fieldEvidence[field] },
      };
      continue;
    }

    if (cleanValue(currentValue) !== cleanValue(incomingValue)) merged = addConflict(merged, incoming, field);
  }

  const mergedSources = unique([...merged.sources, ...incoming.sources].map((source) => [sourceKey(source), source] as const));
  const sources = [...new Map(mergedSources).values()];
  const issues = unique([...merged.issues, ...incoming.issues])
    .filter((issue) => issue !== "missing-issued-at" || merged.issuedAt === null);

  return {
    ...merged,
    sources,
    issues,
    conflicts: merged.conflicts,
    reviewStatus: issues.length > 0 || merged.reviewStatus === "needs-review" || incoming.reviewStatus === "needs-review"
      ? "needs-review" as const
      : "reviewed" as const,
  };
};

const isPossibleDuplicate = (left: InvoiceRowInput, right: InvoiceRowInput) =>
  !invoiceIdentity(left)
  && !invoiceIdentity(right)
  && canonicalProviderName(left.providerName) === canonicalProviderName(right.providerName)
  && left.category === right.category
  && left.billingPeriod.trim().toLocaleLowerCase("hu-HU") === right.billingPeriod.trim().toLocaleLowerCase("hu-HU")
  && left.billingPeriod.trim() !== ""
  && left.amountMinor !== null
  && left.amountMinor === right.amountMinor
  && left.currency === right.currency;

export const mergeImportedInvoices = (
  currentRows: InvoiceRowInput[],
  incomingRows: InvoiceRowInput[],
  deletedKeys: Iterable<string> = [],
) => {
  const deleted = new Set(deletedKeys);
  const merged = currentRows.filter((row) => !getInvoiceMergeKeys(row).some((key) => deleted.has(key)));

  for (const incoming of incomingRows) {
    if (getInvoiceMergeKeys(incoming).some((key) => deleted.has(key))) continue;
    const identity = invoiceIdentity(incoming);
    const matchingIndex = merged.findIndex((current) =>
      (identity && invoiceIdentity(current) === identity) || hasSameDocument(current, incoming));

    if (matchingIndex >= 0) {
      merged[matchingIndex] = mergeMatchedInvoice(merged[matchingIndex], incoming);
      continue;
    }

    const mismatchedSourceIndex = merged.findIndex((current) =>
      hasSameDocumentIndex(current, incoming) && Boolean(invoiceIdentity(current)) && Boolean(identity));
    if (mismatchedSourceIndex >= 0) {
      const current = merged[mismatchedSourceIndex];
      const conflicts = [...current.conflicts,
        { field: "invoiceNumber" as const, keptValue: current.invoiceNumber, incomingValue: incoming.invoiceNumber, sourceLabel: incoming.sources[0]?.fileName ?? "Másik feldolgozás" },
      ];
      merged[mismatchedSourceIndex] = { ...current, conflicts, issues: unique([...current.issues, "conflict"]), reviewStatus: "needs-review" };
      merged.push({ ...incoming, conflicts: [...incoming.conflicts,
        { field: "invoiceNumber", keptValue: incoming.invoiceNumber, incomingValue: current.invoiceNumber, sourceLabel: current.sources[0]?.fileName ?? "Másik feldolgozás" },
      ], issues: unique([...incoming.issues, "conflict"]), reviewStatus: "needs-review" });
      continue;
    }

    const possibleMatches = merged
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => isPossibleDuplicate(row, incoming));
    let candidate = incoming;
    if (possibleMatches.length > 0) {
      candidate = { ...candidate, issues: unique([...candidate.issues, "possible-duplicate"] as InvoiceIssue[]) };
      for (const { row, index } of possibleMatches) {
        merged[index] = { ...row, issues: unique([...row.issues, "possible-duplicate"] as InvoiceIssue[]), reviewStatus: "needs-review" };
      }
    }

    merged.push(candidate);
  }

  return merged;
};

export const mergeInvoiceRows = (currentRows: InvoiceRowInput[], incomingRows: InvoiceRowInput[]) =>
  mergeImportedInvoices(currentRows, incomingRows);

export const markInvoiceFieldEdited = (invoice: InvoiceRowInput, field: InvoiceField) => ({
  ...invoice,
  manuallyEditedFields: unique([...invoice.manuallyEditedFields, field]),
  fieldOrigin: { ...invoice.fieldOrigin, [field]: "manual" as const },
  reviewStatus: "needs-review" as const,
});

const fieldsForTotal = (invoices: InvoiceRowInput[]) => invoices.filter((invoice) => isInvoiceCostEligible(invoice, invoices));

export const calculateReportSummary = (invoices: InvoiceRowInput[], loanMinor: number, additionalItems: AdditionalItemInput[] = []) => {
  const totaledInvoices = fieldsForTotal(invoices);
  let invoiceMinor = 0;
  let totalMinor = loanMinor;
  let totalOverflow = false;
  for (const invoice of totaledInvoices) {
    const amountMinor = invoice.amountMinor ?? 0;
    const nextInvoiceMinor = invoiceMinor + amountMinor;
    const nextTotalMinor = nextInvoiceMinor + loanMinor;
    if (!Number.isSafeInteger(nextInvoiceMinor) || !Number.isSafeInteger(nextTotalMinor)) {
      totalOverflow = true;
      continue;
    }
    invoiceMinor = nextInvoiceMinor;
    totalMinor = nextTotalMinor;
  }

  const isEligibleAdditionalItem = (item: AdditionalItemInput) => {
    const name = item.name.trim();
    return name.length > 0
      && name.length <= 120
      && Number.isSafeInteger(item.amountMinor)
      && item.amountMinor !== null
      && item.amountMinor >= 0
      && item.amountMinor <= 9_000_000_000_000;
  };
  const eligibleAdditionalItems = additionalItems.filter(isEligibleAdditionalItem);
  let additionalMinor = 0;
  let additionalCount = 0;
  for (const item of eligibleAdditionalItems) {
    const nextAdditionalMinor = additionalMinor + (item.amountMinor ?? 0);
    const nextTotalMinor = totalMinor + (item.amountMinor ?? 0);
    if (!Number.isSafeInteger(nextAdditionalMinor) || !Number.isSafeInteger(nextTotalMinor)) {
      totalOverflow = true;
      continue;
    }
    additionalMinor = nextAdditionalMinor;
    totalMinor = nextTotalMinor;
    additionalCount += 1;
  }
  const incompleteCount = invoices.filter((invoice) =>
    invoice.issues.length > 0 || invoice.amountMinor === null || invoice.currency !== "HUF" || invoice.documentType === null || !invoice.issuedAt
    || (invoice.amountMinor < 0 && invoice.documentType === "invoice") || invoice.reviewStatus !== "reviewed").length + Number(totalOverflow);
  const additionalIncompleteCount = additionalItems.length - eligibleAdditionalItems.length;
  const hasBlankInvoice = invoices.some((invoice) =>
    !invoice.providerName.trim() || invoice.amountMinor === null || invoice.currency !== "HUF");
  const isComplete = invoices.length > 0 && incompleteCount === 0 && additionalItems.length === 0 && !hasBlankInvoice;

  return {
    invoiceMinor,
    additionalMinor,
    additionalCount,
    additionalIncompleteCount,
    loanMinor,
    totalMinor,
    knownHalfShares: splitMinorAmount(totalMinor),
    incompleteCount,
    invoiceCount: invoices.length,
    totalOverflow,
    isComplete,
    totalLabel: isComplete ? "Havi összesen" : "Ismert tételek összege",
    formattedInvoiceTotal: `${formatMinorAsHuf(invoiceMinor)} Ft`,
    formattedTotal: `${formatMinorAsHuf(totalMinor)} Ft`,
  };
};

export const summarizeInvoices = calculateReportSummary;
