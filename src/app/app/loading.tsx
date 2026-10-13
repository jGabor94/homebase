import type { FC } from "react";
import { Skeleton } from "@/components/ui/skeleton";
const AppLoading: FC = () => {

  return <main className="mx-auto w-full max-w-[1440px] p-5 sm:p-8" aria-label="Áttekintés betöltése"><Skeleton className="mb-4 h-12 w-2/3" /><Skeleton className="mb-8 h-5 w-1/2" /><div className="grid gap-5 xl:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-52 rounded-[22px]" />)}</div></main>;
};
export default AppLoading;
