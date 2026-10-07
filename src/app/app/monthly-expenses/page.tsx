import type { FC } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import MonthlyExpensesForm from "@/features/monthly-expenses/components/MonthlyExpensesForm";
import { getExpensePresets, getGmailConnectionStatus } from "@/features/monthly-expenses/dal/queries";

export const metadata: Metadata = {
  title: "Havi kiadások · homebase",
};

const MonthlyExpensesPage: FC = async () => {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasPermission(session.user, "monthlyExpenses", "read")) redirect("/app");

  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const currentYear = dateParts.find((part) => part.type === "year")?.value ?? "2026";
  const currentMonth = dateParts.find((part) => part.type === "month")?.value ?? "01";
  const initialMonth = `${currentYear}-${currentMonth}`;
  const [gmailConnection, presetsResult] = await Promise.all([getGmailConnectionStatus(), getExpensePresets()]);
  const initialGmailConnected = gmailConnection?.success === true && gmailConnection.data.connected;
  const initialExpensePresets = presetsResult.success ? presetsResult.data : [];
  const initialPresetsError = presetsResult.success ? null : presetsResult.error.message;

  return (
    <>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10">
        <section className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.035em] text-foreground">Havi kiadások</h1>
            <p className="mt-1 max-w-2xl text-base leading-6 text-muted-foreground">Számlák e-mailből, PDF-ből vagy kézzel.</p>
          </div>
          <p className="max-w-sm rounded-xl bg-note-yellow/70 px-4 py-3 text-sm leading-5 text-foreground">A kimutatás most még csak ezen az oldalon él, nincs automatikus mentése.</p>
        </section>
        <MonthlyExpensesForm initialMonth={initialMonth} initialGmailConnected={initialGmailConnected} initialExpensePresets={initialExpensePresets} initialPresetsError={initialPresetsError} />
        <footer className="mt-7 border-t border-border pt-4 text-center text-xs text-muted-foreground">A számlasorokat import után nézd át; a kinyert adatok ellenőrzésre várnak.</footer>
      </main>
    </>
  );
};

export default MonthlyExpensesPage;
