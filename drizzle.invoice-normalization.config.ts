import { defineConfig, type Config } from "drizzle-kit";
import baseConfig from "./drizzle.config";

// Create the child table before the backfill script removes the legacy snapshot.
const invoiceNormalizationConfig: Config & { strict: boolean } = {
  ...baseConfig,
  tablesFilter: ["invoices"],
  strict: true,
  verbose: true,
};

export default defineConfig(invoiceNormalizationConfig);
