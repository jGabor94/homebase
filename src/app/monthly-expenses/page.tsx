import type { FC } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, House, ReceiptText, Settings } from "lucide-react";
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
  if (!hasPermission(session.user, "monthlyExpenses", "read")) redirect("/");

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
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-5 gap-y-0 px-5 sm:flex-nowrap sm:px-8 lg:px-10">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-lg text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><House aria-hidden="true" className="size-5" /></span>
            <span className="font-serif text-xl font-semibold tracking-tight">homebase</span>
          </Link>
          <Link href="/settings" target="_blank" rel="noopener noreferrer" aria-label="Beállítások megnyitása új lapon" title="Beállítások megnyitása új lapon" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <Settings aria-hidden="true" className="size-5" />
          </Link>
          <nav aria-label="Fő navigáció" className="flex w-full items-center justify-center gap-2 pb-2 text-sm font-medium sm:w-auto sm:justify-start sm:gap-4 sm:pb-0">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Áttekintés</span></Link>
            <span aria-current="page" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-note-peach/70 px-3 text-foreground"><ReceiptText aria-hidden="true" className="size-4 text-primary" /> Közművek</span>
          </nav>
        </div>
      </header>

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
