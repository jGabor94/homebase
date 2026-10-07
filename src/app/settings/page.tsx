import type { FC } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, House, Settings } from "lucide-react";
import { auth } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import PresetSettingsForm from "@/features/monthly-expenses/components/PresetSettingsForm";
import { getExpensePresets } from "@/features/monthly-expenses/dal/queries";

export const metadata: Metadata = {
  title: "Beállítások · homebase",
};

const SettingsPage: FC = async () => {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasPermission(session.user, "monthlyExpenses", "read")) redirect("/");

  const presetsResult = await getExpensePresets();
  const initialPresets = presetsResult.success ? presetsResult.data : [];
  const initialError = presetsResult.success ? null : presetsResult.error.message;

  return (
    <>
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-5 gap-y-0 px-5 sm:flex-nowrap sm:px-8 lg:px-10">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-lg text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><House aria-hidden="true" className="size-5" /></span>
            <span className="font-serif text-xl font-semibold tracking-tight">homebase</span>
          </Link>
          <nav aria-label="Fő navigáció" className="flex w-full items-center justify-center gap-2 pb-2 text-sm font-medium sm:w-auto sm:justify-start sm:gap-4 sm:pb-0">
            <Link href="/monthly-expenses" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Közművek</span></Link>
            <span aria-current="page" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-note-peach/70 px-3 text-foreground"><Settings aria-hidden="true" className="size-4 text-primary" /> Beállítások</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10">
        <section className="mb-6">
          <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.035em] text-foreground">Beállítások</h1>
          <p className="mt-1 max-w-2xl text-base leading-6 text-muted-foreground">Közösen használt havi tételsablonok.</p>
        </section>
        <PresetSettingsForm initialPresets={initialPresets} initialError={initialError} />
      </main>
    </>
  );
};

export default SettingsPage;
