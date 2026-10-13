import "server-only";
import { asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { invoicesTable, monthlyExpenseReportsTable } from "./schema";

export const searchMonthlyExpenseRecords = async (query: string) => {
  const pattern = `%${query}%`;
  const [matchingMonths, matchingInvoices] = await Promise.all([
    db.select({ reportMonth: monthlyExpenseReportsTable.reportMonth, updatedAt: monthlyExpenseReportsTable.updatedAt })
      .from(monthlyExpenseReportsTable)
      .where(ilike(monthlyExpenseReportsTable.reportMonth, pattern))
      .orderBy(desc(monthlyExpenseReportsTable.reportMonth))
      .limit(10),
    db.select({
      reportMonth: monthlyExpenseReportsTable.reportMonth,
      updatedAt: monthlyExpenseReportsTable.updatedAt,
      providerName: invoicesTable.providerName,
      invoiceNumber: invoicesTable.invoiceNumber,
    }).from(invoicesTable)
      .innerJoin(monthlyExpenseReportsTable, eq(invoicesTable.reportId, monthlyExpenseReportsTable.id))
      .where(or(ilike(invoicesTable.providerName, pattern), ilike(invoicesTable.invoiceNumber, pattern)))
      .orderBy(desc(monthlyExpenseReportsTable.reportMonth), asc(invoicesTable.position))
      .limit(10),
  ]);

  const byMonth = new Map<string, {
    reportMonth: string;
    updatedAt: string;
    providerName: string | null;
    invoiceNumber: string | null;
  }>();
  for (const invoice of matchingInvoices) {
    if (!byMonth.has(invoice.reportMonth)) {
      byMonth.set(invoice.reportMonth, {
        reportMonth: invoice.reportMonth,
        updatedAt: invoice.updatedAt.toISOString(),
        providerName: invoice.providerName,
        invoiceNumber: invoice.invoiceNumber,
      });
    }
  }
  for (const report of matchingMonths) {
    if (!byMonth.has(report.reportMonth)) {
      byMonth.set(report.reportMonth, {
        reportMonth: report.reportMonth,
        updatedAt: report.updatedAt.toISOString(),
        providerName: null,
        invoiceNumber: null,
      });
    }
  }
  return [...byMonth.values()].sort((left, right) => right.reportMonth.localeCompare(left.reportMonth)).slice(0, 10);
};
