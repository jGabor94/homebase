import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import postgres from "postgres";

const addConsumptionColumns = async () => {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

  try {
    await client.begin(async (transaction) => {
      await transaction`ALTER TABLE public.invoices
        ADD COLUMN IF NOT EXISTS consumption_quantity double precision,
        ADD COLUMN IF NOT EXISTS consumption_unit varchar(10)`;
      const columns = await transaction`
        SELECT column_name, data_type, is_nullable, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'invoices'
          AND column_name IN ('consumption_quantity', 'consumption_unit')`;
      assert.ok(columns.some((column) => column.column_name === "consumption_quantity" && column.data_type === "double precision" && column.is_nullable === "YES"), "The consumption quantity column has an incompatible definition.");
      assert.ok(columns.some((column) => column.column_name === "consumption_unit" && column.data_type === "character varying" && column.character_maximum_length === 10 && column.is_nullable === "YES"), "The consumption unit column has an incompatible definition.");
      await transaction`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.invoices'::regclass AND conname = 'invoices_consumption_quantity_check') THEN
          ALTER TABLE public.invoices ADD CONSTRAINT invoices_consumption_quantity_check
            CHECK (consumption_quantity IS NULL OR (consumption_quantity >= 0 AND consumption_quantity <= 1000000000000));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.invoices'::regclass AND conname = 'invoices_consumption_unit_check') THEN
          ALTER TABLE public.invoices ADD CONSTRAINT invoices_consumption_unit_check
            CHECK (consumption_unit IS NULL OR consumption_unit IN ('m3', 'kWh', 'MJ', 'kg', 'l', 'piece'));
        END IF;
      END $$`;
    });
    console.log("Consumption columns and constraints are ready; existing invoices were preserved.");
  } finally {
    await client.end();
  }
};

addConsumptionColumns().catch(() => {
  console.error("Consumption schema update failed. The transaction was rolled back.");
  process.exitCode = 1;
});
