import assert from "node:assert/strict";
import { test } from "node:test";
import { extractInvoiceRowsFromPdf } from "../lib/extract-invoice";
import { invoiceImportResultSchema } from "../zod/schema";
import { summarizeInvoices } from "../utils";

const makeDocument = (text: string) => ({
  documentHash: "a".repeat(64), totalPages: 1,
  pages: [{ page: 1, text }], text: `--- 1 ---\n${text}`, readable: true,
});

test("scanned Gmail invoices keep editable AI suggestions but exclude unverified amounts from totals", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.AI_GATEWAY_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.AI_GATEWAY_API_KEY = "test-key-never-sent";
  process.env.AI_GATEWAY_MODEL = "test/invoice-model";
  const field = (value: string | null, quote: string | null) => ({ value, evidence: quote ? { page: 1, quote } : null });
  const invoice = {
    providerName: field("MVM Next Energiakereskedelmi Zrt.", "MVM Next Energiakereskedelmi Zrt."),
    category: field("gas", "Földgáz"), invoiceNumber: field("SCAN-001", "Számlaszám: SCAN-001"),
    amount: field("12400", "Fizetendő bruttó összeg: 12 400 Ft"), currency: field("HUF", "12 400 Ft"),
    dueDate: field("2026-10-20", "Fizetési határidő: 2026. 10. 20."),
    billingPeriod: field("2026. szeptember", "Elszámolási időszak: 2026. szeptember"),
    issuedAt: field(null, null), documentType: field("invoice", "Számla"), relatedInvoiceNumber: field(null, null),
  };
  globalThis.fetch = async () => Response.json({
    content: [{ type: "text", text: JSON.stringify({ invoices: [invoice] }) }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } }, warnings: [],
  });
  try {
    const result = await extractInvoiceRowsFromPdf({ ...makeDocument(""), readable: false }, new Uint8Array(), {
      kind: "gmail", messageId: "synthetic", attachmentId: "attachment-synthetic", fileName: "scan.pdf", reportMonth: "2026-10",
      sentAt: "2026-10-01T12:00:00Z", receivedAt: null,
    });
    assert.equal(result.invoices.length, 1);
    assert.equal(result.invoices[0].amountMinor, 1240000);
    assert.equal(result.invoices[0].invoiceNumber, "SCAN-001");
    assert.ok(result.invoices[0].issues.includes("source-unverified"));
    assert.equal(summarizeInvoices(result.invoices, 8100000).invoiceMinor, 0);
    assert.equal(invoiceImportResultSchema.safeParse(result).success, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_GATEWAY_MODEL;
    else process.env.AI_GATEWAY_MODEL = previousModel;
  }
});
const context = { kind: "upload" as const, documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fileName: "synthetic.pdf", reportMonth: "2026-10" };

test("electricity cover pages are not misclassified by gas references in energy mix disclosures", async () => {
  const cover = "Szolgáltató neve: MVM Next\nVillamos energia\nSzámla\nSzámlaszám: TEST-POWER\nFizetendő összeg: 3 602 Ft\nFizetési határidő: 2026.10.14\nSzámla kelte: 2026.10.02\nElszámolási időszak: 2026.08.24-2026.09.24";
  const disclosure = "Az energia összetétele: földgáz, megújuló energia és villamos energia.";
  const result = await extractInvoiceRowsFromPdf({ ...makeDocument(cover), totalPages: 2,
    pages: [{ page: 1, text: cover }, { page: 2, text: disclosure }], text: `${cover}\n${disclosure}`,
  }, new Uint8Array(), context);
  assert.equal(result.invoices.length, 1);
  assert.equal(result.invoices[0].category, "electricity");
  assert.equal(result.invoices[0].amountMinor, 360200);
  assert.deepEqual(result.invoices[0].issues, []);
  assert.deepEqual(result.warnings, []);
});

test("water invoice column headers associate the payable amount and deadline with their following values", async () => {
  const text = "Számla\nIvóvíz\nElszámolt időszak: 2026.09.01-2026.09.30\nFizetendő összeg:\nFizetési határidő:\n5 056 Ft\n2026.10.22\nSzolgáltató neve:\nCíme:\nAdószáma:\nBankszámlaszáma:\nALFÖLDVÍZ Zrt.\nSzámla sorszáma: TEST-WATER";
  const dates = "Teljesítés időpontja:\nSzámla kelte:\nA szolgáltatás megnevezése:\n2026.10.22\n2026.10.02\nVíziközmű-szolgáltatás";
  const details = `Számla sorszáma:\nFizetési mód:\nTEST-WATER\nÁtutalás\n${dates}`;
  const result = await extractInvoiceRowsFromPdf({ ...makeDocument(text), totalPages: 2,
    pages: [{ page: 1, text }, { page: 2, text: details }], text: `${text}\n${details}`,
  }, new Uint8Array(), context);
  assert.equal(result.invoices.length, 1);
  const row = result.invoices[0];
  assert.equal(row.providerName, "ALFÖLDVÍZ");
  assert.equal(row.category, "water");
  assert.equal(row.amountMinor, 505600);
  assert.equal(row.dueDate, "2026-10-22");
  assert.equal(row.issuedAt, "2026-10-02");
  assert.equal(row.fieldEvidence.issuedAt?.page, 2);
  assert.deepEqual(row.sources[0].pages, [1, 2]);
  assert.equal(row.fieldEvidence.issuedAt?.quote, dates.split("\n").slice(0, 5).join("\n"));
  assert.equal(row.billingPeriod, "2026.09.01-2026.09.30");
  assert.deepEqual(row.issues, []);
  assert.deepEqual(result.warnings, []);
});

