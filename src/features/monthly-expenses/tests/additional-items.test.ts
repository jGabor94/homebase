import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createEmptyInvoice, mergeImportedInvoices, summarizeInvoices } from "../utils";
import type { AdditionalItemInput, InvoiceRowInput } from "../types";
import { additionalItemSchema } from "../zod/schema";

const additionalItem = (overrides: Partial<AdditionalItemInput> = {}): AdditionalItemInput => ({
  id: randomUUID(),
  name: "Gáz átalány",
  amountMinor: 1_400_000,
  isDefault: false,
  ...overrides,
});

const invoice = (amountMinor: number): InvoiceRowInput => ({
  ...createEmptyInvoice("2026-03"),
  providerName: "MVM",
  category: "gas",
  invoiceNumber: randomUUID(),
  amountMinor,
  currency: "HUF",
  dueDate: "2026-03-20",
  issuedAt: "2026-03-01",
  billingPeriod: "2026. március",
  documentType: "invoice",
  reviewStatus: "reviewed",
});

test("manual item adds to invoices and the 81,000 Ft loan before an exact half split", () => {
  const summary = summarizeInvoices([
    invoice(1_000_000),
    invoice(300_000),
    invoice(121_300),
  ], 8_100_000, [additionalItem()]);

  assert.equal(summary.invoiceMinor, 1_421_300);
  assert.equal(summary.additionalMinor, 1_400_000);
  assert.equal(summary.additionalCount, 1);
  assert.equal(summary.totalMinor, 10_921_300);
  assert.equal(summary.knownHalfShares.firstMinor, 5_460_650);
  assert.equal(summary.isComplete, false);
});

test("blank, invalid, negative, oversize and overlong manual items are excluded", () => {
  const invalidItems = [
    additionalItem({ name: "" }),
    additionalItem({ name: "   " }),
    additionalItem({ amountMinor: null }),
    additionalItem({ amountMinor: Number.NaN }),
    additionalItem({ amountMinor: 100.5 }),
    additionalItem({ amountMinor: -1 }),
    additionalItem({ amountMinor: 9_000_000_000_001 }),
    additionalItem({ name: "x".repeat(121) }),
  ];
  const summary = summarizeInvoices([], 8_100_000, invalidItems);

  assert.equal(summary.additionalMinor, 0);
  assert.equal(summary.additionalCount, 0);
  assert.equal(summary.additionalIncompleteCount, invalidItems.length);
  assert.equal(summary.totalMinor, 8_100_000);
  assert.equal(summary.isComplete, false);
});

test("the form schema reports incomplete values while zero remains a valid amount", () => {
  assert.equal(additionalItemSchema.safeParse(additionalItem({ name: "", amountMinor: null })).success, false);
  assert.equal(additionalItemSchema.safeParse(additionalItem({ name: "Gáz", amountMinor: 0 })).success, true);
});

test("odd fillér totals split exactly and item edits or deletion immediately change the summary", () => {
  const odd = summarizeInvoices([], 0, [additionalItem({ amountMinor: 14_001 })]);
  assert.equal(odd.knownHalfShares.firstMinor, 7_000);
  assert.equal(odd.knownHalfShares.secondMinor, 7_001);

  const edited = summarizeInvoices([], 8_100_000, [additionalItem({ amountMinor: 1_500_000 })]);
  const deleted = summarizeInvoices([], 8_100_000, []);
  assert.equal(edited.totalMinor, 9_600_000);
  assert.equal(deleted.totalMinor, 8_100_000);
  assert.equal(deleted.additionalCount, 0);
});

test("invoice import merge operates only on invoice rows and leaves manual items independent", () => {
  const items = [additionalItem()];
  const importedRows = [invoice(1_234_000)];
  const mergedInvoices = mergeImportedInvoices([], importedRows);
  assert.equal(mergedInvoices.length, 1);
  assert.equal(items[0].name, "Gáz átalány");
  assert.equal(summarizeInvoices(mergedInvoices, 8_100_000, items).additionalCount, 1);
});

test("invoice overflow preserves the safe loan and additional amount", () => {
  const largeInvoice = invoice(Number.MAX_SAFE_INTEGER);
  const overflowingInvoices = invoice(Number.MAX_SAFE_INTEGER);
  const summary = summarizeInvoices([largeInvoice, overflowingInvoices], 8_100_000, [additionalItem()]);

  assert.equal(summary.totalOverflow, true);
  assert.equal(summary.isComplete, false);
  assert.equal(summary.invoiceMinor, 0);
  assert.ok(Number.isSafeInteger(summary.additionalMinor));
  assert.equal(summary.additionalMinor, 1_400_000);
  assert.ok(Number.isSafeInteger(summary.totalMinor));
  assert.equal(summary.totalMinor, 9_500_000);
});
