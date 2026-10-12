"use client";

import type { FC } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutDashboard, LogOut, NotebookPen, ReceiptText, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";

interface Props {
  name: string;
  email: string;
  canReadExpenses: boolean;
  canReadNotes: boolean;
  signOutAction: () => Promise<void>;
}

const AppSidebar: FC<Props> = ({ name, email, canReadExpenses, canReadNotes, signOutAction }) => {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnNavigation = () => { if (isMobile) setOpenMobile(false); };
  const items = [
    { title: "Áttekintés", href: "/app", Icon: LayoutDashboard },
    ...(canReadExpenses ? [{ title: "Közművek", href: "/app/monthly-expenses", Icon: ReceiptText }] : []),
    ...(canReadNotes ? [{ title: "Jegyzetek", href: "/app/notes", Icon: NotebookPen }] : []),
    ...(canReadExpenses ? [{ title: "Beállítások", href: "/app/settings", Icon: Settings }] : []),
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/app" onClick={closeOnNavigation} className="flex min-h-11 items-center gap-3 rounded-lg text-2xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-ring">
            <House aria-hidden="true" className="size-7 text-primary" /> homebase
          </Link>
          {isMobile && <Button variant="ghost" size="icon" className="size-11" aria-label="Navigáció bezárása" onClick={() => setOpenMobile(false)}><X aria-hidden="true" /></Button>}
        </div>
        <p className="text-sm text-muted-foreground">Jó itthon.</p>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Otthon</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Fő navigáció">
              <SidebarMenu>
                {items.map(({ title, href, Icon }) => {
                  const active = href === "/app" ? pathname === href : !href.includes("#") && (pathname === href || pathname.startsWith(`${href}/`));
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton asChild isActive={active} className="min-h-11">
                        <Link href={href} aria-current={active ? "page" : undefined} onClick={closeOnNavigation}>
                          <Icon aria-hidden="true" /><span>{title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-4">
        <div className="min-w-0 px-2 py-2">
          <p className="truncate text-sm font-medium">{name || email || "Családtag"}</p>
          {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" className="min-h-11 w-full justify-start"><LogOut aria-hidden="true" data-icon="inline-start" />Kijelentkezés</Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
