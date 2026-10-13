import type { getExpensesDashboardData, getUtilityHistoryWindowData } from "../drizzle/dashboard";

export type ExpensesDashboard = Awaited<ReturnType<typeof getExpensesDashboardData>>;
export type ExpensesDashboardReport = ExpensesDashboard["reports"][number];
export type ExpensesDashboardCategory = NonNullable<ExpensesDashboard["current"]>["categories"][number];
export type ExpensesDashboardDeadline = ExpensesDashboard["deadlines"][number];
export type UtilityHistoryWindow = Awaited<ReturnType<typeof getUtilityHistoryWindowData>>;
