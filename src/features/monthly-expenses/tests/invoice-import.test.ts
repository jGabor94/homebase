import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createEmptyInvoice, getInvoiceMergeKeys, markInvoiceFieldEdited, mergeImportedInvoices, summarizeInvoices } from "../utils";
import { getBudapestMonthWindow, parseHungarianInvoiceDate, parseValidMailDate } from "../utils/dates";
import { parseHungarianAmountToMinor } from "../utils/money";
import { validateAiEvidence } from "../utils/source-evidence";
import type { AiInvoiceList, InvoiceRowInput } from "../types";

const documentHash = "a".repeat(64);
const documentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const invoice = (overrides: Partial<InvoiceRowInput> = {}): InvoiceRowInput => ({
  ...createEmptyInvoice("2026-03"),
  providerName: "MVM",
  category: "gas",
  invoiceNumber: "INV-001",
  amountMinor: 1240000,
  currency: "HUF",
  dueDate: "2026-03-20",
  billingPeriod: "2026. március",
  documentType: "invoice",
  reviewStatus: "reviewed",
  sources: [{ kind: "upload", documentId, fileName: "szamla.pdf", documentHash, reportMonth: "2026-03", invoiceIndex: 1, pages: [1] }],
  ...overrides,
});

const evidenceField = <T extends string | null>(value: T, quote: string | null) => ({
  value,
  evidence: quote ? { page: 1, quote } : null,
});

const aiInvoice = (amount: string, amountQuote: string): AiInvoiceList["invoices"][number] => ({
  providerName: evidenceField("MVM Next Energiakereskedelmi Zrt.", "Szolgáltató: MVM Next Energiakereskedelmi Zrt."),
  category: { value: "gas", evidence: { page: 1, quote: "Földgáz szolgáltatás" } },
  invoiceNumber: evidenceField("INV-001", "Számlaszám: INV-001"),
  amount: evidenceField(amount, amountQuote),
  currency: evidenceField("HUF", amountQuote),
  dueDate: evidenceField("2026-03-20", "Fizetési határidő: 2026. 03. 20."),
  billingPeriod: evidenceField("2026. március", "Elszámolási időszak: 2026. március"),
  issuedAt: evidenceField(null, null),
  documentType: { value: "invoice", evidence: { page: 1, quote: "Számla" } },
  relatedInvoiceNumber: evidenceField(null, null),
});

test("month windows use Budapest local midnight across both DST transitions", () => {
  const march = getBudapestMonthWindow(2026, 3);
  assert.equal(new Date(march.startMs).toISOString(), "2026-02-28T23:00:00.000Z");
  assert.equal(new Date(march.endMs).toISOString(), "2026-03-31T22:00:00.000Z");
  const october = getBudapestMonthWindow(2026, 10);
  assert.equal(new Date(october.startMs).toISOString(), "2026-09-30T22:00:00.000Z");
  assert.equal(new Date(october.endMs).toISOString(), "2026-10-31T23:00:00.000Z");
});

test("date and amount parsing reject ambiguous or malformed inputs", () => {
  assert.equal(parseValidMailDate("2026-03-01"), null);
  assert.equal(parseValidMailDate("03/04/2026"), null);
  assert.equal(parseValidMailDate("Mon, 02 Mar 2026 12:30:00 +0100"), "2026-03-02T11:30:00.000Z");
  assert.equal(parseValidMailDate("Sat, 3 Oct 2026 21:56:10 +0200 (CET)"), "2026-10-03T19:56:10.000Z");
  assert.equal(parseValidMailDate("Sat, 3 Oct 2026 21:56:10 (CET)"), null);
  assert.equal(parseValidMailDate("Sat, 3 Oct 2026 21:56:10 +0200 (CET"), null);
  assert.equal(parseHungarianInvoiceDate("2026. 03. 20."), "2026-03-20");
  assert.equal(parseHungarianInvoiceDate("31. 02. 2026"), null);
  assert.equal(parseHungarianAmountToMinor("1.234,56 Ft"), 123456);
  assert.equal(parseHungarianAmountToMinor("1,23.45 Ft"), null);
});

