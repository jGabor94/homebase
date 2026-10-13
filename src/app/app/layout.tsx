import type { FC, ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import { canAccessNotes } from "@/features/notes/lib/access";
import AppSidebar from "@/components/app-sidebar";
import AppTopbar from "@/components/AppTopbar";
import MobileNavigation from "@/components/MobileNavigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import NavigationGuardProvider from "@/providers/NavigationGuardProvider";
import AppToaster from "@/providers/AppToaster";
interface Props { children: ReactNode }
const AppLayout: FC<Props> = async ({ children }) => {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const canReadNotes = await canAccessNotes(session.user.id);
  const canReadExpenses = hasPermission(session.user, "monthlyExpenses", "read");
  const name = session.user.name ?? "";
  const email = session.user.email ?? "";
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Budapest" }).format(now);
  const weekday = new Intl.DateTimeFormat("hu-HU", { weekday: "long", timeZone: "Europe/Budapest" }).format(now);
  const signOutAction = async () => { "use server"; await signOut({ redirectTo: "/" }); };

  return <NavigationGuardProvider><a href="#app-content" className="fixed top-3 left-3 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:translate-y-0">Ugrás a tartalomra</a><SidebarProvider className="lg:bg-sidebar-border"><AppSidebar name={name} email={email} canReadExpenses={canReadExpenses} canReadNotes={canReadNotes} signOutAction={signOutAction} /><div id="app-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col bg-background pb-[calc(80px+env(safe-area-inset-bottom))] outline-none lg:my-3 lg:mr-3 lg:rounded-[24px] lg:border lg:pb-0"><AppTopbar name={name} email={email} dateLabel={dateLabel} weekday={weekday} signOutAction={signOutAction} />{children}</div><MobileNavigation canReadExpenses={canReadExpenses} canReadNotes={canReadNotes} /><AppToaster /></SidebarProvider></NavigationGuardProvider>;
};
export default AppLayout;
