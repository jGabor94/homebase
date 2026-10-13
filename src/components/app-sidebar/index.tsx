"use client";
import type { FC } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UsersRound } from "lucide-react";
import Image from "next/image";
import Brand from "@/components/Brand";
import { getAppNavigation, isAppNavigationActive } from "@/lib/app-navigation";
import { useNavigationGuard } from "@/providers/NavigationGuardProvider";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator } from "@/components/ui/sidebar";
interface Props { name: string; email: string; canReadExpenses: boolean; canReadNotes: boolean; signOutAction: () => Promise<void> }
const AppSidebar: FC<Props> = ({ name, email, canReadExpenses, canReadNotes, signOutAction }) => {
  const pathname = usePathname();
  const { canLeave } = useNavigationGuard();

  return <Sidebar variant="floating" className="p-3" collapsible="offcanvas">
    <SidebarHeader className="px-5 py-7"><Link href="/app" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><Brand inverted /></Link></SidebarHeader>
    <SidebarSeparator />
    <SidebarContent className="flex flex-col justify-between px-3 py-5">
      <nav aria-label="Fő navigáció"><SidebarMenu>{getAppNavigation(canReadExpenses, canReadNotes).map(({ title, href, Icon }) => <SidebarMenuItem key={href}><SidebarMenuButton asChild isActive={isAppNavigationActive(pathname, href)} className="min-h-12 rounded-xl px-4 text-sm data-[active=true]:border data-[active=true]:border-cyan-300/20 data-[active=true]:border-l-[3px] data-[active=true]:border-l-cyan-300"><Link href={href} aria-current={isAppNavigationActive(pathname, href) ? "page" : undefined}><Icon aria-hidden="true" /><span>{title}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></nav>
      <div className="relative mt-12 overflow-hidden rounded-2xl bg-sidebar-accent/30 p-4"><UsersRound aria-hidden="true" className="mb-3 size-6 text-cyan-300" /><p className="relative z-10 text-sm font-semibold leading-5">Egy rendezettebb<br />otthonért</p><p className="relative z-10 mt-2 max-w-[120px] text-xs leading-5 text-sidebar-foreground/70">Számlák, jegyzetek és minden, ami közös — egy helyen.</p><Image src="/images/homebase/sidebar-leaves.svg" alt="" width={92} height={104} unoptimized className="pointer-events-none absolute -right-1 -bottom-1 h-24 w-auto" /></div>
    </SidebarContent>
    <SidebarSeparator className="lg:hidden" />
    <SidebarFooter className="gap-4 px-5 py-5 lg:hidden"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold">{(name || email || "C").slice(0, 1).toLocaleUpperCase("hu-HU")}</span><div className="min-w-0"><p className="truncate text-xs font-medium">{name || "Családtag"}</p><p className="mt-1 truncate text-[10px] text-sidebar-foreground/70">{email}</p></div></div><form action={signOutAction} onSubmit={(event) => { if (!canLeave()) event.preventDefault(); }}><button className="flex min-h-11 w-full items-center gap-3 rounded-lg text-xs text-sidebar-foreground/75 hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring"><LogOut aria-hidden="true" className="size-5" />Kijelentkezés</button></form></SidebarFooter>
  </Sidebar>;
};
export default AppSidebar;
