import type { VercelConfig } from "@vercel/config/v1";

// Vercel's image ships bun 1.3.x, which can't read our bun 1.4 lockfile (v2) and silently ignores it.
const bun = "npx --yes bun@1.4.3";

export const config: VercelConfig = {
	framework: "nextjs",
	installCommand: `${bun} install --frozen-lockfile`,
	buildCommand: `${bun} run build`,
	bunVersion: "1.x",
	// São Paulo, the only South America region
	regions: ["gru1"],
};
