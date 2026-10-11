import type { ConsumptionUnit, InvoiceRowInput } from "../types";
import { isInvoiceCostEligible, isUtilityConsumptionEligible } from "./eligibility";

export const parseConsumptionQuantityInput = (value: string): number | null => {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/gu, "").replace(",", ".");
  if (!normalized || !/^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(normalized)) return null;
  const quantity = Number(normalized);
  return Number.isFinite(quantity) && quantity <= 1_000_000_000_000 ? quantity : null;
};

const consumptionLabel = /(?:fogyaszt[aá]s|fogyasztott\s+mennyis[eé]g|elfogyasztott\s+mennyis[eé]g|felhaszn[aá]lt\s+mennyis[eé]g|elsz[aá]molt\s+mennyis[eé]g)/iu;
const quantityPattern = /(?:^|[^\d])([0-9][0-9\s\u00a0\u202f]*(?:[,.][0-9]+)?)\s*(m(?:³|3)|kwh|mj|kg|l(?:iter)?|db|darab)(?!\p{L})/iu;

const normalizeUnit = (unit: string): ConsumptionUnit | null => {
  const normalized = unit.toLocaleLowerCase("hu-HU").replace("³", "3");
  if (normalized === "m3") return "m3";
  if (normalized === "kwh") return "kWh";
  if (normalized === "mj") return "MJ";
  if (normalized === "kg") return "kg";
  if (normalized === "l" || normalized === "liter") return "l";
  if (normalized === "db" || normalized === "darab") return "piece";
  return null;
};

const findWaterConsumption = (text: string) => {
  const amount = "([0-9][0-9\\t \\u00a0\\u202f]*(?:[,.][0-9]+)?)";
  const waterValue = `Iv[oó]v[ií]z[\\t ]+${amount}[\\t ]+m(?:3|³)[\\t ]*$`;
  const patterns = [
    new RegExp(`^[\\t ]*Elsz[aá]molt[\\t ]+mennyis[eé]g:[\\t ]*${waterValue}`, "gimu"),
    // ALFÖLDVÍZ PDFs can serialize both labels before the drinking-water and sewage values.
    new RegExp(`^(?:[\\t ]*Elsz[aá]molt[\\t ]+mennyis[eé]g:[\\t ]*\\r?\\n){1,2}(?:[\\t ]*SZ[AÁ]MLAR[EÉ]SZLETEZ[OŐ][\\t ]*\\r?\\n)?[\\t ]*${waterValue}`, "gimu"),
  ];
  const matches = patterns.flatMap((pattern) => [...text.matchAll(pattern)]);
  if (matches.length !== 1) return null;
  const match = matches[0];
  const quantity = parseConsumptionQuantityInput(match[1]);
  if (quantity === null) return null;
  // Sewage and water-load fees refer to the same water; their quantities must not be added again.
  return { quantity, unit: "m3" as const, quote: match[0].trim(), index: match.index };
};

export const findExplicitConsumption = (text: string): { quantity: number; unit: ConsumptionUnit; quote: string; index: number } | null => {
  const water = findWaterConsumption(text);
  if (water) return water;
  const lines = text.split(/\r?\n/u);
  const matches = lines.flatMap((line, lineIndex) => {
    if (!consumptionLabel.test(line) || /(?:id[oő]szak|m[eé]r[oő]|[aá]ll[aá]s|egys[eé]g[aá]r|d[ií]j|tarifa|leolvas[aá]s|szennyv[ií]z)/iu.test(line)) return [];
    const lineMatches = [...line.matchAll(new RegExp(quantityPattern.source, quantityPattern.flags + "g"))];
    if (lineMatches.length !== 1) return [];
    const match = lineMatches[0];
    const quantity = parseConsumptionQuantityInput(match[1]);
    const unit = normalizeUnit(match[2]);
    const index = lines.slice(0, lineIndex).reduce((length, previous) => length + previous.length + 1, 0);
    return quantity !== null && unit ? [{ quantity, unit, quote: line.trim(), index }] : [];
  });
  return matches.length === 1 ? matches[0] : null;
};

export const parseExplicitConsumption = (text: string): { quantity: number; unit: ConsumptionUnit } | null => {
  const result = findExplicitConsumption(text);
  return result ? { quantity: result.quantity, unit: result.unit } : null;
};

type UtilityHistorySeries = {
  category: InvoiceRowInput["category"];
  unit: ConsumptionUnit | null;
  consumption: number | null;
  costMinor: number | null;
  missingConsumptionCount: number;
  excludedCostCount: number;
};

export const buildUtilityHistoryMonth = (invoices: InvoiceRowInput[], reportMonth: string) => {
  const monthInvoices = invoices.filter((invoice) => invoice.reportMonth === reportMonth);
  const categories = [...new Set(monthInvoices.map(({ category }) => category))];
  const series: UtilityHistorySeries[] = [];

  for (const category of categories) {
    const categoryInvoices = monthInvoices.filter((invoice) => invoice.category === category);
    const consumptionRows = categoryInvoices.filter((invoice) => isUtilityConsumptionEligible(invoice, categoryInvoices));
    const missingConsumptionCount = categoryInvoices.length - consumptionRows.filter((invoice) =>
      invoice.consumptionQuantity !== null && invoice.consumptionUnit !== null).length;
    const units = [...new Set(consumptionRows.flatMap((invoice) =>
      invoice.consumptionQuantity !== null && invoice.consumptionUnit !== null ? [invoice.consumptionUnit] : []))];

    for (const unit of units) {
      const matching = consumptionRows.filter((invoice) => invoice.consumptionUnit === unit && invoice.consumptionQuantity !== null);
      const total = matching.reduce((sum, invoice) => sum + (invoice.consumptionQuantity ?? 0), 0);
      series.push({
        category,
        unit,
        consumption: Number.isFinite(total) ? total : null,
        costMinor: null,
        missingConsumptionCount,
        excludedCostCount: categoryInvoices.length - categoryInvoices.filter((invoice) => isInvoiceCostEligible(invoice, categoryInvoices)).length,
      });
    }

    const eligibleCosts = categoryInvoices.filter((invoice) => isInvoiceCostEligible(invoice, categoryInvoices));
    let costTotal = 0;
    let hasCost = false;
    for (const invoice of eligibleCosts) {
      if (invoice.amountMinor === null) continue;
      const next = costTotal + invoice.amountMinor;
      if (!Number.isSafeInteger(next)) continue;
      costTotal = next;
      hasCost = true;
    }
    series.push({
      category,
      unit: null,
      consumption: null,
      costMinor: hasCost ? costTotal : null,
      missingConsumptionCount,
      excludedCostCount: categoryInvoices.length - eligibleCosts.length,
    });
  }

  return { reportMonth, series };
};

export type { UtilityHistorySeries };
