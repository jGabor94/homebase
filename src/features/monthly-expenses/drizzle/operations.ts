import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { accountsTable } from "@/drizzle/schema";
import { expensePresetsTable, invoicesTable, monthlyExpenseReportsTable } from "./schema";
import { summarizeInvoices } from "../utils";
import { fromStoredInvoice } from "../utils/invoice-storage";

const getMonthlyExpenseReportRows = async (reportMonth?: string) => {
  const query = db.select({
    reportId: monthlyExpenseReportsTable.id,
    reportMonth: monthlyExpenseReportsTable.reportMonth,
    additionalItems: monthlyExpenseReportsTable.additionalItems,
    version: monthlyExpenseReportsTable.version,
    createdAt: monthlyExpenseReportsTable.createdAt,
    updatedAt: monthlyExpenseReportsTable.updatedAt,
    invoice: invoicesTable,
  }).from(monthlyExpenseReportsTable)
    .leftJoin(invoicesTable, eq(monthlyExpenseReportsTable.id, invoicesTable.reportId));
  return reportMonth
    ? query.where(eq(monthlyExpenseReportsTable.reportMonth, reportMonth)).orderBy(asc(invoicesTable.position))
    : query.orderBy(desc(monthlyExpenseReportsTable.reportMonth), asc(invoicesTable.position));
};

const groupMonthlyExpenseReportRows = (rows: Awaited<ReturnType<typeof getMonthlyExpenseReportRows>>) => {
  const groups = new Map<string, {
    id: string;
    reportMonth: string;
    additionalItems: typeof monthlyExpenseReportsTable.$inferSelect.additionalItems;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    invoices: ReturnType<typeof fromStoredInvoice>[];
  }>();
  for (const row of rows) {
    let report = groups.get(row.reportId);
    if (!report) {
      report = {
        id: row.reportId,
        reportMonth: row.reportMonth,
        additionalItems: row.additionalItems,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        invoices: [],
      };
      groups.set(row.reportId, report);
    }
    if (row.invoice) report.invoices.push(fromStoredInvoice(row.invoice));
  }
  return [...groups.values()];
};

export const getExpensePresets = async () => db.select({
  id: expensePresetsTable.id,
  name: expensePresetsTable.name,
  amountMinor: expensePresetsTable.amountMinor,
  isDefault: expensePresetsTable.isDefault,
}).from(expensePresetsTable).orderBy(asc(expensePresetsTable.name), asc(expensePresetsTable.id));

export const getMonthlyExpenseReports = async () => {
  const reports = groupMonthlyExpenseReportRows(await getMonthlyExpenseReportRows());
  return reports.map(({ reportMonth, invoices, additionalItems, version, updatedAt }) => {
    const summary = summarizeInvoices(invoices, 0, additionalItems);
    return {
      reportMonth,
      version,
      updatedAt: updatedAt.toISOString(),
      rowCount: invoices.length + additionalItems.length,
      totalMinor: summary.totalMinor,
      totalOverflow: summary.totalOverflow,
    };
  });
};

export const getMonthlyExpenseReport = async (reportMonth: string) => {
  const [report] = groupMonthlyExpenseReportRows(await getMonthlyExpenseReportRows(reportMonth));
  if (!report) return null;
  return {
    reportMonth: report.reportMonth,
    version: report.version,
    snapshot: {
      reportMonth: report.reportMonth,
      invoices: report.invoices,
      additionalItems: report.additionalItems,
    },
  };
};

export const getStoredGmailConnection = async (userId: string) => {
  const accounts = await db.select({
    scope: accountsTable.scope,
    expiresAt: accountsTable.expires_at,
    hasAccessToken: sql<boolean>`coalesce(length(${accountsTable.access_token}), 0) > 0`,
    hasRefreshToken: sql<boolean>`coalesce(length(${accountsTable.refresh_token}), 0) > 0`,
  }).from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.provider, "google"))).limit(1);
  return accounts.at(0) ?? null;
};
