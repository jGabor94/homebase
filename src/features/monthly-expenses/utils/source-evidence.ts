import type { AiInvoiceList } from "../types";
import { parseHungarianInvoiceDate } from "./dates";
import { parseHungarianAmountToMinor } from "./money";
import { readStackedPaymentFields, readStackedIssueDate } from "./invoice-layout";
import { parseExplicitConsumption } from "./consumption";

export const normalizeEvidenceText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("hu-HU").replace(/\s+/gu, " ").trim();

export const evidenceAppearsInDocument = (documentText: string, quote: string) => {
  if (!quote.trim() || quote.length > 500) return false;
  const normalizedDocument = normalizeEvidenceText(documentText);
  const normalizedQuote = normalizeEvidenceText(quote);
  if (normalizedDocument.includes(normalizedQuote)) return true;

  return normalizedDocument.replace(/\s/gu, "").includes(normalizedQuote.replace(/\s/gu, ""));
};

const normalizeComparable = (value: string) => normalizeEvidenceText(value)
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/[^a-z0-9]+/gu, "");

const containsComparableValue = (value: string, quote: string) =>
  normalizeComparable(quote).includes(normalizeComparable(value));

const hasIssuerLabel = (quote: string) =>
  /(?:szolgaltato|kibocsato|szamlakibocsato|elado|issuer)/u.test(normalizeComparable(quote));

const quoteIsPayableGross = (quote: string, expectedMinor: number, expectedCurrency: string | null) => {
  const normalized = normalizeComparable(quote);
  if (/(netto|afa|adokulcs|egyenleg|tartozas|reszosszeg|kamat|elozoidoszak)/u.test(normalized)) return false;
  if (!/(?:fizetendo(?:brutto)?osszeg|bruttofizetendoosszeg|osszesenfizetendo|vegosszeg)/u.test(normalized)) return false;
  if (!expectedCurrency || !currencyIsProven(expectedCurrency, quote)) return false;
  const stacked = readStackedPaymentFields(quote);
  if (stacked && parseHungarianAmountToMinor(stacked.amount.value) === expectedMinor) return true;

  const labelText = normalizeEvidenceText(quote).normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const currencyPattern = expectedCurrency.toUpperCase() === "HUF" ? "(?:ft\\.?|huf|forint)" : expectedCurrency.toLowerCase();
  const payableAmount = new RegExp(`(?:fizetendo(?:\\s+brutto)?\\s+osszeg|brutto\\s+fizetendo\\s+osszeg|osszesen\\s+fizetendo|vegosszege?)\\s*[:#–—-]?\\s*([+−-]?\\s*\\d(?:[\\d\\s.,]*\\d)?)\\s*${currencyPattern}\\b`, "giu");
  return [...labelText.matchAll(payableAmount)].some((match) => parseHungarianAmountToMinor(match[1]) === expectedMinor);
};

const categoryIsProven = (category: string, quote: string) => {
  const normalized = normalizeComparable(quote);
  const words: Record<string, RegExp> = {
    gas: /gaz|foldgaz/u,
    electricity: /villany|aram|villamosenergia/u,
    water: /viz|ivoviz|vizdij/u,
    waste: /hulladek|szemetszallitas|mohu/u,
    other: /szamla|fizetendo/u,
  };
  return words[category]?.test(normalized) ?? false;
};

const dateIsProven = (value: string, quote: string, label: RegExp) => {
  const expectedDate = parseHungarianInvoiceDate(value);
  if (!expectedDate || !label.test(normalizeComparable(quote))) return false;
  const dateParts = [...quote.matchAll(/\b\d{4}[./-]\s*\d{1,2}[./-]\s*\d{1,2}\.?|\b\d{1,2}[./-]\s*\d{1,2}[./-]\s*\d{4}\.?/gu)];
  const immediateLabel = new RegExp(`(?:${label.source})$`, "u");
  return dateParts.some((match) => parseHungarianInvoiceDate(match[0]) === expectedDate
    && immediateLabel.test(normalizeComparable(quote.slice(0, match.index))));
};

const currencyIsProven = (value: string, quote: string) => {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return false;
  if (currency === "HUF") return /\bHUF(?=\s|$|[),.;])|\bFt\.?(?=\s|$|[),.;])|\bforint(?:ok|ot)?\b/iu.test(quote);
  return new RegExp(`\\b${currency}\\b`, "iu").test(quote);
};

