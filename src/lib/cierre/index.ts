// Month close ("Simular cierre de mes"). Each step is a plain async function that is safe
// to rerun: the Workflow DevKit workflow wraps each one in a step and calls them in order
// generarDiasRestantes -> cerrarPeriodo -> recalcularConstancias, then updateTag("dataset").
import { and, between, count, eq, max, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
	constancias,
	engagement,
	kpiDefiniciones,
	kpiDiarios,
	kpiResultados,
	periodos,
	vendedores,
} from "@/db/schema";
import { type ReplaceCounts, replaceDataset } from "@/db/upsert";
import { desdeConstancia, readSerieVenta } from "@/lib/data/windows";
import { hoy, periodoDe } from "@/lib/domain";
import { constancia, serieRolling } from "@/lib/scoring";
import { generateV2 } from "@/lib/seed/generate";
import { sumarDias, ventanaMes } from "@/lib/time";
import {
	diasRestantes,
	type EstadoCierre,
	estadoDe,
	refConstancia,
} from "./calc";

export type { EstadoCierre } from "./calc";

const BATCH = 5000;

const delMes = (periodoId: string) =>
	between(kpiDiarios.fecha, `${periodoId}-01`, ventanaMes(periodoId).hasta);

async function ultimaDelMes(periodoId: string): Promise<string | null> {
	const [r] = await db
		.select({ f: max(kpiDiarios.fecha) })
		.from(kpiDiarios)
		.where(delMes(periodoId));
	return r?.f ?? null;
}

async function periodo(periodoId: string) {
	const [p] = await db
		.select()
		.from(periodos)
		.where(eq(periodos.id, periodoId));
	if (!p) throw new Error(`periodo desconocido: ${periodoId}`);
	return p;
}

/**
 * Inserts the generated daily rows (and simulated engagement weeks) of periodoId from the
 * last stored date on, for the sellers in the DB. Rows go in by date, one batch at a time,
 * and the last stored date is included again (on conflict do nothing), so a rerun after a
 * failure fills what is missing and a rerun after success inserts nothing.
 */
export async function generarDiasRestantes(
	seed: number,
	periodoId: string,
): Promise<{ diarios: number; engagement: number }> {
	await periodo(periodoId);
	const [ultima, vs] = await Promise.all([
		ultimaDelMes(periodoId),
		db.select({ id: vendedores.id }).from(vendedores),
	]);
	const ids = new Set(vs.map((v) => v.id));
	const g = generateV2(seed, ventanaMes(periodoId).hasta);
	// From the day before ultima, so a half-written last date is completed on a rerun.
	const filas = diasRestantes(
		g.diarios,
		periodoId,
		ultima === null ? null : sumarDias(ultima, -1),
	)
		.filter((r) => ids.has(r.vendedorId))
		.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
	let diarios = 0;
	for (let i = 0; i < filas.length; i += BATCH) {
		const r = await db
			.insert(kpiDiarios)
			.values(filas.slice(i, i + BATCH))
			.onConflictDoNothing()
			.returning({ f: kpiDiarios.fecha });
		diarios += r.length;
	}
	const semanas = g.engagement.filter(
		(e) =>
			e.fuente === "simulado" &&
			periodoDe(e.fecha) === periodoId &&
			(ultima === null || e.fecha > ultima) &&
			ids.has(e.vendedorId),
	);
	const eng = semanas.length
		? await db
				.insert(engagement)
				.values(semanas)
				.onConflictDoNothing()
				.returning({ f: engagement.fecha })
		: [];
	return { diarios, engagement: eng.length };
}

/**
 * Rebuilds kpi_resultados of periodoId from its daily rows (flujo: sum; stock: the last
 * day's snapshot) and marks the month closed, in one transaction. Monthly rows without
 * daily rows (a v1 CSV import) are kept.
 */
