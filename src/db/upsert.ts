import { sql } from "drizzle-orm";
import { constanciasDe } from "@/lib/cierre/calc";
import { type Dataset, type GeneratedV2, JUEGO_LABEL } from "@/lib/domain";
import { db } from "./client";
import {
	ajustes,
	constancias,
	datasetMeta,
	engagement,
	juegos,
	juegosSucursal,
	kpiDefiniciones,
	kpiDiarios,
	kpiResultados,
	periodos,
	planes,
	premios,
	sucursales,
	vendedores,
} from "./schema";

// ~5k rows per statement keeps every insert under Postgres' 65,535 bind parameters
// (6 columns max) and the seed to a few dozen HTTP round trips.
const BATCH = 5000;
const PARALLEL = 4;

async function insertBatched<T>(
	rows: readonly T[],
	run: (chunk: T[]) => Promise<unknown>,
) {
	const chunks: T[][] = [];
	for (let i = 0; i < rows.length; i += BATCH)
		chunks.push(rows.slice(i, i + BATCH));
	for (let i = 0; i < chunks.length; i += PARALLEL)
		await Promise.all(chunks.slice(i, i + PARALLEL).map(run));
}

/** A v1 Dataset, or a v2 generation; v2 parts that are absent are left as they are. */
export type ReplaceInput =
	| Dataset
	| ({ dataset: Dataset } & Partial<Omit<GeneratedV2, "dataset">>);

export type ReplaceCounts = Record<
	| "sucursales"
	| "vendedores"
	| "periodos"
	| "kpi_definiciones"
	| "kpi_resultados"
	| "kpi_diarios"
	| "planes"
	| "constancias"
	| "juegos"
	| "juegos_sucursal"
	| "engagement"
	| "premios"
	| "ajustes",
	number
>;

/**
 * Replaces the dataset. Deleting vendedores cascades to kpi_diarios, engagement, planes,
 * constancias and reclamos, so a v1 Dataset (CSV import) clears daily rows unless
 * `diarios` comes with it. Constancia is computed here from the daily rows, for every
 * seller x period, so every writer (seed, CSV import) materialises it.
 * neon-http has no transactions: a failure mid-way leaves a partial dataset; rerun to repair.
 */
export async function replaceDataset(
	input: ReplaceInput,
	meta: { seed?: number; source: "generator" | "csv" },
): Promise<ReplaceCounts> {
	const g = "dataset" in input ? input : { dataset: input };
	const d = g.dataset;

	await db.delete(kpiDiarios);
	await db.delete(engagement);
	await db.delete(kpiResultados);
	await db.delete(vendedores);

	await insertBatched(d.sucursales, (c) =>
		db
			.insert(sucursales)
			.values(c.map((s) => ({ ...s, provincia: s.provincia ?? "" })))
			.onConflictDoUpdate({
				target: sucursales.slug,
				set: {
					nombre: sql`excluded.nombre`,
					region: sql`excluded.region`,
					vecina: sql`excluded.vecina`,
					provincia: sql`excluded.provincia`,
				},
			}),
	);
	await insertBatched(d.periodos, (c) =>
		db
			.insert(periodos)
			.values(c.map((p) => ({ ...p, enCurso: p.enCurso ?? false })))
			.onConflictDoUpdate({
				target: periodos.id,
				set: {
					label: sql`excluded.label`,
					pesoMes: sql`excluded.peso_mes`,
					enCurso: sql`excluded.en_curso`,
				},
			}),
	);

	// v2 metricas replace every definition (custom ones included); v1 upserts the seven.
	const defs = d.metricas
		? d.metricas.map(({ id, ...rest }) => ({ kpi: id, ...rest }))
		: Object.values(d.defs).map(({ id, ...rest }) => ({ kpi: id, ...rest }));
	if (d.metricas) {
		await db.delete(kpiDefiniciones);
		await db.insert(kpiDefiniciones).values(defs);
	} else
		for (const { kpi, ...rest } of defs)
			await db
				.insert(kpiDefiniciones)
				.values({ kpi, ...rest })
				.onConflictDoUpdate({ target: kpiDefiniciones.kpi, set: rest });

	await insertBatched(d.vendedores, (c) => db.insert(vendedores).values(c));
	await insertBatched(d.resultados, (c) => db.insert(kpiResultados).values(c));
	const diarios = g.diarios ?? [];
	await insertBatched(diarios, (c) => db.insert(kpiDiarios).values(c));
	await insertBatched(g.planes ?? [], (c) => db.insert(planes).values(c));
	const filasConstancia = constanciasDe(
		d.vendedores.map((v) => v.id),
		diarios,
		d.periodos,
	);
	await insertBatched(filasConstancia, (c) => db.insert(constancias).values(c));

	let nJuegos = 0;
	if (g.juegos) {
		const { global, intervalos } = g.juegos;
		await db.delete(juegos); // cascades to juegos_sucursal
		const filas = (Object.keys(global) as (keyof typeof global)[])
			.filter((id) => global[id] || intervalos.some((i) => i.juego === id))
			.map((id) => ({ id, nombre: JUEGO_LABEL[id], activo: global[id] }));
		if (filas.length) await db.insert(juegos).values(filas);
		nJuegos = filas.length;
		await insertBatched(intervalos, (c) => db.insert(juegosSucursal).values(c));
	}
	await insertBatched(g.engagement ?? [], (c) =>
		db.insert(engagement).values(c),
	);
	if (g.premios) {
		await db.delete(premios);
		await insertBatched(g.premios, (c) => db.insert(premios).values(c));
	}
	if (g.ajustes) {
		const filas = Object.entries(g.ajustes).map(([clave, valor]) => ({
			clave,
			valor,
		}));
		await db
			.insert(ajustes)
			.values(filas)
			.onConflictDoUpdate({
				target: ajustes.clave,
				set: { valor: sql`excluded.valor` },
			});
	}

	const row = { id: "singleton", seed: meta.seed ?? null, source: meta.source };
	await db
		.insert(datasetMeta)
		.values(row)
		.onConflictDoUpdate({
			target: datasetMeta.id,
			set: { seed: row.seed, source: row.source, updatedAt: new Date() },
		});

	return {
		sucursales: d.sucursales.length,
		vendedores: d.vendedores.length,
		periodos: d.periodos.length,
		kpi_definiciones: defs.length,
		kpi_resultados: d.resultados.length,
		kpi_diarios: diarios.length,
		planes: g.planes?.length ?? 0,
		constancias: filasConstancia.length,
		juegos: nJuegos,
		juegos_sucursal: g.juegos?.intervalos.length ?? 0,
		engagement: g.engagement?.length ?? 0,
		premios: g.premios?.length ?? 0,
		ajustes: g.ajustes ? Object.keys(g.ajustes).length : 0,
	};
}
