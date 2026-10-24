import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
	framework: "nextjs",
	installCommand: "bun install",
	buildCommand: "bun run build",
	bunVersion: "1.x",
	// São Paulo, the only South America region
	regions: ["gru1"],
};
