import { createdAt, updatedAt } from "@/drizzle/schemaTypes";
import { check, bigint, boolean, date, foreignKey, integer, jsonb, pgTable, primaryKey, text, unique, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { invoiceReportFormSchema, invoiceRowSchema } from "../zod/schema";

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

export const monthlyExpenseReportsTable = pgTable.withRLS("monthly_expense_reports", {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportMonth: varchar("report_month", { length: 7 }).notNull(),
  version: integer().notNull().default(1),
  additionalItems: jsonb("additional_items").$type<typeof invoiceReportFormSchema._output["additionalItems"]>().notNull().default([]),
  createdAt,
  updatedAt,
}, (table) => [
  unique("monthly_expense_reports_report_month_key").on(table.reportMonth),
  check("monthly_expense_reports_month_check", sql`${table.reportMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  check("monthly_expense_reports_version_check", sql`${table.version} >= 1`),
]);

export const invoicesTable = pgTable.withRLS("invoices", {
  reportId: text("report_id").notNull(),
  id: text().$type<typeof invoiceRowSchema._output.id>().notNull(),
  position: integer().notNull(),
  providerName: varchar("provider_name", { length: 160 }).notNull(),
  category: varchar({ length: 20 }).$type<typeof invoiceRowSchema._output.category>().notNull(),
  invoiceNumber: varchar("invoice_number", { length: 120 }),
  amountMinor: bigint("amount_minor", { mode: "number" }),
  currency: varchar({ length: 3 }),
  dueDate: date("due_date", { mode: "string" }),
  billingPeriod: varchar("billing_period", { length: 160 }).notNull(),
  issuedAt: date("issued_at", { mode: "string" }),
  // Preserve the original ISO timestamp and its offset across a JSON round trip.
  sentAt: text("sent_at"),
  reportMonth: varchar("report_month", { length: 7 }).notNull(),
  documentType: varchar("document_type", { length: 20 }).$type<typeof invoiceRowSchema._output.documentType>(),
  relatedInvoiceNumber: varchar("related_invoice_number", { length: 120 }),
  sources: jsonb().$type<typeof invoiceRowSchema._output.sources>().notNull().default([]),
  fieldEvidence: jsonb("field_evidence").$type<typeof invoiceRowSchema._output.fieldEvidence>().notNull().default({}),
  fieldOrigin: jsonb("field_origin").$type<typeof invoiceRowSchema._output.fieldOrigin>().notNull(),
  manuallyEditedFields: jsonb("manually_edited_fields").$type<typeof invoiceRowSchema._output.manuallyEditedFields>().notNull().default([]),
  issues: jsonb().$type<typeof invoiceRowSchema._output.issues>().notNull().default([]),
  conflicts: jsonb().$type<typeof invoiceRowSchema._output.conflicts>().notNull().default([]),
  reviewStatus: varchar("review_status", { length: 20 }).$type<typeof invoiceRowSchema._output.reviewStatus>().notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  primaryKey({ columns: [table.reportId, table.id], name: "invoices_pkey" }),
  foreignKey({ columns: [table.reportId], foreignColumns: [monthlyExpenseReportsTable.id], name: "invoices_report_id_fkey" }).onDelete("cascade"),
  unique("invoices_report_position_key").on(table.reportId, table.position),
  check("invoices_position_check", sql`${table.position} >= 0`),
  check("invoices_amount_minor_check", sql`${table.amountMinor} is null or ${table.amountMinor} between -9000000000000 and 9000000000000`),
]);
