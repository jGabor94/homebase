import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { invoicesTable, monthlyExpenseReportsTable } from "./schema";
import { fromStoredInvoice } from "../utils/invoice-storage";
import { buildExpensesDashboard, getDashboardMonthBounds } from "../utils/dashboard";
import { buildUtilityHistoryMonth } from "../utils/consumption";

const getReportRowsInWindow = (firstMonth: string, lastMonth: string) => db.select({
    id: monthlyExpenseReportsTable.id,
    reportMonth: monthlyExpenseReportsTable.reportMonth,
    additionalItems: monthlyExpenseReportsTable.additionalItems,
    invoice: invoicesTable,
  }).from(monthlyExpenseReportsTable)
    .leftJoin(invoicesTable, eq(monthlyExpenseReportsTable.id, invoicesTable.reportId))
    .where(and(
      gte(monthlyExpenseReportsTable.reportMonth, firstMonth),
      lte(monthlyExpenseReportsTable.reportMonth, lastMonth),
    ))
    .orderBy(asc(monthlyExpenseReportsTable.reportMonth), asc(invoicesTable.position));

const groupReportRows = (rows: Awaited<ReturnType<typeof getReportRowsInWindow>>) => {
  const grouped = new Map<string, {
    reportMonth: string;
    additionalItems: typeof monthlyExpenseReportsTable.$inferSelect.additionalItems;
    invoices: ReturnType<typeof fromStoredInvoice>[];
  }>();
  for (const row of rows) {
    let report = grouped.get(row.id);
    if (!report) {
      report = { reportMonth: row.reportMonth, additionalItems: row.additionalItems, invoices: [] };
      grouped.set(row.id, report);
    }
    if (row.invoice) report.invoices.push(fromStoredInvoice(row.invoice));
  }
  return [...grouped.values()];
};

export const getExpensesDashboardData = async (month: string, today: string) => {
  const { firstMonth, lastMonth } = getDashboardMonthBounds(month);
  const reports = groupReportRows(await getReportRowsInWindow(firstMonth, lastMonth));
  return buildExpensesDashboard(month, reports, today);
};

export const getUtilityHistoryWindowData = async (month: string) => {
  const { firstMonth, lastMonth } = getDashboardMonthBounds(month, 12);
  const reports = groupReportRows(await getReportRowsInWindow(firstMonth, lastMonth));
  return reports.map(({ reportMonth, invoices }) => buildUtilityHistoryMonth(invoices, reportMonth));
};