test("AI evidence keeps only a payable gross amount that matches the quoted value and currency", () => {
  const goodQuote = "Fizetendő bruttó összeg: 12 400 Ft";
  const badQuote = "Fizetendő bruttó összeg: 12 400 Ft";
  const page = [
    "Szolgáltató: MVM Next Energiakereskedelmi Zrt.", "Földgáz szolgáltatás", "Számlaszám: INV-001",
    goodQuote, "Fizetési határidő: 2026. 03. 20.", "Elszámolási időszak: 2026. március", "Számla",
  ].join("\n");
  const correct = validateAiEvidence([aiInvoice("12 400", goodQuote)], [page])[0];
  assert.equal(correct.invoice.amount.value, "12 400");
  assert.equal(correct.unverifiedField, false);

  const incorrect = validateAiEvidence([aiInvoice("1 200", badQuote)], [page])[0];
  assert.equal(incorrect.invoice.amount.value, null);
  assert.equal(incorrect.invoice.currency.value, "HUF");
  assert.equal(incorrect.unverifiedField, true);

  const unrelatedNumberQuote = "Fizetendő bruttó összeg: 12 400 Ft · Számlaszám: 555";
  const unrelatedNumber = validateAiEvidence([aiInvoice("555", unrelatedNumberQuote)], [`${page}\n${unrelatedNumberQuote}`])[0];
  assert.equal(unrelatedNumber.invoice.amount.value, null);

  const datesQuote = "Fizetési határidő: 2026. 03. 20. · Számla kelte: 2026. 03. 01.";
  const wrongDateInvoice = aiInvoice("12 400", goodQuote);
  wrongDateInvoice.dueDate = evidenceField("2026-03-01", datesQuote);
  const wrongDate = validateAiEvidence([wrongDateInvoice], [`${page}\n${datesQuote}`])[0];
  assert.equal(wrongDate.invoice.dueDate.value, null);
});

test("stacked payment evidence must contain the actual contiguous labelled block and its matching values", () => {
  const block = "Fizetendő összeg:\nFizetési határidő:\n5 056 Ft\n2026.10.22";
  const suggestion = aiInvoice("5 056", block);
  suggestion.dueDate = evidenceField("2026-10-22", block);
  suggestion.billingPeriod = evidenceField("2026.09.01-2026.09.30", "Elszámolt időszak: 2026.09.01-2026.09.30");
  const page = `${block}\nElszámolt időszak: 2026.09.01-2026.09.30`;
  const good = validateAiEvidence([suggestion], [page])[0].invoice;
  assert.equal(good.amount.value, "5 056");
  assert.equal(good.currency.value, "HUF");
  assert.equal(good.dueDate.value, "2026-10-22");
  assert.equal(good.billingPeriod.value, "2026.09.01-2026.09.30");
  const wrongValues = { ...suggestion, amount: evidenceField("999", block), dueDate: evidenceField("2026-10-02", block) };
  const bad = validateAiEvidence([wrongValues], [page])[0].invoice;
  assert.equal(bad.amount.value, null);
  assert.equal(bad.dueDate.value, null);
  const inventedQuote = { ...suggestion, amount: evidenceField("5 056", "Fizetendő összeg: 5 056 Ft") };
  assert.equal(validateAiEvidence([inventedQuote], [page])[0].invoice.amount.value, null);
});

