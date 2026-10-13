"use client";
import type { FC } from "react";
import Link from "next/link";
import { CalendarDays, LogOut, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import Brand from "./Brand";
import GlobalSearch from "@/features/search/components/GlobalSearch";
import { useNavigationGuard } from "@/providers/NavigationGuardProvider";
interface Props { name: string; email: string; dateLabel: string; weekday: string; signOutAction: () => Promise<void> }
const AppTopbar: FC<Props> = ({ name, email, dateLabel, weekday, signOutAction }) => {
  const { canLeave } = useNavigationGuard();

  return <header className="flex min-h-20 items-center justify-between gap-3 border-b bg-card px-4 sm:px-7 lg:rounded-t-[24px]">
    <Link href="/app" className="min-h-11 rounded-lg lg:hidden"><Brand compact /></Link><GlobalSearch />
    <div className="ml-auto flex shrink-0 items-center gap-4"><div className="hidden items-center gap-3 rounded-xl bg-muted/50 px-4 py-2 text-sm md:flex"><CalendarDays aria-hidden="true" className="size-5" /><div><p className="font-medium">{dateLabel}</p><p className="text-xs text-muted-foreground">{weekday}</p></div></div>
      <DropdownMenu.Root><DropdownMenu.Trigger className="flex min-h-11 items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Fiókmenü"><span className="flex size-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">{(name || email || "C").slice(0, 1).toLocaleUpperCase("hu-HU")}</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={12} className="z-50 w-64 rounded-2xl border bg-popover p-2 shadow-xl"><DropdownMenu.Label className="p-3"><span className="block truncate text-sm font-semibold">{name || "Családtag"}</span><span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{email}</span></DropdownMenu.Label><DropdownMenu.Separator className="my-1 h-px bg-border" /><DropdownMenu.Group><DropdownMenu.Item onSelect={(event) => { event.preventDefault(); if (canLeave()) void signOutAction(); }} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm outline-none focus:bg-accent"><LogOut aria-hidden="true" className="size-4" />Kijelentkezés</DropdownMenu.Item></DropdownMenu.Group></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
    </div>
  </header>;
};
export default AppTopbar;
