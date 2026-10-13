import { House, ChartNoAxesColumn, NotebookPen, Settings } from "lucide-react";
export const getAppNavigation = (canReadExpenses: boolean, canReadNotes: boolean) => [
  { title: "Áttekintés", href: "/app", Icon: House },
  ...(canReadExpenses ? [{ title: "Közművek", href: "/app/monthly-expenses", Icon: ChartNoAxesColumn }] : []),
  ...(canReadNotes ? [{ title: "Jegyzetek", href: "/app/notes", Icon: NotebookPen }] : []),
  ...(canReadExpenses ? [{ title: "Beállítások", href: "/app/settings", Icon: Settings }] : []),
];
export const isAppNavigationActive = (pathname: string, href: string) => href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
