import type { FC } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const NotesLoading: FC = () => {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10" aria-busy="true" aria-live="polite">
      <div className="mb-6"><Skeleton className="h-12 w-52" /><Skeleton className="mt-2 h-5 w-72" /></div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-64 rounded-xl" />)}
      </div>
    </main>
  );
};

export default NotesLoading;
