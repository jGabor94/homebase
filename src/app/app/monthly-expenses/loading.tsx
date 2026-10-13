import type { FC } from "react";
import { LoaderCircle } from "lucide-react";

const MonthlyExpensesLoading: FC = () => {

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-10" aria-busy="true" aria-live="polite">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Közművek</h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-muted-foreground">Így alakul a fogyasztásunk és a közművek költsége.</p>
      </div>
      <div className="flex min-h-48 items-center justify-center rounded-[20px] border border-border bg-card text-sm text-muted-foreground shadow-sm">
        <LoaderCircle aria-hidden="true" className="mr-3 size-5 animate-spin text-primary" /> Az oldal ellenőrzi a hozzáférést…
      </div>
    </main>
  );
};

export default MonthlyExpensesLoading;
