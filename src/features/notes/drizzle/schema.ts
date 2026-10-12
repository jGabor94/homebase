import { createdAt, updatedAt } from "@/drizzle/schemaTypes";
import { usersTable } from "@/features/user/drizzle/schema";
import { check, index, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const notesTable = pgTable.withRLS("notes", {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: varchar({ length: 120 }),
  content: text().notNull(),
  visibility: varchar({ length: 16 }).$type<"private" | "family">().notNull().default("private"),
  version: integer().notNull().default(1),
  createdAt,
  updatedAt,
}, (table) => [
  index("notes_updated_at_id_idx").on(table.updatedAt, table.id),
  index("notes_owner_updated_at_idx").on(table.ownerId, table.updatedAt, table.id),
  check("notes_title_length_check", sql`${table.title} is null or length(${table.title}) <= 120`),
  check("notes_content_length_check", sql`length(${table.content}) between 1 and 5000`),
  check("notes_visibility_check", sql`${table.visibility} in ('private', 'family')`),
  check("notes_version_check", sql`${table.version} >= 1`),
]);
