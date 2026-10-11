import type { FC } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import MonthlyExpensesForm from "@/features/monthly-expenses/components/MonthlyExpensesForm";
import { getExpensePresets, getGmailConnectionStatus, getMonthlyExpenseReports, getUtilityHistory } from "@/features/monthly-expenses/dal/queries";

export const metadata: Metadata = {
  title: "Közművek · homebase",
};

const MonthlyExpensesPage: FC = async () => {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasPermission(session.user, "monthlyExpenses", "read")) redirect("/app");

  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const currentYear = dateParts.find((part) => part.type === "year")?.value ?? "2026";
  const currentMonth = dateParts.find((part) => part.type === "month")?.value ?? "01";
  const initialMonth = `${currentYear}-${currentMonth}`;
  const [gmailConnection, presetsResult, reportsResult, historyResult] = await Promise.all([getGmailConnectionStatus(), getExpensePresets(), getMonthlyExpenseReports(), getUtilityHistory()]);
  const initialGmailConnected = gmailConnection?.success === true && gmailConnection.data.connected;
  const initialExpensePresets = presetsResult.success ? presetsResult.data : [];
  const initialPresetsError = presetsResult.success ? null : presetsResult.error.message;
  const initialStoredReports = reportsResult.success ? reportsResult.data : [];
  const initialStoredReportsError = reportsResult.success ? null : reportsResult.error.message;

  return (
    <>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10">
        <section className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.035em] text-foreground">Közművek</h1>
            <p className="mt-1 max-w-2xl text-base leading-6 text-muted-foreground">Így alakul a fogyasztásunk és a közművek költsége.</p>
          </div>
        </section>
        <MonthlyExpensesForm initialMonth={initialMonth} initialGmailConnected={initialGmailConnected} initialExpensePresets={initialExpensePresets} initialPresetsError={initialPresetsError} initialStoredReports={initialStoredReports} initialStoredReportsError={initialStoredReportsError} initialUtilityHistory={historyResult.success ? historyResult.data : []} initialUtilityHistoryError={historyResult.success ? null : historyResult.error.message} />
      </main>
    </>
  );
};

export default MonthlyExpensesPage;
