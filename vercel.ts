import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
	framework: "nextjs",
	// Vercel's image ships bun 1.3.x, which can't read our bun 1.4 lockfile (v2) and silently ignores it.
	// These must stay string literals: vercel.ts rejects computed static properties.
	installCommand: "npx --yes bun@1.4.3 install --frozen-lockfile",
	buildCommand: "npx --yes bun@1.4.3 run build",
	bunVersion: "1.x",
	// São Paulo, the only South America region
	regions: ["gru1"],
};
