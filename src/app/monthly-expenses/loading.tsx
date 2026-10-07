import type { FC } from "react";
import { LoaderCircle } from "lucide-react";

const MonthlyExpensesLoading: FC = () => {

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10" aria-busy="true" aria-live="polite">
      <div className="mb-6">
        <p className="text-sm font-medium text-accent">Közös kiadások</p>
        <h1 className="mt-1 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.035em] text-foreground">Havi kiadások</h1>
      </div>
      <div className="flex min-h-48 items-center justify-center rounded-[20px] border border-border bg-card text-sm text-muted-foreground shadow-sm">
        <LoaderCircle aria-hidden="true" className="mr-3 size-5 animate-spin text-primary" /> Az oldal ellenőrzi a hozzáférést…
      </div>
    </main>
  );
};

export default MonthlyExpensesLoading;