const documentTypeIsProven = (value: string, quote: string) => {
  const normalized = normalizeComparable(quote);
  if (value === "invoice") return /szamla(?!.*(?:helyesbito|storno|sztorno|jovairo))/u.test(normalized);
  if (value === "credit") return /jovairo|kredit/u.test(normalized);
  if (value === "correction") return /helyesbito|modosito/u.test(normalized);
  return /storno|sztorno|torlo/u.test(normalized);
};

const fieldIsVerified = (field: keyof AiInvoiceList["invoices"][number], raw: unknown, quote: string) => {
  const value = (raw as { value: string | null }).value;
  if (value === null) return true;
  if (!value.trim()) return false;
  const normalizedQuote = normalizeComparable(quote);

  if (field === "providerName") return hasIssuerLabel(quote) && containsComparableValue(value, quote);
  if (field === "category") return categoryIsProven(value, quote);
  if (field === "amount") {
    const amountMinor = parseHungarianAmountToMinor(value);
    const currency = (raw as { currency?: { value: string | null } }).currency?.value?.toUpperCase() ?? null;
    return amountMinor !== null && quoteIsPayableGross(quote, amountMinor, currency);
  }
  if (field === "currency") return currencyIsProven(value, quote);
  if (field === "dueDate") {
    const stacked = readStackedPaymentFields(quote);
    return (stacked !== null && parseHungarianInvoiceDate(stacked.dueDate.value) === parseHungarianInvoiceDate(value))
      || dateIsProven(value, quote, /fizetesihatarido|befizetesihatarido/u);
  }
  if (field === "issuedAt") {
    const stacked = readStackedIssueDate(quote);
    const expectedDate = parseHungarianInvoiceDate(value);
    return (expectedDate !== null && stacked !== null && parseHungarianInvoiceDate(stacked.value) === expectedDate)
      || dateIsProven(value, quote, /szamlakelte|kiallit(?:as)?datuma|szamladatuma|kibocsatasdatuma/u);
  }
  if (field === "invoiceNumber") return /szamlaszam|szamlasorszam|szamlaazonosito/u.test(normalizedQuote)
    && containsComparableValue(value, quote);
  if (field === "billingPeriod") return /elszamolasiidoszak|elszamoltidoszak|szamlazasiidoszak|fogyasztasiidoszak/u.test(normalizedQuote)
    && containsComparableValue(value, quote);
  if (field === "relatedInvoiceNumber") return /eredetiszamla|kapcsolodoszamla|hivatkozottszamla/u.test(normalizedQuote)
    && containsComparableValue(value, quote);
  if (field === "consumption") {
    const extracted = parseExplicitConsumption(quote);
    const stated = parseExplicitConsumption(`Fogyasztás: ${value}`);
    return extracted !== null && stated !== null && extracted.quantity === stated.quantity && extracted.unit === stated.unit;
  }
  if (field === "documentType") return documentTypeIsProven(value, quote);
  return false;
};

export const validateAiEvidence = (aiInvoices: AiInvoiceList["invoices"], pageTexts: string[]) =>
  aiInvoices.map((invoice) => {
    let unverifiedField = false;
    const verified = Object.fromEntries(Object.entries(invoice).map(([field, raw]) => {
      const candidate = raw as { value: string | null; evidence: { page: number; quote: string } | null };
      if (candidate.value === null) return [field, candidate];
      const evidence = candidate.evidence;
      const quoteAppears = evidence !== null
        && evidence.page <= pageTexts.length
        && evidenceAppearsInDocument(pageTexts[evidence.page - 1], evidence.quote);
      const isVerified = quoteAppears
        && fieldIsVerified(field as keyof typeof invoice, { ...candidate, currency: invoice.currency }, evidence.quote);
      if (!isVerified) unverifiedField = true;
      // Keep a literal provider name from a matching quote as a review suggestion;
      // without an issuer label it cannot be treated as verified or counted.
      const keepProviderSuggestion = field === "providerName" && quoteAppears && containsComparableValue(candidate.value, evidence!.quote);
      return [field, isVerified || keepProviderSuggestion ? candidate : { value: null, evidence: null }];
    }));

    return { invoice: verified as AiInvoiceList["invoices"][number], unverifiedField };
  });
