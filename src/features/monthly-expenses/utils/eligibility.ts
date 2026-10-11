import type { InvoiceRowInput } from "../types";

const canonicalProviderName = (providerName: string) => {
  const value = providerName.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("hu-HU").replace(/[^a-z]/gu, "");
  if (/^mvm(?:$|next|zrt|energiakereskedelmi)/u.test(value)) return "mvm";
  if (/^alfoldviz(?:$|zrt|kft|korlatolt)/u.test(value)) return "alfoldviz";
  if (/^mohu(?:$|mol|zrt|kft)/u.test(value)) return "mohu";
  return value;
};

const invoiceIdentity = (invoice: InvoiceRowInput, number: string) =>
  `${canonicalProviderName(invoice.providerName)}|${invoice.category}|${number.trim().toLocaleLowerCase("hu-HU")}`;

const hasUnresolvedCorrection = (invoice: InvoiceRowInput, invoices: InvoiceRowInput[]) => {
  if (!invoice.invoiceNumber) return false;
  return invoices.some((row) => {
    if (row.documentType === "invoice") return false;
    const reference = row.relatedInvoiceNumber ?? row.invoiceNumber;
    return Boolean(reference) && invoiceIdentity(row, reference as string) === invoiceIdentity(invoice, invoice.invoiceNumber as string);
  });
};

export const isInvoiceCostEligible = (invoice: InvoiceRowInput, invoices: InvoiceRowInput[]) => {
  if (invoice.currency !== "HUF" || invoice.amountMinor === null || invoice.amountMinor < 0 || invoice.documentType !== "invoice") return false;
  if (invoice.issues.some((issue) => ["conflict", "foreign-currency", "possible-duplicate", "correction-unresolved"].includes(issue))) return false;
  if (invoice.issues.includes("source-unverified") && invoice.fieldOrigin.amountMinor !== "manual") return false;
  return !hasUnresolvedCorrection(invoice, invoices);
};

export const isUtilityConsumptionEligible = (invoice: InvoiceRowInput, invoices: InvoiceRowInput[]) => {
  if (invoice.documentType !== "invoice") return false;
  if (invoice.issues.some((issue) => ["conflict", "possible-duplicate", "correction-unresolved"].includes(issue))) return false;
  if (hasUnresolvedCorrection(invoice, invoices)) return false;
  const quantityManuallySourced = invoice.fieldOrigin.consumptionQuantity === "manual"
    || invoice.manuallyEditedFields.includes("consumptionQuantity");
  if (invoice.issues.includes("source-unverified") && !quantityManuallySourced) return false;
  return true;
};
