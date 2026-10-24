import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const base = {
	DATABASE_URL: "postgresql://u:p@localhost/db",
	AUTH_SECRET: "x".repeat(32),
};

async function loadEnv(vars: Record<string, string | undefined>) {
	for (const [k, v] of Object.entries({ ...base, ...vars })) vi.stubEnv(k, v);
	vi.resetModules();
	return (await import("./env")).env;
}

describe("env", () => {
	beforeEach(() => {
		for (const k of [
			"APP_ENV",
			"APP_URL",
			"VERCEL_ENV",
			"VERCEL_URL",
			"VERCEL_PROJECT_PRODUCTION_URL",
		])
			vi.stubEnv(k, undefined);
	});
	afterEach(() => vi.unstubAllEnvs());

	it("defaults to development on localhost outside Vercel", async () => {
		const env = await loadEnv({});
		expect(env.APP_ENV).toBe("development");
		expect(env.APP_URL).toBe("http://localhost:3000");
	});

	it("uses the deployment URL on a preview", async () => {
		const env = await loadEnv({
			VERCEL_ENV: "preview",
			VERCEL_URL: "shippear-3-abc.vercel.app",
		});
		expect(env.APP_ENV).toBe("preview");
		expect(env.APP_URL).toBe("https://shippear-3-abc.vercel.app");
	});

	it("uses the production domain in production", async () => {
		const env = await loadEnv({
			VERCEL_ENV: "production",
			VERCEL_URL: "shippear-3-xyz.vercel.app",
			VERCEL_PROJECT_PRODUCTION_URL: "shippear-3.vercel.app",
		});
		expect(env.APP_URL).toBe("https://shippear-3.vercel.app");
	});

	it("fails loudly without a database URL", async () => {
		await expect(loadEnv({ DATABASE_URL: undefined })).rejects.toThrow();
	});
});
