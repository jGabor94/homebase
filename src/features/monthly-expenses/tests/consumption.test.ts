import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUtilityHistoryMonth, parseConsumptionQuantityInput, parseExplicitConsumption } from "../utils/consumption";
import { createEmptyInvoice } from "../utils";
import { aiInvoiceSchema, invoiceReportFormSchema } from "../zod/schema";
import { fromStoredInvoice, toStoredInvoice } from "../utils/invoice-storage";
import type { InvoiceRowInput } from "../types";
import { validateAiEvidence } from "../utils/source-evidence";
import { findExplicitConsumption } from "../utils/consumption";

const invoice = (overrides: Partial<InvoiceRowInput> = {}): InvoiceRowInput => ({
  ...createEmptyInvoice("2026-10", "gas"),
  providerName: "MVM",
  invoiceNumber: "INV-1",
  amountMinor: 12_000,
  currency: "HUF",
  ...overrides,
});

test("water summary selects drinking water once and preserves the stacked labels as evidence", () => {
  const stacked = "Elszámolt mennyiség:\nElszámolt mennyiség:\nSZÁMLARÉSZLETEZŐ\nIvóvíz 7,5 m3\nSzennyvíz 7,5 m3\nÁrszabás: Ivóvíz: Lakossági tarifa";
  const result = findExplicitConsumption(stacked);
  assert.equal(result?.quantity, 7.5);
  assert.equal(result?.unit, "m3");
  assert.equal(result?.quote, stacked.split("\n").slice(0, 4).join("\n"));
  assert.deepEqual(parseExplicitConsumption("Elszámolt mennyiség: Ivóvíz 7,5 m³\nElszámolt mennyiség: Szennyvíz 7,5 m³"), { quantity: 7.5, unit: "m3" });
  assert.equal(parseExplicitConsumption("Ivóvíz 7,5 m3\nSzennyvíz 7,5 m3"), null);
  assert.equal(parseExplicitConsumption("Elszámolt mennyiség: Szennyvíz 7,5 m3"), null);
  assert.equal(parseExplicitConsumption("Elszámolt mennyiség: Ivóvíz 7,5 m3\nElszámolt mennyiség: Ivóvíz 9 m3"), null);
});

test("explicit consumption parser accepts labelled quantities and rejects meter readings, prices, and ambiguity", () => {
  assert.deepEqual(parseExplicitConsumption("Elszámolt fogyasztás: 123,45 m³"), { quantity: 123.45, unit: "m3" });
  assert.deepEqual(parseExplicitConsumption("Felhasznált mennyiség: 500 kWh"), { quantity: 500, unit: "kWh" });
  assert.equal(parseExplicitConsumption("Mérőállás: 123 m³"), null);
  assert.equal(parseExplicitConsumption("Fogyasztási díj: 2 450 Ft / m³"), null);
  assert.equal(parseExplicitConsumption("Fogyasztás: 12 m³\nFogyasztás: 3 m³"), null);
  assert.equal(parseExplicitConsumption("Fogyasztás: 12 m³, 400 kWh"), null);
  assert.equal(parseExplicitConsumption("Fogyasztási időszak: 2026.09.01-2026.09.30, 12 m³"), null);
  assert.equal(parseExplicitConsumption("Fogyasztás: 12 ismeretlen"), null);
});

test("AI consumption is retained only when its explicit quote and stated value agree", () => {
  const empty = { value: null, evidence: null };
  const row = {
    providerName: empty, category: empty, invoiceNumber: empty, amount: empty, currency: empty,
    dueDate: empty, billingPeriod: empty, issuedAt: empty, documentType: empty, relatedInvoiceNumber: empty,
    consumption: { value: "123,4 m³", evidence: { page: 1, quote: "Elszámolt fogyasztás: 123,4 m³" } },
  };
  const [valid] = validateAiEvidence([row], ["Elszámolt fogyasztás: 123,4 m³"]);
  assert.equal(valid.invoice.consumption.value, "123,4 m³");
  assert.equal(valid.unverifiedField, false);

  const [invalid] = validateAiEvidence([{ ...row, consumption: { ...row.consumption, value: "12 m³" } }], ["Elszámolt fogyasztás: 123,4 m³"]);
  assert.equal(invalid.invoice.consumption.value, null);
  assert.equal(invalid.unverifiedField, true);
});

test("manual consumption input accepts comma decimals and bounds finite values", () => {
  assert.equal(parseConsumptionQuantityInput("1 234,50"), 1234.5);
  assert.equal(parseConsumptionQuantityInput(""), null);
  assert.equal(parseConsumptionQuantityInput("-1"), null);
  assert.equal(parseConsumptionQuantityInput("1e4"), null);
  assert.equal(parseConsumptionQuantityInput("1000000000001"), null);
});

