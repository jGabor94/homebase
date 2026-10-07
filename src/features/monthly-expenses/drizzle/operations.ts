import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { accountsTable } from "@/drizzle/schema";
import { expensePresetsTable } from "./schema";

export const getExpensePresets = async () => db.select({
  id: expensePresetsTable.id,
  name: expensePresetsTable.name,
  amountMinor: expensePresetsTable.amountMinor,
  isDefault: expensePresetsTable.isDefault,
}).from(expensePresetsTable).orderBy(asc(expensePresetsTable.name), asc(expensePresetsTable.id));

export const getStoredGmailConnection = async (userId: string) => {
  const accounts = await db.select({
    scope: accountsTable.scope,
    expiresAt: accountsTable.expires_at,
    hasAccessToken: sql<boolean>`coalesce(length(${accountsTable.access_token}), 0) > 0`,
    hasRefreshToken: sql<boolean>`coalesce(length(${accountsTable.refresh_token}), 0) > 0`,
  }).from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.provider, "google"))).limit(1);
  return accounts.at(0) ?? null;
};
