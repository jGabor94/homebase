import { defineConfig, type Config } from "drizzle-kit";
import baseConfig from "./drizzle.config";

const reportStorageConfig: Config & { strict: boolean } = {
  ...baseConfig,
  tablesFilter: ["monthly_expense_reports", "invoices"],
  strict: true,
  verbose: true,
};

export default defineConfig(reportStorageConfig);