test("new consumption values round trip through invoice storage and old snapshots receive null defaults", () => {
  const row = invoice({ consumptionQuantity: 123.45, consumptionUnit: "m3" });
  const stored = { ...toStoredInvoice(row, "report-id", 0), createdAt: new Date(), updatedAt: new Date() };
  assert.deepEqual(fromStoredInvoice(stored), row);

  const legacy = { ...row } as Record<string, unknown>;
  delete legacy.consumptionQuantity;
  delete legacy.consumptionUnit;
  const legacyFieldOrigin = { ...(legacy.fieldOrigin as Record<string, unknown>) };
  delete legacyFieldOrigin.consumptionQuantity;
  delete legacyFieldOrigin.consumptionUnit;
  legacy.fieldOrigin = legacyFieldOrigin;
  const parsed = invoiceReportFormSchema.shape.invoices.element.parse(legacy);
  assert.equal(parsed.consumptionQuantity, null);
  assert.equal(parsed.consumptionUnit, null);
});

test("legacy AI output defaults the optional consumption field to null", () => {
  const field = { value: null, evidence: null };
  const parsed = aiInvoiceSchema.parse({
    providerName: field, category: field, invoiceNumber: field, amount: field, currency: field,
    dueDate: field, billingPeriod: field, issuedAt: field, documentType: field, relatedInvoiceNumber: field,
  });
  assert.deepEqual(parsed.consumption, field);
});

test("utility history aggregates costs and independent unit groups while counting missing and excluded physical rows", () => {
  const invoices = [
    invoice({ id: "a", consumptionQuantity: 10, consumptionUnit: "m3", amountMinor: 1000 }),
    invoice({ id: "b", consumptionQuantity: 2.5, consumptionUnit: "m3", amountMinor: 2000 }),
    invoice({ id: "c", consumptionQuantity: 400, consumptionUnit: "kWh", amountMinor: 3000 }),
    invoice({ id: "d", consumptionQuantity: null, consumptionUnit: null, amountMinor: 4000 }),
    invoice({ id: "e", consumptionQuantity: 99, consumptionUnit: "m3", amountMinor: 5000, issues: ["conflict"] }),
    invoice({ id: "f", consumptionQuantity: 8, consumptionUnit: "m3", amountMinor: null, currency: null }),
    invoice({ id: "g", reportMonth: "2026-09", consumptionQuantity: 500, consumptionUnit: "m3" }),
  ];
  const result = buildUtilityHistoryMonth(invoices, "2026-10");
  assert.deepEqual(result.series, [
    { category: "gas", unit: "m3", consumption: 20.5, costMinor: null, missingConsumptionCount: 2, excludedCostCount: 2 },
    { category: "gas", unit: "kWh", consumption: 400, costMinor: null, missingConsumptionCount: 2, excludedCostCount: 2 },
    { category: "gas", unit: null, consumption: null, costMinor: 10000, missingConsumptionCount: 2, excludedCostCount: 2 },
  ]);
});

test("physical consumption does not require a usable amount or currency and manual quantities can clear source uncertainty", () => {
  const row = invoice({
    amountMinor: null,
    currency: null,
    consumptionQuantity: 4.25,
    consumptionUnit: "m3",
    issues: ["source-unverified"],
    fieldOrigin: { ...createEmptyInvoice("2026-10").fieldOrigin, consumptionQuantity: "manual", consumptionUnit: "manual" },
  });
  const result = buildUtilityHistoryMonth([row], "2026-10");
  assert.equal(result.series.find((entry) => entry.unit === "m3")?.consumption, 4.25);
});

test("explicit zero consumption remains data, while corrections and their referenced invoice are excluded", () => {
  const zero = invoice({ id: "zero", consumptionQuantity: 0, consumptionUnit: "m3", amountMinor: 0 });
  const zeroResult = buildUtilityHistoryMonth([zero], "2026-10");
  assert.equal(zeroResult.series.find((entry) => entry.unit === "m3")?.consumption, 0);
  assert.equal(zeroResult.series.find((entry) => entry.unit === null)?.costMinor, 0);
  assert.equal(zeroResult.series[0]?.missingConsumptionCount, 0);

  const original = invoice({ id: "original", invoiceNumber: "INV-7", consumptionQuantity: 10, consumptionUnit: "m3" });
  const correction = invoice({ id: "correction", invoiceNumber: "COR-7", relatedInvoiceNumber: "INV-7", documentType: "correction", consumptionQuantity: 2, consumptionUnit: "m3" });
  const correctedResult = buildUtilityHistoryMonth([original, correction], "2026-10");
  assert.equal(correctedResult.series.some((entry) => entry.unit === "m3"), false);
  assert.equal(correctedResult.series.find((entry) => entry.unit === null)?.costMinor, null);
  assert.equal(correctedResult.series[0]?.missingConsumptionCount, 2);
});
