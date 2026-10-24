// SQL-backed readers over kpi_diarios (SPEC-V2 "Data and caching"). Window
// aggregates are computed in SQL; only the venta series is loaded row by row.
// Plain async functions: queries.ts wraps them in "use cache" with plain arguments.
import { and, between, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { kpiDiarios } from "@/db/schema";
import { type MetricaDef, type MetricaId, periodoDe } from "@/lib/domain";
import type { AgregadoMetrica } from "@/lib/goals";
import { constancia, type FilaDiaria, serieRolling } from "@/lib/scoring";
import { habilesEntre, sumarDias, type VentanaMeta } from "@/lib/time";

/** Working days the tracker's pace looks back over (SPEC-V2 "Venta plan and pace projection"). */
export const DIAS_RITMO = 14;

/** Last day with data inside the window: min(ref, hasta). */
// biome-ignore lint/complexity/useMathMinMax: ISO date strings, not numbers
const finDe = (v: VentanaMeta) => (v.ref < v.hasta ? v.ref : v.hasta);

/**
 * One seller's aggregates for the elapsed part of a window (ventana.desde..ventana.ref),
 * for every active stored metric in defs: flujo = SUM(num), SUM(den); stock = the row with
 * the latest fecha <= ref in ref's month. Flujo metrics also get ritmo (readRitmoVentana)
 * and, on the monthly window, denPlan from table planes (null when no plan is stored).
 */
export async function readAgregadosVentana(
	vendedorId: string,
	ventana: VentanaMeta,
	defs: readonly MetricaDef[],
): Promise<Record<MetricaId, AgregadoMetrica>> {
	const activas = defs.filter((d) => d.activa);
	const flujo = activas
		.filter((d) => d.acumulacion === "flujo")
		.map((d) => d.id);
	const stock = activas
		.filter((d) => d.acumulacion === "stock")
		.map((d) => d.id);
	const fin = finDe(ventana);
	if (fin < ventana.desde) return {};
	const deVendedor = eq(kpiDiarios.vendedorId, vendedorId);
	const [f, s, ritmo, plan] = await Promise.all([
		flujo.length === 0
			? []
			: db
					.select({
						kpi: kpiDiarios.kpi,
						num: sql<number>`sum(${kpiDiarios.num})::float8`,
						den: sql<number>`sum(${kpiDiarios.den})::float8`,
					})
					.from(kpiDiarios)
					.where(
						and(
							deVendedor,
							inArray(kpiDiarios.kpi, flujo),
							between(kpiDiarios.fecha, ventana.desde, fin),
						),
					)
					.groupBy(kpiDiarios.kpi),
		stock.length === 0
			? []
			: db
					.selectDistinctOn([kpiDiarios.kpi], {
						kpi: kpiDiarios.kpi,
						num: kpiDiarios.num,
						den: kpiDiarios.den,
					})
					.from(kpiDiarios)
					.where(
						and(
							deVendedor,
							inArray(kpiDiarios.kpi, stock),
							between(kpiDiarios.fecha, `${periodoDe(fin)}-01`, fin),
						),
					)
					.orderBy(kpiDiarios.kpi, sql`${kpiDiarios.fecha} desc`),
		readRitmoVentana(vendedorId, ventana, defs),
		// Plans are monthly; the week scales den by elapsed share.
		readPlanes(
			vendedorId,
			periodoDe(ventana.desde),
			ventana.ventana === "mes" ? flujo : [],
		),
	]);
	return Object.fromEntries([
		...f.map((r) => [
			r.kpi,
			{
				num: Number(r.num),
				den: Number(r.den),
				denPlan: plan[r.kpi] ?? null,
				// No rows in the recent span means no recent pace.
				ritmo: ritmo[r.kpi] ?? 0,
			},
		]),
		...s.map((r) => [
			r.kpi,
			{ num: Number(r.num), den: Number(r.den), denPlan: null },
		]),
	]);
}

/**
 * Average daily num per active flujo metric over the last min(DIAS_RITMO, elapsed) working
 * days of the window (desde..min(ref, hasta)), for one seller. Working days without rows
 * count as 0. Metrics without rows in that span are absent.
 */
export async function readRitmoVentana(
	vendedorId: string,
	ventana: VentanaMeta,
	defs: readonly MetricaDef[],
): Promise<Record<MetricaId, number>> {
	const flujo = defs
		.filter((d) => d.activa && d.acumulacion === "flujo")
		.map((d) => d.id);
	const fin = finDe(ventana);
	const dias = habilesEntre({ desde: ventana.desde, hasta: fin }).slice(
		-DIAS_RITMO,
	);
	if (flujo.length === 0 || dias.length === 0) return {};
	const rows = await db
		.select({
			kpi: kpiDiarios.kpi,
			num: sql<number>`sum(${kpiDiarios.num})::float8`,
		})
		.from(kpiDiarios)
		.where(
			and(
				eq(kpiDiarios.vendedorId, vendedorId),
				inArray(kpiDiarios.kpi, flujo),
				between(kpiDiarios.fecha, dias[0], fin),
			),
		)
		.groupBy(kpiDiarios.kpi);
	return Object.fromEntries(
		rows.map((r) => [r.kpi, Number(r.num) / dias.length]),
	);
}

/** Full-month plan den by kpi (table planes) for one seller and month; kpis without a plan are absent. */
async function readPlanes(
	vendedorId: string,
	periodoId: string,
	kpis: readonly MetricaId[],
): Promise<Record<MetricaId, number>> {
	if (kpis.length === 0) return {};
	// shortcut: raw SQL, and a missing table reads as "no plan", because planes is not in
	// src/db/schema.ts or the DB yet; switch to the table and drop the catch once it is pushed.
	try {
		const { rows } = await db.execute<{ kpi: string; den: number }>(
			sql`select kpi, den::float8 as den from planes where vendedor_id = ${vendedorId} and periodo_id = ${periodoId} and kpi in ${kpis}`,
		);
		return Object.fromEntries(rows.map((r) => [r.kpi, Number(r.den)]));
	} catch (e) {
		if ((e as { cause?: { code?: string } }).cause?.code === "42P01") return {};
		throw e;
	}
}

const ventaEntre = (desde: string, hasta: string) =>
	and(eq(kpiDiarios.kpi, "venta"), between(kpiDiarios.fecha, desde, hasta));

/** Every seller's venta daily rows in desde..hasta, by vendedorId, ascending fecha. */
export async function readSerieVenta(
	desde: string,
	hasta: string,
): Promise<Map<string, FilaDiaria[]>> {
	const rows = await db
		.select({
			vendedorId: kpiDiarios.vendedorId,
			fecha: kpiDiarios.fecha,
			num: kpiDiarios.num,
			den: kpiDiarios.den,
		})
		.from(kpiDiarios)
		.where(ventaEntre(desde, hasta))
		.orderBy(kpiDiarios.vendedorId, kpiDiarios.fecha);
	const out = new Map<string, FilaDiaria[]>();
	for (const r of rows) {
		const fila = { fecha: r.fecha, num: Number(r.num), den: Number(r.den) };
		const xs = out.get(r.vendedorId);
		if (xs) xs.push(fila);
		else out.set(r.vendedorId, [fila]);
	}
	return out;
}

/** One seller's venta daily rows in desde..hasta, ascending fecha. */
export async function readSerieVentaDe(
	vendedorId: string,
	desde: string,
	hasta: string,
): Promise<FilaDiaria[]> {
	const rows = await db
		.select({
			fecha: kpiDiarios.fecha,
			num: kpiDiarios.num,
			den: kpiDiarios.den,
		})
		.from(kpiDiarios)
		.where(and(eq(kpiDiarios.vendedorId, vendedorId), ventaEntre(desde, hasta)))
		.orderBy(kpiDiarios.fecha);
	return rows.map((r) => ({
		fecha: r.fecha,
		num: Number(r.num),
		den: Number(r.den),
	}));
}

/** First day read for Constancia at ref: 90 window ends, each 30 days long. */
export const desdeConstancia = (ref: string) => sumarDias(ref, -118);

/** Constancia valor per vendedorId at ref (reads ref-118..ref, then serieRolling + constancia). */
export async function readConstancias(
	ref: string,
): Promise<Record<string, number | null>> {
	const series = await readSerieVenta(desdeConstancia(ref), ref);
	return Object.fromEntries(
		[...series].map(([id, filas]) => [
			id,
			constancia(serieRolling(filas, ref)),
		]),
	);
}

/** Latest fecha in kpi_diarios; null when the table is empty. */
export async function readUltimaFecha(): Promise<string | null> {
	const [row] = await db.select({ f: max(kpiDiarios.fecha) }).from(kpiDiarios);
	return row?.f ?? null;
}
