import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createEmptyInvoice } from "../utils";
import { fromStoredInvoice, toStoredInvoice } from "../utils/invoice-storage";
import { invoiceReportFormSchema } from "../zod/schema";

const validSnapshot = () => ({
  reportMonth: "2026-10",
  invoices: [{
    ...createEmptyInvoice("2026-10"),
    providerName: "MVM",
    amountMinor: 125_000,
    currency: "HUF" as const,
    sources: [{ kind: "upload", documentId: randomUUID(), fileName: "invoice.pdf", documentHash: "a".repeat(64), reportMonth: "2026-10", invoiceIndex: 1, pages: [1] }],
  }],
  additionalItems: [
    { id: randomUUID(), presetId: randomUUID(), name: "Hitel", amountMinor: 8_100_000, isDefault: true },
    { id: randomUUID(), name: "Kézi tétel", amountMinor: 47_000, isDefault: false },
  ],
});

test("monthly report snapshot retains invoice data and copied preset items after JSON round trip", () => {
  const snapshot = validSnapshot();
  const restored = invoiceReportFormSchema.parse(JSON.parse(JSON.stringify(snapshot)));

  assert.deepEqual(restored, snapshot);
});

test("monthly report snapshot rejects repeated IDs across invoice and additional rows", () => {
  const snapshot = validSnapshot();
  const duplicate = {
    ...snapshot,
    additionalItems: [{ ...snapshot.additionalItems[0], id: snapshot.invoices[0].id }],
  };

  assert.equal(invoiceReportFormSchema.safeParse(duplicate).success, false);
});

test("monthly report snapshot rejects invoice or source months that differ from the report month", () => {
  const snapshot = validSnapshot();
  const invoice = { ...snapshot.invoices[0], reportMonth: "2026-09" };
  const source = { ...snapshot.invoices[0], sources: [{ ...snapshot.invoices[0].sources[0], reportMonth: "2026-09" }] };

  assert.equal(invoiceReportFormSchema.safeParse({ ...snapshot, invoices: [invoice] }).success, false);
  assert.equal(invoiceReportFormSchema.safeParse({ ...snapshot, invoices: [source] }).success, false);
  assert.equal(invoiceReportFormSchema.safeParse({ ...snapshot, reportMonth: "2026-09" }).success, false);
});

test("invoice storage mapping preserves nullable dates, exact sending timestamp and extraction metadata", () => {
  const invoice = {
    ...createEmptyInvoice("2026-10"),
    providerName: "MVM",
    invoiceNumber: "INV-42",
    amountMinor: -123_450,
    currency: "HUF",
    dueDate: "2026-11-02",
    issuedAt: null,
    sentAt: "2026-10-31T23:15:00.000-02:00",
    billingPeriod: "2026. október",
    sources: [{ kind: "upload" as const, documentId: randomUUID(), fileName: "bill.pdf", documentHash: "b".repeat(64), reportMonth: "2026-10", invoiceIndex: 1, pages: [1, 2] }],
    fieldEvidence: { amountMinor: { page: 2, quote: "Fizetendő: 1 234,50 Ft" } },
    manuallyEditedFields: ["amountMinor" as const],
    issues: ["source-unverified" as const],
    conflicts: [{ field: "amountMinor" as const, keptValue: "1234,50", incomingValue: "1234,00", sourceLabel: "Új import" }],
  };
  const stored = {
    ...toStoredInvoice(invoice, randomUUID(), 4),
    createdAt: new Date("2026-10-31T22:00:00.000Z"),
    updatedAt: new Date("2026-10-31T22:30:00.000Z"),
  };

  assert.deepEqual(fromStoredInvoice(stored), invoice);
  assert.equal(stored.position, 4);
  assert.equal(stored.reportMonth, "2026-10");
});
