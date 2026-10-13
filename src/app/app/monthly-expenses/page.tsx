import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import MonthlyExpensesForm from "@/features/monthly-expenses/components/MonthlyExpensesForm";
import { getExpensePresets, getGmailConnectionStatus, getMonthlyExpenseReport, getMonthlyExpenseReports } from "@/features/monthly-expenses/dal/queries";
import { getUtilityHistoryWindow } from "@/features/monthly-expenses/dal/dashboard";
import AppPageHeader from "@/components/AppPageHeader";

export const metadata: Metadata = {
  title: "Közművek · homebase",
};

const MonthlyExpensesPage = async ({ searchParams }: { searchParams: Promise<{ month?: string | string[]; action?: string | string[] }> }) => {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasPermission(session.user, "monthlyExpenses", "read")) redirect("/app");

  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const currentYear = dateParts.find((part) => part.type === "year")?.value ?? "2026";
  const currentMonth = dateParts.find((part) => part.type === "month")?.value ?? "01";
  const initialMonth = `${currentYear}-${currentMonth}`;
  const query = await searchParams;
  const requestedMonth = query.month === undefined ? null : typeof query.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month) ? query.month : "invalid";
  const initialIntent = query.action === "invoice" ? "invoice" : null;
  const [gmailConnection, presetsResult, reportsResult, historyResult, requestedReportResult] = await Promise.all([
    getGmailConnectionStatus(), getExpensePresets(), getMonthlyExpenseReports(), getUtilityHistoryWindow(initialMonth),
    requestedMonth && requestedMonth !== "invalid" ? getMonthlyExpenseReport(requestedMonth) : Promise.resolve(null),
  ]);
  const initialGmailConnected = gmailConnection?.success === true && gmailConnection.data.connected;
  const initialExpensePresets = presetsResult.success ? presetsResult.data : [];
  const initialPresetsError = presetsResult.success ? null : presetsResult.error.message;
  const initialStoredReports = reportsResult.success ? reportsResult.data : [];
  const initialStoredReportsError = reportsResult.success ? null : reportsResult.error.message;
  const initialRequestedReport = requestedReportResult?.success ? requestedReportResult.data : null;
  const initialRequestedReportError = requestedMonth === "invalid"
    ? "A hónap hivatkozása hibás. Válassz egy mentett hónapot a listából."
    : requestedReportResult && !requestedReportResult.success ? requestedReportResult.error.message : null;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-10">

        <MonthlyExpensesForm overviewHeader={<AppPageHeader title="Közművek" description="Így alakul a fogyasztásunk és a közművek költsége." illustration="home" />} initialMonth={initialMonth} initialGmailConnected={initialGmailConnected} initialExpensePresets={initialExpensePresets} initialPresetsError={initialPresetsError} initialStoredReports={initialStoredReports} initialStoredReportsError={initialStoredReportsError} initialUtilityHistory={historyResult.success ? historyResult.data : []} initialUtilityHistoryError={historyResult.success ? null : historyResult.error.message} requestedMonth={requestedMonth} initialRequestedReport={initialRequestedReport} initialRequestedReportError={initialRequestedReportError} initialIntent={initialIntent} />
      </main>
  );
};

export default MonthlyExpensesPage;
