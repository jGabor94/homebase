import { createdAt, updatedAt } from "@/drizzle/schemaTypes";
import { check, bigint, boolean, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const expensePresetsTable = pgTable.withRLS("expense_presets", {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar({ length: 120 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt,
  updatedAt,
}, (table) => [
  check("expense_presets_name_check", sql`length(btrim(${table.name})) between 1 and 120`),
  check("expense_presets_amount_minor_check", sql`${table.amountMinor} between 0 and 9000000000000`),
]);
