import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { invoicesTable, monthlyExpenseReportsTable } from "../drizzle/schema";
import { fromStoredInvoice, toStoredInvoice } from "../utils/invoice-storage";
import { invoiceReportFormSchema } from "../zod/schema";

const migrate = async () => {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const database = drizzle({ client });
  try {
    const result = await database.transaction(async (transaction) => {
      // Prevent concurrent legacy saves while copying and removing the old column.
      await transaction.execute(sql`LOCK TABLE monthly_expense_reports IN ACCESS EXCLUSIVE MODE`);
      const columns = await transaction.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monthly_expense_reports'`);
      const hasSnapshot = columns.some((column) => column.column_name === "snapshot");
      if (!hasSnapshot) {
        assert.ok(columns.some((column) => column.column_name === "additional_items"), "The normalized report column is missing.");
        return { alreadyApplied: true, reports: 0, invoices: 0 };
      }
      await transaction.execute(sql`ALTER TABLE monthly_expense_reports ADD COLUMN IF NOT EXISTS additional_items jsonb NOT NULL DEFAULT '[]'::jsonb`);
      const legacyRows = await transaction.execute(sql`SELECT id, report_month, snapshot FROM monthly_expense_reports`);
      let invoiceCount = 0;
      for (const raw of legacyRows) {
        const legacy = z.object({ id: z.string(), report_month: z.string(), snapshot: invoiceReportFormSchema }).parse(raw);
        assert.deepEqual(legacy.snapshot, raw.snapshot, "Legacy data must not be trimmed or discarded during validation.");
        assert.equal(legacy.snapshot.reportMonth, legacy.report_month, "The legacy snapshot month does not match its report.");
        const existing = await transaction.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.reportId, legacy.id)).limit(1);
        assert.equal(existing.length, 0, "Existing normalized invoices must not be overwritten by backfill.");
        if (legacy.snapshot.invoices.length > 0) {
          await transaction.insert(invoicesTable).values(legacy.snapshot.invoices.map((invoice, position) => toStoredInvoice(invoice, legacy.id, position)));
        }
        // Raw SQL preserves the original timestamp without invoking the ORM update hook.
        await transaction.execute(sql`UPDATE monthly_expense_reports SET additional_items = ${JSON.stringify(legacy.snapshot.additionalItems)}::jsonb WHERE id = ${legacy.id}`);
        const [parent] = await transaction.select({ additionalItems: monthlyExpenseReportsTable.additionalItems }).from(monthlyExpenseReportsTable).where(eq(monthlyExpenseReportsTable.id, legacy.id));
        const invoices = await transaction.select().from(invoicesTable).where(eq(invoicesTable.reportId, legacy.id)).orderBy(asc(invoicesTable.position));
        const reconstructed = invoiceReportFormSchema.parse({ reportMonth: legacy.report_month, additionalItems: parent.additionalItems, invoices: invoices.map(fromStoredInvoice) });
        assert.deepEqual(reconstructed, legacy.snapshot, "The normalized data differs from the legacy snapshot.");
        invoiceCount += invoices.length;
      }
      await transaction.execute(sql`ALTER TABLE monthly_expense_reports DROP COLUMN snapshot`);
      return { alreadyApplied: false, reports: legacyRows.length, invoices: invoiceCount };
    });
    console.log(JSON.stringify({ success: true, ...result }));
  } finally {
    await client.end();
  }
};

void migrate().catch(() => {
  console.error("Invoice normalization failed; the report backfill transaction was rolled back. Check schema compatibility and legacy data validation.");
  process.exitCode = 1;
});
