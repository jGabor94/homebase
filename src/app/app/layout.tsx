import type { FC, ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import AppSidebar from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface Props {
  children: ReactNode;
}

const AppLayout: FC<Props> = async ({ children }) => {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <SidebarProvider>
      <AppSidebar
        name={session.user.name ?? ""}
        email={session.user.email ?? ""}
        canReadExpenses={hasPermission(session.user, "monthlyExpenses", "read")}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-3 border-b bg-card/80 px-5 sm:px-8">
          <SidebarTrigger className="size-11" aria-label="Navigáció megnyitása vagy bezárása" />
          <span className="text-sm text-muted-foreground">Számlák, tervek és minden, ami közös.</span>
        </header>
        {children}
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
