import { z } from "zod";

// Server-only env, validated once at import so a missing key fails loudly.
export const env = z
	.object({
		APP_ENV: z.enum(["development", "preview", "production"]),
		DATABASE_URL: z.url(),
		// Direct (non-pooled) connection, only needed for DDL via drizzle-kit.
		DATABASE_URL_UNPOOLED: z.url().optional(),
		AUTH_SECRET: z.string().min(32),
		APP_URL: z.url(),
		ADMIN_PASSCODE: z.string().min(8).optional(),
		BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
		AI_GATEWAY_API_KEY: z.string().min(1).optional(),
	})
	.parse(process.env);
