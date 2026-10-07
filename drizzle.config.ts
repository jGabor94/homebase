import { config } from "dotenv";
import 'dotenv/config';
import { Config, defineConfig } from 'drizzle-kit';
import { register } from "tsconfig-paths";
import tsConfig from "./tsconfig.json";

const baseUrl = "."

register({
    baseUrl,
    paths: tsConfig.compilerOptions.paths
})
config({ path: ".env" })

const drizzleConfig: Config & { strict: boolean } = {
    out: './src/drizzle/migrations',
    schema: './src/drizzle/schema.ts',
    dialect: 'postgresql',
    strict: true,
    verbose: true,
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
}

export default defineConfig(drizzleConfig)
