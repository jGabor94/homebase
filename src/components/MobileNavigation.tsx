"use client";
import type { FC } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { getAppNavigation, isAppNavigationActive } from "@/lib/app-navigation";
interface Props { canReadExpenses: boolean; canReadNotes: boolean }
const MobileNavigation: FC<Props> = ({ canReadExpenses, canReadNotes }) => {
  const pathname = usePathname();

  return <nav aria-label="Mobil fő navigáció" className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(16,37,45,0.04)] lg:hidden">{getAppNavigation(canReadExpenses, canReadNotes).map(({ title, href, Icon }) => {
    const active = isAppNavigationActive(pathname, href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm", active ? "bg-accent text-primary" : "text-muted-foreground")}><Icon aria-hidden="true" className="size-6" />{title}</Link>;
  })}</nav>;
};
export default MobileNavigation;
