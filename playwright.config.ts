import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Three targets: dev server (default), local prod build (PW_MODE=prod),
// or a deployed URL (PLAYWRIGHT_BASE_URL, previews need the bypass secret).
const deployed = process.env.PLAYWRIGHT_BASE_URL;
const prod = process.env.PW_MODE === "prod";

// Against the dev server, read the same .env.development.local it uses (PIN_SECRET, ADMIN_PASSCODE).
loadEnvConfig(process.cwd(), !prod && !deployed);
const port = prod ? 3100 : 3000;
const baseURL = deployed ?? `http://localhost:${port}`;
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
	testDir: "./e2e",
	retries: process.env.CI ? 2 : 0,
	use: {
		baseURL,
		trace: "on-first-retry",
		extraHTTPHeaders:
			deployed && bypass
				? {
						"x-vercel-protection-bypass": bypass,
						"x-vercel-set-bypass-cookie": "true",
					}
				: undefined,
	},
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", use: { ...devices["Pixel 7"] } },
	],
	webServer: deployed
		? undefined
		: {
				command: prod
					? `bun run build && bun run start -p ${port}`
					: "bun run dev",
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 300_000,
			},
});
