import { z } from "zod";

const { VERCEL_ENV, VERCEL_URL, VERCEL_PROJECT_PRODUCTION_URL } = process.env;

// On Vercel, env and URL come from system vars so every deployment (incl. each preview) is self-consistent.
const vercelUrl =
	VERCEL_ENV === "production" ? VERCEL_PROJECT_PRODUCTION_URL : VERCEL_URL;

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
		// Seller PINs derive from this so demo PINs can be handed out without exposing AUTH_SECRET.
		PIN_SECRET: z.string().min(16).optional(),
		BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
	})
	.parse({
		...process.env,
		APP_ENV: process.env.APP_ENV ?? VERCEL_ENV ?? "development",
		APP_URL:
			process.env.APP_URL ??
			(vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000"),
	});
