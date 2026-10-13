import { INVOICE_CATEGORIES } from "../config";
import type { AdditionalItemInput, InvoiceRowInput } from "../types";
import { buildUtilityHistoryMonth, isInvoiceCostEligible, summarizeInvoices } from "./index";
import { splitMinorAmount } from "./money";

export type DashboardReportInput = {
  reportMonth: string;
  invoices: InvoiceRowInput[];
  additionalItems: AdditionalItemInput[];
};

export const getDashboardMonthWindow = (month: string, count = 6) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1 - (count - 1 - index), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
};

export const getDashboardMonthBounds = (month: string, count = 6) => {
  const months = getDashboardMonthWindow(month, count);
  return { firstMonth: months[0]!, lastMonth: months[months.length - 1]! };
};

export const getBudapestToday = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const addDays = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
};

const summarizeDashboardReport = ({ reportMonth, invoices, additionalItems }: DashboardReportInput) => {
  const summary = summarizeInvoices(invoices, 0, additionalItems);
  const partial = invoices.length === 0
    || summary.incompleteCount > 0
    || summary.additionalIncompleteCount > 0
    || summary.totalOverflow;
  const history = buildUtilityHistoryMonth(invoices, reportMonth);
  const categories = INVOICE_CATEGORIES.map((category) => {
    const categorySeries = history.series.find((series) => series.category === category && series.unit === null);
    return {
      category,
      amountMinor: categorySeries?.costMinor ?? null,
      partial: !categorySeries || categorySeries.costMinor === null || categorySeries.excludedCostCount > 0,
    };
  });

  return {
    reportMonth,
    totalMinor: summary.totalMinor,
    halfFormatted: `${Math.round(splitMinorAmount(summary.totalMinor).firstMinor / 100).toLocaleString("hu-HU")} Ft`,
    partial,
    categories,
    complete: !partial && invoices.length > 0,
  };
};

export const buildExpensesDashboard = (
  month: string,
  reports: DashboardReportInput[],
  today: string,
) => {
  const months = getDashboardMonthWindow(month);
  const reportByMonth = new Map(reports.map((report) => [report.reportMonth, report]));
  const summarizedByMonth = new Map([...reportByMonth].map(([reportMonth, report]) => [
    reportMonth,
    summarizeDashboardReport(report),
  ]));
  const reportSummaries = months.map((reportMonth) => {
    const summary = summarizedByMonth.get(reportMonth);
    return {
      reportMonth,
      totalMinor: summary?.totalMinor ?? null,
      partial: summary?.partial ?? true,
    };
  });

  const currentReport = summarizedByMonth.get(month);
  const previousMonth = getDashboardMonthWindow(month).at(-2);
  const previousReport = previousMonth ? summarizedByMonth.get(previousMonth) : undefined;
  let previous: { reportMonth: string; totalMinor: number; percentage: number } | null = null;
  if (currentReport?.complete && previousReport?.complete && previousReport.totalMinor > 0) {
    const percentage = ((currentReport.totalMinor - previousReport.totalMinor) / previousReport.totalMinor) * 100;
    if (Number.isFinite(percentage) && Math.abs(percentage) <= Number.MAX_SAFE_INTEGER) {
      previous = {
        reportMonth: previousReport.reportMonth,
        totalMinor: previousReport.totalMinor,
        percentage: Math.round(percentage),
      };
    }
  }

  const deadlineEnd = addDays(today, 30);
  const deadlines = reports.flatMap(({ reportMonth, invoices }) => invoices
    .filter((invoice): invoice is InvoiceRowInput & { dueDate: string; amountMinor: number } => invoice.dueDate !== null
      && invoice.dueDate >= today
      && invoice.dueDate <= deadlineEnd
      && isInvoiceCostEligible(invoice, invoices))
    .map((invoice) => ({
      id: invoice.id,
      providerName: invoice.providerName,
      category: invoice.category,
      dueDate: invoice.dueDate,
      amountMinor: invoice.amountMinor,
      reportMonth,
    })))
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.providerName.localeCompare(right.providerName, "hu-HU"));

  return {
    reports: reportSummaries,
    deadlines,
    current: currentReport ? {
      reportMonth: currentReport.reportMonth,
      totalMinor: currentReport.totalMinor,
      halfFormatted: currentReport.halfFormatted,
      partial: currentReport.partial,
      categories: currentReport.categories,
      previous,
    } : null,
  };
};
