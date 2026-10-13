import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmptyInvoice } from "../utils";
import { buildUtilityHistoryMonth } from "../utils/consumption";
import { buildExpensesDashboard, getBudapestToday, getDashboardMonthBounds, getDashboardMonthWindow } from "../utils/dashboard";
import type { AdditionalItemInput, InvoiceRowInput } from "../types";

const invoice = (reportMonth: string, overrides: Partial<InvoiceRowInput> = {}): InvoiceRowInput => ({
  ...createEmptyInvoice(reportMonth, "gas"),
  providerName: "MVM",
  invoiceNumber: "INV-1",
  amountMinor: 12_000,
  currency: "HUF",
  issuedAt: `${reportMonth}-01`,
  reviewStatus: "reviewed",
  ...overrides,
});

const additional = (amountMinor: number): AdditionalItemInput => ({
  id: crypto.randomUUID(),
  name: "Közös kiadás",
  amountMinor,
  isDefault: false,
});

test("dashboard calendar window is chronological and ends at the requested month", () => {
  const sixMonths = getDashboardMonthWindow("2026-02");
  assert.deepEqual(sixMonths, [
    "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
  ]);
  assert.deepEqual(getDashboardMonthWindow("2026-02", 12), [
    "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08",
    ...sixMonths,
  ]);
  assert.deepEqual(getDashboardMonthBounds("2026-02"), { firstMonth: "2025-09", lastMonth: "2026-02" });
  assert.deepEqual(getDashboardMonthBounds("2026-02", 12), { firstMonth: "2025-03", lastMonth: "2026-02" });
  assert.equal(getDashboardMonthWindow("2000-01")[0], "1999-08");
});

test("missing months stay unknown while a saved zero item retains its known total", () => {
  const result = buildExpensesDashboard("2026-10", [{
    reportMonth: "2026-10",
    invoices: [],
    additionalItems: [additional(0)],
  }], "2026-10-12");

  assert.deepEqual(result.reports.at(-1), { reportMonth: "2026-10", totalMinor: 0, partial: true });
  assert.deepEqual(result.reports[0], { reportMonth: "2026-05", totalMinor: null, partial: true });
  assert.equal(result.current?.totalMinor, 0);
  assert.equal(result.current?.halfFormatted, "0 Ft");
  assert.equal(result.current?.categories.find((item) => item.category === "gas")?.amountMinor, null);
  assert.equal(result.current?.categories.find((item) => item.category === "gas")?.partial, true);
  assert.deepEqual(result.deadlines, []);
});

test("dashboard totals include saved additional items and split the whole known amount", () => {
  const reportMonth = "2026-10";
  const result = buildExpensesDashboard(reportMonth, [{
    reportMonth,
    invoices: [invoice(reportMonth, { amountMinor: 12_000 })],
    additionalItems: [additional(2_000)],
  }], "2026-10-12");

  assert.equal(result.current?.totalMinor, 14_000);
  assert.equal(result.current?.halfFormatted, "70 Ft");
  assert.equal(result.current?.partial, false);
});

test("comparison is shown only for two complete adjacent months", () => {
  const previousMonth = "2026-09";
  const currentMonth = "2026-10";
  const completeReports = [
    { reportMonth: previousMonth, invoices: [invoice(previousMonth, { amountMinor: 8_000 })], additionalItems: [] },
    { reportMonth: currentMonth, invoices: [invoice(currentMonth, { amountMinor: 10_000 })], additionalItems: [] },
  ];
  const complete = buildExpensesDashboard(currentMonth, completeReports, "2026-10-12");
  assert.deepEqual(complete.current?.previous, { reportMonth: previousMonth, totalMinor: 8_000, percentage: 25 });

  const partialPrevious = buildExpensesDashboard(currentMonth, [
    { ...completeReports[0], invoices: [invoice(previousMonth, { issues: ["conflict"] })] },
    completeReports[1],
  ], "2026-10-12");
  assert.equal(partialPrevious.current?.previous, null);
  assert.equal(partialPrevious.reports.at(-2)?.partial, true);
});

test("mixed physical units remain separate while category cost uses eligible invoices only", () => {
  const reportMonth = "2026-10";
  const rows = [
    invoice(reportMonth, { id: crypto.randomUUID(), amountMinor: 1_000, consumptionQuantity: 10, consumptionUnit: "m3" }),
    invoice(reportMonth, { id: crypto.randomUUID(), amountMinor: 2_000, consumptionQuantity: 400, consumptionUnit: "kWh" }),
    invoice(reportMonth, { id: crypto.randomUUID(), amountMinor: 9_000, consumptionQuantity: 90, consumptionUnit: "m3", issues: ["conflict"] }),
  ];

  const history = buildUtilityHistoryMonth(rows, reportMonth);
  assert.deepEqual(history.series.filter((item) => item.category === "gas" && item.unit !== null).map(({ unit, consumption }) => ({ unit, consumption })), [
    { unit: "m3", consumption: 10 },
    { unit: "kWh", consumption: 400 },
  ]);

  const dashboard = buildExpensesDashboard(reportMonth, [{ reportMonth, invoices: rows, additionalItems: [] }], "2026-10-12");
  assert.equal(dashboard.current?.categories.find((item) => item.category === "gas")?.amountMinor, 3_000);
  assert.equal(dashboard.current?.categories.find((item) => item.category === "gas")?.partial, true);
  assert.equal(dashboard.current?.totalMinor, 3_000);
  assert.equal(dashboard.current?.partial, true);
});

test("deadlines use Budapest today, include the 30-day boundary, and exclude ineligible rows", () => {
  const today = getBudapestToday(new Date("2026-10-12T22:30:00.000Z"));
  assert.equal(today, "2026-10-13");
  const reportMonth = "2026-10";
  const rows = [
    invoice(reportMonth, { id: crypto.randomUUID(), dueDate: today }),
    invoice(reportMonth, { id: crypto.randomUUID(), dueDate: "2026-11-12", amountMinor: 2_000 }),
    invoice(reportMonth, { id: crypto.randomUUID(), dueDate: "2026-11-13", amountMinor: 3_000 }),
    invoice(reportMonth, { id: crypto.randomUUID(), dueDate: "2026-10-12", amountMinor: 4_000 }),
    invoice(reportMonth, { id: crypto.randomUUID(), dueDate: "2026-10-20", amountMinor: 5_000, issues: ["conflict"] }),
  ];
  const result = buildExpensesDashboard(reportMonth, [{ reportMonth, invoices: rows, additionalItems: [] }], today);
  assert.deepEqual(result.deadlines.map(({ dueDate }) => dueDate), ["2026-10-13", "2026-11-12"]);

  const withoutCurrentReport = buildExpensesDashboard("2026-11", [{ reportMonth, invoices: rows, additionalItems: [] }], today);
  assert.equal(withoutCurrentReport.current, null);
  assert.deepEqual(withoutCurrentReport.deadlines.map(({ dueDate }) => dueDate), ["2026-10-13", "2026-11-12"]);
});