test("column issue dates never accept the performance date and filling them clears the missing-date issue", () => {
  const block = "Teljesítés időpontja:\nSzámla kelte:\nA szolgáltatás megnevezése:\n2026.10.22\n2026.10.02";
  const suggestion = aiInvoice("12 400", "Fizetendő összeg: 12 400 Ft");
  suggestion.issuedAt = evidenceField("2026-10-02", block);
  assert.equal(validateAiEvidence([suggestion], [block])[0].invoice.issuedAt.value, "2026-10-02");
  suggestion.issuedAt = evidenceField("2026-10-22", block);
  assert.equal(validateAiEvidence([suggestion], [block])[0].invoice.issuedAt.value, null);
  const current = invoice({ issuedAt: null, issues: ["missing-issued-at"] });
  const incoming = invoice({ issuedAt: "2026-10-02" });
  const [merged] = mergeImportedInvoices([current], [incoming]);
  assert.equal(merged.issuedAt, "2026-10-02");
  assert.ok(!merged.issues.includes("missing-issued-at"));
  assert.equal(summarizeInvoices([current], 8100000).isComplete, false);
});

test("same PDF invoices stay separate by ordinal and deleting one does not hide the other", () => {
  const first = invoice({ invoiceNumber: "INV-001", sources: [{ kind: "upload", documentId, fileName: "szamla.pdf", documentHash, reportMonth: "2026-03", invoiceIndex: 1, pages: [1] }] });
  const second = invoice({ id: randomUUID(), invoiceNumber: "INV-002", amountMinor: 80000,
    sources: [{ kind: "upload", documentId, fileName: "szamla.pdf", documentHash, reportMonth: "2026-03", invoiceIndex: 2, pages: [2] }] });
  const keys = new Set(getInvoiceMergeKeys(first));
  const remaining = mergeImportedInvoices([first, second], [first, second], keys);
  assert.deepEqual(remaining.map(({ invoiceNumber }) => invoiceNumber), ["INV-002"]);

  const gmailCopy = invoice({ id: randomUUID(), sources: [{ kind: "gmail", messageId: "message-1", fileName: "szamla.pdf", attachmentId: "opaque.id/long", reportMonth: "2026-03", invoiceIndex: 1, sentAt: "2026-03-02T10:00:00.000Z", receivedAt: null, documentHash, pages: [1] }] });
  const mergedCopies = mergeImportedInvoices([first], [gmailCopy]);
  assert.equal(mergedCopies.length, 1);
  assert.deepEqual(new Set(mergedCopies[0].sources.map(({ kind }) => kind)), new Set(["upload", "gmail"]));
});

test("merging a late import preserves edited values and flags the conflict", () => {
  const edited = markInvoiceFieldEdited(invoice({ amountMinor: 1_300_000 }), "amountMinor");
  const lateImport = invoice({ amountMinor: 1_240_000 });
  const [merged] = mergeImportedInvoices([edited], [lateImport]);
  assert.equal(merged.amountMinor, 1_300_000);
  assert.ok(merged.conflicts.some(({ field }) => field === "amountMinor"));
});

test("unknown currency, negative normal invoices, duplicates, corrections and overflow stay out of a complete total", () => {
  const unknownCurrency = invoice({ currency: null });
  const negative = invoice({ invoiceNumber: "INV-NEG", amountMinor: -10_000 });
  const original = invoice({ invoiceNumber: "INV-ORIGINAL", amountMinor: 99_000 });
  const correction = invoice({ id: randomUUID(), invoiceNumber: "INV-CORRECTION", documentType: "correction", relatedInvoiceNumber: "INV-ORIGINAL", issues: ["correction-unresolved"] });
  const summary = summarizeInvoices([unknownCurrency, negative, original, correction], 8_100_000);
  assert.equal(summary.invoiceMinor, 0);
  assert.equal(summary.totalMinor, 8_100_000);
  assert.equal(summary.isComplete, false);

  const hugeA = invoice({ invoiceNumber: "HUGE-A", amountMinor: Number.MAX_SAFE_INTEGER });
  const hugeB = invoice({ id: randomUUID(), invoiceNumber: "HUGE-B", amountMinor: Number.MAX_SAFE_INTEGER });
  const overflow = summarizeInvoices([hugeA, hugeB], 8_100_000);
  assert.equal(overflow.totalOverflow, true);
  assert.equal(overflow.isComplete, false);
  assert.ok(Number.isSafeInteger(overflow.totalMinor));
});
