// Times the cold cached reads behind /, /liga, /revelacion, /album, /ranking and admin
// "Juegos" against the local env database (DEVELOPMENT). Read only.
// Run: bun scripts/perf-v2.ts
// Outside Next, "use cache" is a no-op and React cache() does not dedupe, so every call
// here is a full cold fill including its nested cached reads: the worst case of a cold
// server where concurrent misses each regenerate.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true);

// next/cache throws outside a cacheComponents server; the tags and lifetimes do not matter here.
// (No @types/bun in the project, hence the local type.)
type BunPlugin = {
	plugin(p: {
		name: string;
		setup(build: {
			module(id: string, f: () => { exports: object; loader: "object" }): void;
		}): void;
	}): void;
};
(globalThis as unknown as { Bun: BunPlugin }).Bun.plugin({
	name: "next-cache-stub",
	setup(build) {
		build.module("next/cache", () => ({
			exports: {
				cacheLife() {},
				cacheTag() {},
				updateTag() {},
				revalidateTag() {},
			},
			loader: "object",
		}));
	},
});

async function main() {
	const q = await import("../src/lib/data/queries");
	const t = async (name: string, f: () => Promise<unknown>) => {
		const t0 = performance.now();
		await f();
		const s = (performance.now() - t0) / 1000;
		console.log(`  ${name.padEnd(28)} ${s.toFixed(2)} s`);
		return s;
	};
	// The first query pays TLS and DNS; keep that out of the first timing.
	const { db } = await import("../src/db/client");
	const { sql } = await import("drizzle-orm");
	await db.execute(sql`select 1`);
	console.log("cold, one at a time:");
	await t("getDataset", q.getDataset);
	await t("getScoredPeriod(latest)", async () => {
		const m = await q.getSeasonMeta();
		await q.getScoredPeriod(m.latest, "mes");
	});
	await t("getSeason", q.getSeason);
	await t("getLiga", q.getLiga);
	await t("getRevelacion", q.getRevelacion);
	await t("getAlbum", q.getAlbum);
	await t("getJuegosMedidas", q.getJuegosMedidas);
	await t("reclamables(V001)", () => q.reclamables("V001"));
	console.log("cold, like / (liga + revelacion + album at once):");
	await t("home", () =>
		Promise.all([q.getLiga(), q.getRevelacion(), q.getAlbum()]),
	);
}

main().then(
	() => process.exit(0),
	(err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	},
);
