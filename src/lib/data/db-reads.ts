import { and, desc, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { rowsToDataset } from "@/db/map";
import {
	ajustes,
	constancias,
	datasetMeta,
	engagement,
	juegos,
	juegosSucursal,
	kpiDefiniciones,
	kpiResultados,
	periodos,
	planes,
	premios,
	reclamos,
	sucursales,
	vendedores,
} from "@/db/schema";
import {
	AJUSTES_DEFAULT,
	type Ajustes,
	type Dataset,
	type EngagementRow,
	JUEGOS,
	type JuegosConfig,
	type MetricaDef,
	type Premio,
} from "@/lib/domain";

type DefRow = typeof kpiDefiniciones.$inferSelect;

const toMetrica = ({ kpi, ...r }: DefRow): MetricaDef => ({
	...r,
	id: kpi,
	direccion: r.direccion as MetricaDef["direccion"],
});

/** Every metric def (base, derivada, custom), active or not, by orden then id. */
export const readMetricas = cache(async (): Promise<MetricaDef[]> => {
	const rows = await db
		.select()
		.from(kpiDefiniciones)
		.orderBy(kpiDefiniciones.orden, kpiDefiniciones.kpi);
	return rows.map(toMetrica);
});

/** Per-request dedupe. Cross-request caching lives in queries.ts ("use cache"). */
export const readDataset = cache(async (): Promise<Dataset> => {
	const [s, v, p, defs, r] = await Promise.all([
		db.select().from(sucursales).orderBy(sucursales.slug),
		db.select().from(vendedores).orderBy(vendedores.id),
		db.select().from(periodos).orderBy(periodos.id),
		db
			.select()
			.from(kpiDefiniciones)
			.orderBy(kpiDefiniciones.orden, kpiDefiniciones.kpi),
		db
			.select()
			.from(kpiResultados)
			.orderBy(
				kpiResultados.periodoId,
				kpiResultados.vendedorId,
				kpiResultados.kpi,
			),
	]);
	return rowsToDataset({
		sucursales: s,
		vendedores: v,
		periodos: p,
		defs,
		resultados: r,
	});
});

export const readMeta = cache(async () => {
	const [row] = await db.select().from(datasetMeta).limit(1);
	return row ?? null;
});

/** Global switches (a game without a row is off) and every activation interval. */
export const readJuegosConfig = cache(async (): Promise<JuegosConfig> => {
	const [g, i] = await Promise.all([
		db.select().from(juegos),
		db
			.select()
			.from(juegosSucursal)
			.orderBy(
				juegosSucursal.juego,
				juegosSucursal.sucursal,
				juegosSucursal.desde,
			),
	]);
	const on = new Map(g.map((r) => [r.id, r.activo]));
	return {
		global: Object.fromEntries(
			JUEGOS.map((j) => [j, on.get(j) ?? false]),
		) as JuegosConfig["global"],
		intervalos: i,
	};
});

/** Stored settings over AJUSTES_DEFAULT; unknown keys are ignored. */
export const readAjustes = cache(async (): Promise<Ajustes> => {
	const rows = await db.select().from(ajustes);
	const out = { ...AJUSTES_DEFAULT };
	for (const r of rows)
		if (Object.hasOwn(AJUSTES_DEFAULT, r.clave))
			out[r.clave as keyof Ajustes] = r.valor;
	return out;
});

/**
 * Engagement summed in SQL by (month, seller, game, evento, fuente). fecha is the
 * month's first day, so the rows feed engagementResumen (monthly measures) directly.
 */
export const readEngagementMensual = cache(
	async (): Promise<EngagementRow[]> => {
		const mes = sql<string>`to_char(${engagement.fecha}, 'YYYY-MM-01')`;
		const rows = await db
			.select({
				fecha: mes,
				vendedorId: engagement.vendedorId,
				juego: engagement.juego,
				evento: engagement.evento,
				fuente: engagement.fuente,
				cantidad: sql<number>`sum(${engagement.cantidad})::int`,
			})
			.from(engagement)
			.groupBy(
				mes,
				engagement.vendedorId,
				engagement.juego,
				engagement.evento,
				engagement.fuente,
			)
			.orderBy(mes, engagement.vendedorId);
		return rows.map((r) => ({ ...r, cantidad: Number(r.cantidad) }));
	},
);

export const readPremios = cache(
	async (): Promise<Premio[]> =>
		db
			.select()
			.from(premios)
			.orderBy(premios.periodoId, premios.juego, premios.id),
);

/** Materialised Constancia: periodoId -> vendedorId -> valor. One period, or all of them. */
export const readConstanciasTabla = cache(
	async (
		periodoId?: string,
	): Promise<Record<string, Record<string, number | null>>> => {
		const rows = await db
			.select({
				vendedorId: constancias.vendedorId,
				periodoId: constancias.periodoId,
				valor: constancias.valor,
			})
			.from(constancias)
			.where(periodoId ? eq(constancias.periodoId, periodoId) : undefined);
		const out: Record<string, Record<string, number | null>> = {};
		for (const r of rows) {
			out[r.periodoId] ??= {};
			out[r.periodoId][r.vendedorId] = r.valor;
		}
		return out;
	},
);

/** One seller's stored Constancia for a period (null when absent or too few points). */
export async function readConstanciaDe(
	vendedorId: string,
	periodoId: string,
): Promise<number | null> {
	const [row] = await db
		.select({ valor: constancias.valor })
		.from(constancias)
		.where(
			and(
				eq(constancias.vendedorId, vendedorId),
				eq(constancias.periodoId, periodoId),
			),
		);
	return row?.valor ?? null;
}

/** One seller's full-month plan den per kpi for a period (venta: the OV). */
export async function readPlanes(
	vendedorId: string,
	periodoId: string,
): Promise<Record<string, number>> {
	const rows = await db
		.select({ kpi: planes.kpi, den: planes.den })
		.from(planes)
		.where(
			and(eq(planes.vendedorId, vendedorId), eq(planes.periodoId, periodoId)),
		);
	return Object.fromEntries(rows.map((r) => [r.kpi, r.den]));
}

export type ReclamoRow = typeof reclamos.$inferSelect;

/** One seller's claims, newest first. */
export const readReclamos = cache(
	async (vendedorId: string): Promise<ReclamoRow[]> =>
		db
			.select()
			.from(reclamos)
			.where(eq(reclamos.vendedorId, vendedorId))
			.orderBy(desc(reclamos.reclamadoAt)),
);
