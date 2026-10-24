import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// dev=true loads .env.local / .env.development*, never .env.production.
loadEnvConfig(process.cwd(), true);

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: (process.env.DATABASE_URL_UNPOOLED ??
			process.env.DATABASE_URL) as string,
	},
});
