import { loadEnvConfig } from "@next/env";

// Env must load before the db client module is evaluated, hence the dynamic imports.
loadEnvConfig(process.cwd(), true);

async function main() {
	const seed = Number(process.argv[2] ?? 42);
	const { hoy } = await import("../src/lib/domain");
	const { generateV2 } = await import("../src/lib/seed/generate");
	const { replaceDataset } = await import("../src/db/upsert");
	const { readDataset } = await import("../src/lib/data/db-reads");

	const t = performance.now();
	const counts = await replaceDataset(generateV2(seed, hoy()), {
		seed,
		source: "generator",
	});
	const s = ((performance.now() - t) / 1000).toFixed(1);
	console.log(`seed ${seed} through ${hoy()}, written in ${s}s:`);
	for (const [table, n] of Object.entries(counts))
		console.log(`  ${table}: ${n}`);

	const back = await readDataset();
	console.log(
		`read back: ${back.vendedores.length} vendedores, ${back.resultados.length} resultados, ${back.metricas?.length ?? 0} metricas`,
	);
}

main().then(
	() => process.exit(0),
	(err) => {
		// drizzle wraps the driver error; the query text alone hides why it failed.
		const e = err instanceof Error ? err : new Error(String(err));
		console.error(e.message.slice(0, 300));
		if (e.cause) console.error("cause:", e.cause);
		process.exit(1);
	},
);