test("labelled synthetic invoices for all four utilities extract their actual required fields without AI", async () => {
  const fixtures = [
    ["MVM", "Földgáz", "gas"], ["MVM", "Villamos energia", "electricity"],
    ["ALFÖLDVÍZ", "Ivóvíz", "water"], ["MOHU", "Hulladék", "waste"],
  ];
  for (const [provider, service, category] of fixtures) {
    const text = `Szolgáltató: ${provider}\n${service}\nSzámlaszám: 0000123\nFizetendő bruttó összeg: 12 450,50 Ft\nFizetési határidő: 2026. 10. 20.\nSzámla kelte: 2026.10.02\nElszámolási időszak: 2026. szeptember`;
    const result = await extractInvoiceRowsFromPdf(makeDocument(text), new Uint8Array(), context);
    assert.equal(result.invoices.length, 1, provider);
    const invoice = result.invoices[0];
    assert.equal(invoice.providerName, provider);
    assert.equal(invoice.category, category);
    assert.equal(invoice.invoiceNumber, "0000123");
    assert.equal(invoice.amountMinor, 1245050);
    assert.equal(invoice.dueDate, "2026-10-20");
    assert.equal(invoice.billingPeriod, "2026. szeptember");
    assert.equal(invoice.reviewStatus, "needs-review");
    assert.equal(result.warnings.length, 0);
    assert.equal(invoiceImportResultSchema.safeParse(result).success, true);
  }
});

test("a missing period remains missing and an unavailable AI never erases proven extracted fields", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  try {
    const result = await extractInvoiceRowsFromPdf(makeDocument(
      "Szolgáltató: MVM\nFöldgáz\nSzámlaszám: 0000123\nFizetendő bruttó összeg: 0 Ft\nFizetési határidő: 2026. 10. 20.",
    ), new Uint8Array(), context);
    assert.equal(result.invoices.length, 1);
    assert.equal(result.invoices[0].amountMinor, 0);
    assert.equal(result.invoices[0].invoiceNumber, "0000123");
    assert.equal(result.invoices[0].billingPeriod, "");
    assert.ok(result.invoices[0].issues.includes("missing-period"));
    assert.ok(result.warnings.some((warning) => warning.includes("Gateway")));
  } finally {
    if (previousKey !== undefined) process.env.AI_GATEWAY_API_KEY = previousKey;
  }
});

test("a missing issue date alone invokes AI and is either proven or explicitly flagged", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.AI_GATEWAY_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.AI_GATEWAY_API_KEY = "test-key-never-sent";
  process.env.AI_GATEWAY_MODEL = "test/invoice-model";
  const text = "Szolgáltató: MVM\nFöldgáz\nSzámlaszám: DATE-001\nFizetendő összeg: 12 400 Ft\nFizetési határidő: 2026.10.20\nElszámolási időszak: 2026. szeptember\nSzámla dátuma: 2026.10.02";
  const field = (value: string | null, quote: string | null = null) => ({ value, evidence: quote ? { page: 1, quote } : null });
  const suggestion = {
    providerName: field("MVM", "Szolgáltató: MVM"), category: field("gas", "Földgáz"),
    invoiceNumber: field("DATE-001", "Számlaszám: DATE-001"), amount: field(null), currency: field(null),
    dueDate: field(null), billingPeriod: field(null), issuedAt: field("2026-10-02", "Számla dátuma: 2026.10.02"),
    documentType: field(null), relatedInvoiceNumber: field(null),
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ content: [{ type: "text", text: JSON.stringify({ invoices: [suggestion] }) }],
      finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } }, warnings: [] });
  };
  try {
    const recovered = await extractInvoiceRowsFromPdf(makeDocument(text), new Uint8Array(), context);
    assert.equal(calls, 1);
    assert.equal(recovered.invoices.length, 1);
    assert.equal(recovered.invoices[0].issuedAt, "2026-10-02");
    assert.equal(recovered.invoices[0].fieldOrigin.issuedAt, "ai");
    assert.ok(!recovered.invoices[0].issues.includes("missing-issued-at"));
    assert.equal(recovered.invoices[0].amountMinor, 1240000);
    suggestion.issuedAt = field(null);
    const missing = await extractInvoiceRowsFromPdf(makeDocument(text), new Uint8Array(), context);
    assert.equal(calls, 2);
    assert.equal(missing.invoices[0].issuedAt, null);
    assert.ok(missing.invoices[0].issues.includes("missing-issued-at"));
    assert.ok(missing.warnings.some((warning) => warning.includes("számla kelte")));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.AI_GATEWAY_MODEL;
    else process.env.AI_GATEWAY_MODEL = previousModel;
  }
});

test("two invoices on one page never silently collapse to the first complete labelled invoice", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  const text = (number: string) => `Szolgáltató: MVM\nFöldgáz\nSzámlaszám: ${number}\nFizetendő bruttó összeg: 12 400 Ft\nFizetési határidő: 2026. 10. 20.\nElszámolási időszak: 2026. szeptember`;
  try {
    const result = await extractInvoiceRowsFromPdf(makeDocument(`${text("INV-001")}\n${text("INV-002")}`), new Uint8Array(), context);
    assert.equal(result.invoices.length, 0);
    assert.ok(result.warnings.some((warning) => warning.includes("több számla")));
    assert.ok(result.warnings.some((warning) => warning.includes("Gateway")));
  } finally {
    if (previousKey !== undefined) process.env.AI_GATEWAY_API_KEY = previousKey;
  }
});
