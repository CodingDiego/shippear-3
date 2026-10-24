import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
	framework: "nextjs",
	// Vercel's image ships bun 1.3.x, which can't read our bun 1.4 lockfile (v2) and silently ignores it,
	// so install the pinned bun with the official installer. Must stay string literals (vercel.ts rule).
	installCommand:
		'curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.3" && "$HOME/.bun/bin/bun" install --frozen-lockfile',
	buildCommand: '"$HOME/.bun/bin/bun" run build',
	bunVersion: "1.x",
	// São Paulo, the only South America region
	regions: ["gru1"],
};
