import type { FC } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const NotesLoading: FC = () => {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10" aria-busy="true" aria-live="polite">
      <div className="mb-7 grid min-h-36 items-center gap-5 sm:grid-cols-[1fr_300px]"><div><Skeleton className="h-14 w-60" /><Skeleton className="mt-3 h-5 w-96 max-w-full" /></div><Skeleton className="hidden h-36 rounded-2xl sm:block" /></div>
      <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-card p-4"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /></div>
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-60 rounded-[20px]" />)}
      </div>
    </main>
  );
};

export default NotesLoading;
