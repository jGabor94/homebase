import "server-only";
import { randomUUID } from "node:crypto";
import { GMAIL_CATEGORIES, INVOICE_FIELDS, MAX_PDF_PAGES } from "../config";
import type { AiInvoiceList, InvoiceImportResult, InvoiceIssue, InvoiceRowInput, InvoiceSource } from "../types";
import { mergeImportedInvoices } from "../utils";
import { parseHungarianInvoiceDate } from "../utils/dates";
import { parseHungarianAmountToMinor } from "../utils/money";
import { validateAiEvidence } from "../utils/source-evidence";
import { readStackedIssuer, readStackedPaymentFields, readStackedIssueDate } from "../utils/invoice-layout";
import type { ParsedPdfDocument, PdfPageText } from "./pdf";
import { getSafeInvoiceErrorMessage } from "./errors";
import { extractInvoicesWithAi } from "./ai";

type Evidence = NonNullable<InvoiceRowInput["fieldEvidence"]["providerName"]>;
type SourceWithoutPageInfo<T> = T extends InvoiceSource ? Omit<T, "invoiceIndex" | "pages"> : never;
type BaseInvoiceSource = SourceWithoutPageInfo<InvoiceSource>;

interface InvoiceDraft {
  providerName: string | null;
  category: InvoiceRowInput["category"] | null;
  invoiceNumber: string | null;
  amountMinor: number | null;
  currency: string | null;
  dueDate: string | null;
  billingPeriod: string;
  issuedAt: string | null;
  documentType: InvoiceRowInput["documentType"];
  relatedInvoiceNumber: string | null;
  fieldEvidence: InvoiceRowInput["fieldEvidence"];
  fieldOrigin: InvoiceRowInput["fieldOrigin"];
  issues: InvoiceIssue[];
  pageNumbers: number[];
  reportMonth: string;
  source: BaseInvoiceSource;
}

export type PdfInvoiceSourceContext =
  | { kind: "upload"; documentId: string; fileName: string; reportMonth: string }
  | {
    kind: "gmail";
    messageId: string;
    fileName: string;
    attachmentId?: string;
    linkIndex?: number;
    reportMonth: string;
    sentAt: string;
    receivedAt: string | null;
  };

const normalizeWords = (value: string) => value.normalize("NFKC").toLocaleLowerCase("hu-HU");
const unique = <T,>(values: T[]) => [...new Set(values)];

