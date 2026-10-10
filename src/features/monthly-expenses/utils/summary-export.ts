import { INVOICE_CATEGORY_LABELS } from "../config";
import { renderSummaryLayoutPdf, renderSummaryLayoutPng } from "../lib/summary-export-layout";
import type { AdditionalItemInput, InvoiceRowInput, SummaryExportFormat, SummaryExportSnapshot } from "../types";
import { formatMinorAsHuf } from "./money";

export const createSummaryExportSnapshot = (
  reportMonth: string,
  invoices: InvoiceRowInput[],
  additionalItems: AdditionalItemInput[],
  total: string,
  half: string,
  totalOverflow = false,
): SummaryExportSnapshot => {
  const invoiceRows = invoices.map((invoice) => ({
    category: invoice.category ? INVOICE_CATEGORY_LABELS[invoice.category] : "Hiányzó számlatípus",
    provider: invoice.providerName.trim() || "Ismeretlen szolgáltató",
    amount: invoice.amountMinor !== null && invoice.currency === "HUF"
      ? `${formatMinorAsHuf(invoice.amountMinor)} Ft`
      : "Összeg hiányos",
    details: [
      `Számlaszám: ${invoice.invoiceNumber?.trim() || "Nincs megadva"}`,
      `Fizetési határidő: ${invoice.dueDate ? `${invoice.dueDate.replaceAll("-", ".")}.` : "Nincs megadva"}`,
      `Fogyasztási időszak: ${invoice.billingPeriod.trim() || "Nincs megadva"}`,
    ],
  }));
  const additionalRows = additionalItems.map((item) => ({
    name: item.name.trim() || "Hiányzó tételnév",
    amount: item.amountMinor !== null ? `${formatMinorAsHuf(item.amountMinor)} Ft` : "Összeg hiányos",
  }));

  return {
    reportMonth,
    monthLabel: new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", timeZone: "UTC" })
      .format(new Date(`${reportMonth}-01T12:00:00Z`)),
    invoiceRows,
    additionalRows,
    invoiceLines: invoiceRows.map(({ category, provider, amount, details }) => [
      `${category} · ${provider} — ${amount}`,
      ...details.map((detail) => `  ${detail}`),
    ].join("\r\n")),
    additionalLines: additionalRows.map(({ name, amount }) => `${name} — ${amount}`),
    warnings: totalOverflow
      ? ["Az összegek meghaladják a biztonságos számolási korlátot. Az összesítésből kimaradtak tételek; ellenőrizd a megadott összegeket."]
      : [],
    total,
    half,
  };
};

export const createSummaryText = (snapshot: SummaryExportSnapshot) => [
  `Havi közös költségkimutatás — ${snapshot.monthLabel}`,
  "",
  "Számlák",
  ...(snapshot.invoiceLines.length ? snapshot.invoiceLines : ["Nincs számlasor."]),
  "",
  "Számla nélküli tételek",
  ...(snapshot.additionalLines.length ? snapshot.additionalLines : ["Nincs számla nélküli tétel."]),
  "",
  ...snapshot.warnings,
  ...(snapshot.warnings.length ? [""] : []),
  `Összesen: ${snapshot.total}`,
  `Fele: ${snapshot.half}`,
].join("\r\n");

export const SUMMARY_EMAIL_RECIPIENT = "sz.marcsi85@gmail.com";

export const createSummaryEmailContent = (monthLabel: string, total: string, half: string) => ({
  subject: `Havi közös költségkimutatás — ${monthLabel}`,
  body: `Szia!\r\n\r\nCsatoltam a ${monthLabel} havi közös költségkimutatást.\r\n\r\nÖsszesen: ${total}\r\nFele: ${half}\r\n`,
});

export const createSummaryExportFile = async (snapshot: SummaryExportSnapshot, format: SummaryExportFormat) => {
  const filename = `havi-kimutatas-${snapshot.reportMonth}.${format}`;
  if (format === "txt") {
    return new File([new TextEncoder().encode(createSummaryText(snapshot))], filename, { type: "text/plain;charset=utf-8" });
  }
  const blob = format === "png"
    ? await renderSummaryLayoutPng(snapshot)
    : await renderSummaryLayoutPdf(snapshot);
  return new File([blob], filename, { type: format === "png" ? "image/png" : "application/pdf" });
};