export async function cerrarPeriodo(
	periodoId: string,
): Promise<{ resultados: number }> {
	await periodo(periodoId);
	const desde = `${periodoId}-01`;
	const hasta = ventanaMes(periodoId).hasta;
	const stock = (
		await db
			.select({ kpi: kpiDefiniciones.kpi })
			.from(kpiDefiniciones)
			.where(eq(kpiDefiniciones.acumulacion, "stock"))
	).map((r) => r.kpi);
	const mes = delMes(periodoId);
	const pid = sql<string>`${periodoId}::text`;
	const [, flujo, snap] = await db.batch([
		db
			.delete(kpiResultados)
			.where(
				and(
					eq(kpiResultados.periodoId, periodoId),
					sql`exists (select 1 from ${kpiDiarios} d where d.vendedor_id = ${kpiResultados.vendedorId} and d.kpi = ${kpiResultados.kpi} and d.fecha between ${desde} and ${hasta})`,
				),
			),
		db
			.insert(kpiResultados)
			.select(
				db
					.select({
						vendedorId: kpiDiarios.vendedorId,
						periodoId: pid.as("periodo_id"),
						kpi: kpiDiarios.kpi,
						num: sql<number>`sum(${kpiDiarios.num})`.as("num"),
						den: sql<number>`sum(${kpiDiarios.den})`.as("den"),
					})
					.from(kpiDiarios)
					.where(
						stock.length ? and(mes, notInArray(kpiDiarios.kpi, stock)) : mes,
					)
					.groupBy(kpiDiarios.vendedorId, kpiDiarios.kpi),
			)
			.returning({ kpi: kpiResultados.kpi }),
		db
			.insert(kpiResultados)
			.select(
				db
					.selectDistinctOn([kpiDiarios.vendedorId, kpiDiarios.kpi], {
						vendedorId: kpiDiarios.vendedorId,
						periodoId: pid.as("periodo_id"),
						kpi: kpiDiarios.kpi,
						num: kpiDiarios.num,
						den: kpiDiarios.den,
					})
					.from(kpiDiarios)
					.where(
						and(
							mes,
							sql`${kpiDiarios.kpi} in (select ${kpiDefiniciones.kpi} from ${kpiDefiniciones} where ${kpiDefiniciones.acumulacion} = 'stock')`,
						),
					)
					.orderBy(
						kpiDiarios.vendedorId,
						kpiDiarios.kpi,
						sql`${kpiDiarios.fecha} desc`,
					),
			)
			.returning({ kpi: kpiResultados.kpi }),
		db
			.update(periodos)
			.set({ enCurso: false })
			.where(eq(periodos.id, periodoId)),
	]);
	return { resultados: flujo.length + snap.length };
}

/**
 * Recomputes Constancia of periodoId for every seller (closed: at the month's last day; in
 * progress: at the last day with data) and upserts it.
 */
export async function recalcularConstancias(
	periodoId: string,
): Promise<{ constancias: number; fecha: string | null }> {
	const [p, ultima, vs] = await Promise.all([
		periodo(periodoId),
		ultimaDelMes(periodoId),
		db.select({ id: vendedores.id }).from(vendedores),
	]);
	const ref = refConstancia(p, ultima);
	const series = ref
		? await readSerieVenta(desdeConstancia(ref), ref)
		: new Map<string, never[]>();
	const filas = vs.map((v) => ({
		vendedorId: v.id,
		periodoId,
		fecha: ref,
		valor: ref ? constancia(serieRolling(series.get(v.id) ?? [], ref)) : null,
	}));
	if (filas.length)
		await db
			.insert(constancias)
			.values(filas)
			.onConflictDoUpdate({
				target: [constancias.vendedorId, constancias.periodoId],
				set: { fecha: sql`excluded.fecha`, valor: sql`excluded.valor` },
			});
	return { constancias: filas.length, fecha: ref };
}

/** Which close steps are done for periodoId. */
export async function estadoCierre(periodoId: string): Promise<EstadoCierre> {
	const fin = ventanaMes(periodoId).hasta;
	const [p, ultima, [c]] = await Promise.all([
		periodo(periodoId),
		ultimaDelMes(periodoId),
		db
			.select({
				n: count(),
				alCierre: sql<number>`count(*) filter (where ${constancias.fecha} = ${fin})::int`,
			})
			.from(constancias)
			.where(eq(constancias.periodoId, periodoId)),
	]);
	return estadoDe({
		periodoId,
		enCurso: p.enCurso,
		ultimaFecha: ultima,
		constanciasAlCierre: c.n > 0 && Number(c.alCierre) === c.n,
	});
}

/** Resets the demo: a full reseed through hoy() (month in progress open again, claims gone). */
export function reabrirDemo(seed: number): Promise<ReplaceCounts> {
	return replaceDataset(generateV2(seed, hoy()), {
		seed,
		source: "generator",
	});
}