const labelMatch = (text: string, labels: string[]) => {
  for (const label of labels) {
    const expression = new RegExp(`^[\\t ]*(${label})[\\t ]*(?:[:#]|[–—-])?[\\t ]*([^\\r\\n]+)[\\t ]*$`, "imu");
    const match = expression.exec(text);
    if (match?.[2]?.trim() && !/^[:#–—-]+$/u.test(match[2].trim())) {
      return { value: match[2].trim(), quote: match[0].trim(), index: match.index + match[0].indexOf(match[1]) };
    }
  }
  return null;
};

const findInvoiceNumberLines = (text: string) => {
  const expression = /^[\t ]*(?:Számlaszám|Számla\s+(?:sorszáma|száma|azonosítója))[\t ]*(?:[:#]|[–—-])?[\t ]*([^\r\n]+)[\t ]*$/gimu;
  return [...text.matchAll(expression)].flatMap((match) => match[1]?.trim() && !/^[:#–—-]+$/u.test(match[1].trim())
    ? [{ value: match[1].trim(), index: match.index ?? 0, quote: match[0].trim() }]
    : []);
};

const getPageAtOffset = (pages: PdfPageText[], offset: number) => {
  let pageStart = 0;
  for (const page of pages) {
    const pageEnd = pageStart + page.text.length;
    if (offset <= pageEnd) return page.page;
    pageStart = pageEnd + 1;
  }
  return pages.at(-1)?.page ?? 1;
};

const getSegmentPageNumbers = (pages: PdfPageText[], start: number, end: number) => {
  const result: number[] = [];
  let pageStart = 0;
  for (const page of pages) {
    const pageEnd = pageStart + page.text.length;
    if (pageEnd >= start && pageStart <= end) result.push(page.page);
    pageStart = pageEnd + 1;
  }
  return result.length ? result : [pages[0]?.page ?? 1];
};

const makeEvidence = (pages: PdfPageText[], absoluteOffset: number, quote: string): Evidence => ({
  page: getPageAtOffset(pages, absoluteOffset),
  quote: quote.slice(0, 500),
});

const detectProvider = (text: string) => {
  const stackedIssuer = readStackedIssuer(text);
  if (stackedIssuer) {
    const name = normalizeWords(stackedIssuer.value);
    return { providerName: name.includes("mvm") ? "MVM" : name.includes("mohu") ? "MOHU" : "ALFÖLDVÍZ",
      quote: stackedIssuer.quote, index: stackedIssuer.index, confirmed: true };
  }
  const expression = /\b(ALFÖLDVÍZ|ALFOLDVIZ|MVM(?:\s+Next)?|MOHU(?:\s+MOL)?)\b/giu;
  const matches = [...text.matchAll(expression)];
  const candidates = matches.map((match) => {
    const index = match.index ?? 0;
    const lineStart = text.lastIndexOf("\n", index) + 1;
    const prefix = text.slice(lineStart, index);
    const normalized = normalizeWords(match[0]).replace(/\s+/gu, " ");
    const providerName = normalized.includes("mvm") ? "MVM" : normalized.includes("mohu") ? "MOHU" : "ALFÖLDVÍZ";
    const confirmed = /(?:szolgáltató|kibocsátó|eladó|issuer)(?:\s+neve)?\s*[:#–—-]?\s*$/iu.test(prefix);
    return { providerName, quote: text.slice(lineStart, text.indexOf("\n", index) < 0 ? text.length : text.indexOf("\n", index)).trim(), index: lineStart, confirmed };
  });
  return candidates.find(({ confirmed }) => confirmed) ?? candidates[0] ?? null;
};

const detectCategory = (text: string, providerName: string | null) => {
  const tests: Array<{ category: InvoiceRowInput["category"]; expression: RegExp }> = [
    { category: "gas", expression: /\b(?:földgáz|foldgaz|gázszolgáltatás|gazszolgaltatas|gázdíj|gazdij)\b/iu },
    { category: "electricity", expression: /\b(?:villamos energia|villamosenergia|villany|áramdíj|aramdij)\b/iu },
    { category: "water", expression: /\b(?:ivóvíz|ivoviz|vízdíj|vizdij|vízellátás|vizellatas)\b/iu },
    { category: "waste", expression: /\b(?:hulladék|hulladek|szemétszállítás|szemetszallitas)\b/iu },
  ];
  const matches = tests.flatMap(({ category, expression }) => {
    const match = expression.exec(text);
    return match ? [{ category, quote: match[0], index: match.index }] : [];
  });
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (providerName === "MVM" && !["gas", "electricity"].includes(match.category)) return null;
  if (providerName === "ALFÖLDVÍZ" && match.category !== "water") return null;
  if (providerName === "MOHU" && match.category !== "waste") return null;
  return match;
};

const detectCurrency = (quote: string) => {
  const match = quote.match(/(?:\b(Ft\.?|forint(?:ok|ot)?)(?=\s|$|[,.;)])|\b(HUF|EUR|USD|GBP|CHF|CZK|PLN|RON|SEK|NOK|DKK|HRK|UAH|JPY|CAD|AUD|BGN|RSD|BAM)\b)/iu);
  if (!match) return null;
  const value = match[1] ?? match[2];
  return /^(?:Ft\.?|HUF|forint(?:ok|ot)?)$/iu.test(value) ? "HUF" : value.toUpperCase();
};

const detectDocumentType = (text: string, invoiceNumberField: ReturnType<typeof labelMatch>) => {
  const normalized = normalizeWords(text);
  if (/sztornó|sztorno|storno|törlő számla|torlo szamla/iu.test(normalized)) return "cancellation" as const;
  if (/jóváíró számla|jovairo szamla|jóváírási számla|jovairasi szamla/iu.test(normalized)) return "credit" as const;
  if (/helyesbítő számla|helyesbito szamla|módosító számla|modosito szamla/iu.test(normalized)) return "correction" as const;
  return invoiceNumberField ? "invoice" as const : null;
};

const getInvoiceSegments = (pages: PdfPageText[]) => {
  const text = pages.map(({ text }) => text).join("\n");
  const numberLines = findInvoiceNumberLines(text);
  const distinctNumbers = unique(numberLines.map(({ value }) => value.trim().toLocaleLowerCase("hu-HU")));
  if (distinctNumbers.length < 2) return [{ text, start: 0, end: text.length }];

  const pageStarts: number[] = [];
  let cursor = 0;
  for (const page of pages) {
    pageStarts.push(cursor);
    cursor += page.text.length + 1;
  }
  const pageForOffset = (offset: number) => {
    let result = 0;
    pageStarts.forEach((pageStart, index) => { if (pageStart <= offset) result = index; });
    return result;
  };
  const invoicePages = unique(numberLines.map(({ index }) => pageForOffset(index))).sort((a, b) => a - b);
  // Two invoices on one page are ambiguous. Keep the full text together so the AI
  // can identify them without cutting issuer/category evidence away from a number.
  if (invoicePages.length < 2) return [{ text, start: 0, end: text.length }];
  const boundaries = [0, ...invoicePages.slice(1).map((pageIndex) => pageStarts[pageIndex])];
  return boundaries.map((start, index) => {
    const end = boundaries[index + 1] ?? text.length;
    return { text: text.slice(start, end), start, end };
  });
};

const fromDeterministicSegment = (
  document: ParsedPdfDocument,
  context: PdfInvoiceSourceContext,
  segment: { text: string; start: number; end: number },
  pageNumbers: number[],
): InvoiceDraft | null => {
  const provider = detectProvider(segment.text);
  // Service headings on the invoice cover take precedence over generic energy-mix notices on later pages.
  const coverPage = document.pages.find((page) => page.page === pageNumbers[0]);
  const category = detectCategory(coverPage?.text ?? segment.text, provider?.providerName ?? null)
    ?? detectCategory(segment.text, provider?.providerName ?? null);
  const invoiceNumber = labelMatch(segment.text, [
    "Számlaszám", "Számla\\s+sorszáma", "Számla\\s+száma", "Számla\\s+azonosítója",
  ]);
  const stackedPayment = readStackedPaymentFields(segment.text);
  const amountField = stackedPayment?.amount ?? labelMatch(segment.text, [
    "Fizetendő\\s+(?:bruttó\\s+)?összeg", "Összesen\\s+fizetendő", "Végösszeg",
  ]);
  const dueDate = stackedPayment?.dueDate ?? labelMatch(segment.text, ["Fizetési\\s+határidő", "Befizetési\\s+határidő"]);
  const period = labelMatch(segment.text, ["Számlázási\\s+időszak", "Elszámolási\\s+időszak", "Elszámolt\\s+időszak", "Fogyasztási\\s+időszak"]);
  const issuedAt = readStackedIssueDate(segment.text)
    ?? labelMatch(segment.text, ["Számla\\s+kelt(?:e|ének\\s+dátuma)", "Kiállítás\\s+dátuma"]);
  const relatedNumber = labelMatch(segment.text, ["Eredeti\\s+számlaszám", "Kapcsolódó\\s+számla(?:szám)?", "Hivatkozott\\s+számlaszám"]);
  const amountCurrency = amountField ? detectCurrency(amountField.value) : null;
  const amountMinor = amountField && amountCurrency
    ? parseHungarianAmountToMinor(amountField.value)
    : null;
  const dueDateIso = dueDate ? parseHungarianInvoiceDate(dueDate.value) : null;
  const issuedAtIso = issuedAt ? parseHungarianInvoiceDate(issuedAt.value) : null;
  const documentType = detectDocumentType(segment.text, invoiceNumber);

  if (!provider && !invoiceNumber && !amountMinor && !dueDateIso) return null;
  const absoluteIndex = (match: { index: number } | null) => match ? segment.start + match.index : segment.start;
  const source: BaseInvoiceSource = context.kind === "upload"
    ? { kind: "upload", documentId: context.documentId, fileName: context.fileName, documentHash: document.documentHash, reportMonth: context.reportMonth }
    : {
      kind: "gmail",
      messageId: context.messageId,
      fileName: context.fileName,
      ...(context.attachmentId ? { attachmentId: context.attachmentId } : { linkIndex: context.linkIndex }),
      reportMonth: context.reportMonth,
      sentAt: context.sentAt,
      receivedAt: context.receivedAt,
      documentHash: document.documentHash,
    };

  const fieldEvidence: InvoiceRowInput["fieldEvidence"] = {
    ...(provider ? { providerName: makeEvidence(document.pages, absoluteIndex(provider), provider.quote) } : {}),
    ...(category ? { category: makeEvidence(document.pages, absoluteIndex(category), category.quote) } : {}),
    ...(invoiceNumber ? { invoiceNumber: makeEvidence(document.pages, absoluteIndex(invoiceNumber), invoiceNumber.quote) } : {}),
    ...(amountField ? { amountMinor: makeEvidence(document.pages, absoluteIndex(amountField), amountField.quote) } : {}),
    ...(amountField && amountCurrency ? { currency: makeEvidence(document.pages, absoluteIndex(amountField), amountField.quote) } : {}),
    ...(dueDate ? { dueDate: makeEvidence(document.pages, absoluteIndex(dueDate), dueDate.quote) } : {}),
    ...(period ? { billingPeriod: makeEvidence(document.pages, absoluteIndex(period), period.quote) } : {}),
    ...(issuedAt ? { issuedAt: makeEvidence(document.pages, absoluteIndex(issuedAt), issuedAt.quote) } : {}),
  };
  const fieldOrigin = Object.fromEntries(INVOICE_FIELDS.map((field) => [field, "code"])) as InvoiceRowInput["fieldOrigin"];
  const issues: InvoiceIssue[] = [];
  if (!provider) issues.push("missing-provider");
  if (provider && !provider.confirmed) issues.push("source-unverified");
  if (!category) issues.push("missing-category");
  if (!invoiceNumber) issues.push("missing-invoice-number");
  if (amountMinor === null) issues.push("missing-amount");
  if (!amountCurrency) issues.push("missing-currency");
  if (amountCurrency && amountCurrency !== "HUF") issues.push("foreign-currency");
  if (!dueDateIso) issues.push("missing-due-date");
  if (!period) issues.push("missing-period");
  if (!issuedAtIso) issues.push("missing-issued-at");
  if (!documentType) issues.push("source-unverified");
  if (documentType && documentType !== "invoice") issues.push("correction-unresolved");
  if (documentType === "invoice" && amountMinor !== null && amountMinor < 0) issues.push("correction-unresolved");

  return {
    providerName: provider?.providerName ?? null,
    category: category?.category ?? null,
    invoiceNumber: invoiceNumber?.value.replace(/\s+/gu, " ") ?? null,
    amountMinor,
    currency: amountCurrency,
    dueDate: dueDateIso,
    billingPeriod: period?.value ?? "",
    issuedAt: issuedAtIso,
    documentType,
    relatedInvoiceNumber: relatedNumber?.value ?? null,
    fieldEvidence,
    fieldOrigin,
    issues,
    pageNumbers,
    reportMonth: context.reportMonth,
    source,
  };
};

const textMatchesCurrency = (quote: string) => detectCurrency(quote);

const aiDraftFromInvoice = (
  ai: AiInvoiceList["invoices"][number],
  unverifiedField: boolean,
  document: ParsedPdfDocument,
  context: PdfInvoiceSourceContext,
  invoiceIndex: number,
  allowUnverifiedSuggestions: boolean,
): InvoiceDraft => {
  const valueOf = <T extends string>(value: T | null, evidence: { page: number; quote: string } | null) =>
    value !== null && evidence && evidence.page <= document.totalPages
      ? value
      : null;
  const providerName = valueOf(ai.providerName.value, ai.providerName.evidence);
  const category = valueOf(ai.category.value, ai.category.evidence) as InvoiceRowInput["category"] | null;
  const invoiceNumber = valueOf(ai.invoiceNumber.value, ai.invoiceNumber.evidence);
  const amountText = valueOf(ai.amount.value, ai.amount.evidence);
  const amountMinor = amountText ? parseHungarianAmountToMinor(amountText) : null;
  const currency = valueOf(ai.currency.value, ai.currency.evidence)?.toUpperCase()
    ?? (ai.amount.evidence ? textMatchesCurrency(ai.amount.evidence.quote) : null);
  const dueDateRaw = valueOf(ai.dueDate.value, ai.dueDate.evidence);
  const dueDate = dueDateRaw ? parseHungarianInvoiceDate(dueDateRaw) : null;
  const period = valueOf(ai.billingPeriod.value, ai.billingPeriod.evidence);
  const issuedAtRaw = valueOf(ai.issuedAt.value, ai.issuedAt.evidence);
  const issuedAt = issuedAtRaw ? parseHungarianInvoiceDate(issuedAtRaw) : null;
  const documentType = valueOf(ai.documentType.value, ai.documentType.evidence) as InvoiceRowInput["documentType"];
  const relatedInvoiceNumber = valueOf(ai.relatedInvoiceNumber.value, ai.relatedInvoiceNumber.evidence);
  const validEvidence = (field: { evidence: { page: number; quote: string } | null }) => field.evidence && field.evidence.page <= document.totalPages
    ? { page: field.evidence.page, quote: field.evidence.quote }
    : undefined;
  const fieldEvidence: InvoiceRowInput["fieldEvidence"] = {
    ...(validEvidence(ai.providerName) ? { providerName: validEvidence(ai.providerName) } : {}),
    ...(validEvidence(ai.category) ? { category: validEvidence(ai.category) } : {}),
    ...(validEvidence(ai.invoiceNumber) ? { invoiceNumber: validEvidence(ai.invoiceNumber) } : {}),
    ...(validEvidence(ai.amount) ? { amountMinor: validEvidence(ai.amount) } : {}),
    ...(validEvidence(ai.currency) ? { currency: validEvidence(ai.currency) } : {}),
    ...(validEvidence(ai.dueDate) ? { dueDate: validEvidence(ai.dueDate) } : {}),
    ...(validEvidence(ai.billingPeriod) ? { billingPeriod: validEvidence(ai.billingPeriod) } : {}),
    ...(validEvidence(ai.issuedAt) ? { issuedAt: validEvidence(ai.issuedAt) } : {}),
  };
  const fieldOrigin = Object.fromEntries(INVOICE_FIELDS.map((field) => [field, "ai"])) as InvoiceRowInput["fieldOrigin"];
  const source: BaseInvoiceSource = context.kind === "upload"
    ? { kind: "upload", documentId: context.documentId, fileName: context.fileName, documentHash: document.documentHash, reportMonth: context.reportMonth }
    : {
      kind: "gmail", messageId: context.messageId, fileName: context.fileName,
      ...(context.attachmentId ? { attachmentId: context.attachmentId } : { linkIndex: context.linkIndex }),
      reportMonth: context.reportMonth, sentAt: context.sentAt, receivedAt: context.receivedAt,
      documentHash: document.documentHash,
    };
  const issues: InvoiceIssue[] = [];
  if (!providerName) issues.push("missing-provider");
  if (!category) issues.push("missing-category");
  if (!invoiceNumber) issues.push("missing-invoice-number");
  if (amountMinor === null) issues.push("missing-amount");
  if (!currency) issues.push("missing-currency");
  if (currency && currency !== "HUF") issues.push("foreign-currency");
  if (!dueDate) issues.push("missing-due-date");
  if (!period) issues.push("missing-period");
  if (!issuedAt) issues.push("missing-issued-at");
  if (!documentType || unverifiedField || allowUnverifiedSuggestions) issues.push("source-unverified");
  if (documentType && documentType !== "invoice") issues.push("correction-unresolved");
  if (documentType === "invoice" && amountMinor !== null && amountMinor < 0) issues.push("correction-unresolved");
  const pageNumbers = unique(Object.values(ai).flatMap((field) => {
    const evidence = (field as { evidence?: { page: number } | null }).evidence;
    return evidence && evidence.page <= MAX_PDF_PAGES ? [evidence.page] : [];
  }));

  return {
    providerName, category, invoiceNumber, amountMinor, currency, dueDate, billingPeriod: period ?? "", issuedAt,
    documentType, relatedInvoiceNumber, fieldEvidence, fieldOrigin, issues,
    pageNumbers: pageNumbers.length ? pageNumbers : [invoiceIndex], reportMonth: context.reportMonth, source,
  };
};

const draftToRow = (draft: InvoiceDraft, invoiceIndex: number): InvoiceRowInput => {
  const issues = unique([...draft.issues]);
  return {
    id: randomUUID(),
    providerName: draft.providerName ?? "",
    category: draft.category ?? "other",
    invoiceNumber: draft.invoiceNumber,
    amountMinor: draft.amountMinor,
    currency: draft.currency,
    dueDate: draft.dueDate,
    billingPeriod: draft.billingPeriod,
    issuedAt: draft.issuedAt,
    sentAt: draft.source.kind === "gmail" ? draft.source.sentAt : null,
    reportMonth: draft.reportMonth,
    documentType: draft.documentType,
    relatedInvoiceNumber: draft.relatedInvoiceNumber,
    sources: [{ ...draft.source, invoiceIndex, pages: draft.pageNumbers } as InvoiceSource],
    fieldEvidence: draft.fieldEvidence,
    fieldOrigin: draft.fieldOrigin,
    manuallyEditedFields: [],
    issues,
    conflicts: [],
    reviewStatus: "needs-review",
  };
};

const hasInvoiceEvidence = (draft: InvoiceDraft) => Boolean(draft.providerName && draft.category
  && (draft.invoiceNumber || (draft.amountMinor !== null && draft.dueDate)));

const isGmailService = (draft: InvoiceDraft) => {
  const provider = (draft.providerName ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleUpperCase("hu-HU").replace(/[^A-Z]/gu, "");
  if (!GMAIL_CATEGORIES.includes(draft.category as typeof GMAIL_CATEGORIES[number])) return false;
  if (/^MVM(?:$|NEXT|ZRT|ENERGIAKERESKEDELMI)/u.test(provider)) return draft.category === "gas" || draft.category === "electricity";
  if (/^ALFOLDVIZ(?:$|ZRT|KFT|REGIONALIS|VIZIK)/u.test(provider)) return draft.category === "water";
  if (/^MOHU(?:$|MOL|ZRT|KFT)/u.test(provider)) return draft.category === "waste";
  return false;
};

const mergeDeterministicAndAi = (deterministic: InvoiceRowInput[], aiRows: InvoiceRowInput[]) =>
  mergeImportedInvoices(deterministic, aiRows);

export const extractInvoiceRowsFromPdf = async (
  document: ParsedPdfDocument,
  bytes: Uint8Array,
  context: PdfInvoiceSourceContext,
): Promise<InvoiceImportResult> => {
  const warnings: string[] = [];
  const deterministicDrafts = document.readable
    ? getInvoiceSegments(document.pages).flatMap((segment) => {
      const numberCount = unique(findInvoiceNumberLines(segment.text).map(({ value }) => value.trim().toLocaleLowerCase("hu-HU"))).length;
      if (numberCount > 1) {
        warnings.push("Egy oldalon több számla szerepel; a szétválasztásukhoz AI-beolvasás szükséges.");
        return [];
      }
      const pageNumbers = getSegmentPageNumbers(document.pages, segment.start, segment.end);
      const draft = fromDeterministicSegment(document, context, segment, pageNumbers);
      return draft ? [draft] : [];
    }).filter(hasInvoiceEvidence)
    : [];
  const deterministicRows = deterministicDrafts.slice(0, 10).map((draft, index) => draftToRow(draft, index + 1));
  if (deterministicDrafts.length > 10) warnings.push("A PDF-ben több mint 10 számlajelölt volt; a továbbiak ellenőrzéshez nem kerültek be.");

  const needsAi = !document.readable || deterministicRows.length === 0 || deterministicRows.some((row) =>
    row.amountMinor === null || row.currency === null || row.dueDate === null || row.invoiceNumber === null
    || row.billingPeriod === "" || row.documentType === null || row.issuedAt === null);
  let invoiceRows = deterministicRows;

  if (needsAi) {
    try {
      const aiResult = await extractInvoicesWithAi(document, bytes);
      warnings.push(...aiResult.warnings);
      if (aiResult.scanned) warnings.push("A PDF legalább egy oldala szkennelt; az AI-javaslatok forrását külön ellenőrizd az előnézetben.");
      const canVerifyTextEvidence = document.readable && !aiResult.scanned;
      const evidenceChecked = canVerifyTextEvidence
        ? validateAiEvidence(aiResult.invoices, document.pages.map(({ text }) => text))
        : aiResult.invoices.map((invoice) => ({ invoice, unverifiedField: true }));
      const suggestions = evidenceChecked.flatMap(({ invoice, unverifiedField }, index) => {
        const draft = aiDraftFromInvoice(invoice, unverifiedField, document, context, index + 1, !canVerifyTextEvidence);
        return hasInvoiceEvidence(draft) ? [draftToRow(draft, index + 1)] : [];
      });
      if (evidenceChecked.some(({ unverifiedField }) => unverifiedField)) {
        warnings.push("AI-javaslatok forrásbizonyítéka hiányzik vagy nem egyezik az oldalszöveggel; ellenőrzést igényelnek.");
      }
      invoiceRows = mergeDeterministicAndAi(invoiceRows, suggestions);
    } catch (error) {
      warnings.push(getSafeInvoiceErrorMessage(error, "Az AI-beolvasás nem sikerült; a biztosan kiolvasott adatok megmaradtak."));
    }
  }

  if (context.kind === "gmail") {
    const supportedRows = invoiceRows.filter((row) => isGmailService({
      providerName: row.providerName,
      category: row.category,
    } as InvoiceDraft));
    if (supportedRows.length !== invoiceRows.length) warnings.push("A nem támogatott vagy nem azonosítható Gmail-számlák kimaradtak.");
    invoiceRows = supportedRows;
  }

  invoiceRows = invoiceRows.map((row) => ({
    ...row,
    issues: row.issuedAt !== null
      ? row.issues.filter((issue) => issue !== "missing-issued-at")
      : unique([...row.issues, "missing-issued-at" as const]),
  }));
  if (invoiceRows.some((row) => row.issuedAt === null)) {
    warnings.push("A számla kelte legalább egy tételnél hiányzik vagy nem igazolható; ellenőrizd a PDF-et.");
  }
  if (invoiceRows.length === 0 && warnings.length === 0) {
    warnings.push("Nem találtam egyértelműen azonosítható számlát. Vidd fel kézzel az adatokat.");
  }
  return { invoices: invoiceRows.slice(0, 10), warnings: unique(warnings) };
};
