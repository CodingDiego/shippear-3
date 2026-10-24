import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import {
	readAjustes,
	readConstanciasTabla,
	readDataset,
	readEngagementMensual,
	readJuegosConfig,
	readMetricas,
	readPremios,
	readReclamos,
} from "@/lib/data/db-reads";
import { refFigu } from "@/lib/data/writes";
import {
	type Ajustes,
	CONSTANCIA_ID,
	type Dataset,
	type FiguV2,
	JUEGOS,
	type JuegoId,
	type JuegosConfig,
	type MetricaDef,
	type Premio,
	type ScoredPeriod,
	type Vista,
} from "@/lib/domain";
import {
	type Celda,
	type EfectoVentas,
	type EngagementResumen,
	efectoVentas,
	engagementResumen,
	juegoActivo,
	type ValorPremios,
	valorPremios,
} from "@/lib/games";
import {
	album,
	type Figu,
	figusV2,
	type Liga,
	liga,
	type Revelacion,
	revelacion,
} from "@/lib/modes";
import { scorePeriodV2 } from "@/lib/scoring";

// Cross-request cache. Tags: "dataset" (scores, figus, modes; reseed, CSV import,
// cierre de mes), "config" (metricas, juegos, ajustes, premios; admin edits),
// "engagement" (events and claims). Cached functions never read cookies or hoy():
// the exported wrappers read those and pass plain values in.

export async function getDataset(): Promise<Dataset> {
	"use cache";
	cacheLife("hours");
	cacheTag("dataset", "config");
	return readDataset();
}

export async function getMetricas(): Promise<MetricaDef[]> {
	"use cache";
	cacheLife("hours");
	cacheTag("config");
	return readMetricas();
}

export async function getJuegosConfig(): Promise<JuegosConfig> {
	"use cache";
	cacheLife("hours");
	cacheTag("config");
	return readJuegosConfig();
}

export async function getAjustes(): Promise<Ajustes> {
	"use cache";
	cacheLife("hours");
	cacheTag("config");
	return readAjustes();
}

export async function getPremios(): Promise<Premio[]> {
	"use cache";
	cacheLife("hours");
	cacheTag("config");
	return readPremios();
}

export type SeasonMeta = {
	/** Closed period ids with at least one result, ascending. */
	periodos: string[];
	/** Latest closed period with data (the default view of rankings and games). */
	latest: string;
	/** The month in progress (DB periodos.en_curso), or null. */
	enCurso: string | null;
	vendedores: number;
	sucursales: number;
};

export async function getSeasonMeta(): Promise<SeasonMeta> {
	"use cache";
	cacheLife("hours");
	cacheTag("dataset");
	const d = await getDataset();
	const con = new Set(d.resultados.map((r) => r.periodoId));
	const periodos = d.periodos
		.filter((p) => !p.enCurso && con.has(p.id))
		.map((p) => p.id);
	return {
		periodos,
		latest: periodos.at(-1) ?? d.periodos[0]?.id ?? "",
		enCurso: d.periodos.find((p) => p.enCurso)?.id ?? null,
		vendedores: d.vendedores.length,
		sucursales: d.sucursales.length,
	};
}

/**
 * Constancia per vendedorId for one period, from the constancias table (computed when the
 * data was written: month end when closed, the last day with data when in progress).
 */
export async function getConstancias(
	periodoId: string,
): Promise<Record<string, number | null>> {
	"use cache";
	cacheLife("hours");
	cacheTag("dataset");
	return (await readConstanciasTabla(periodoId))[periodoId] ?? {};
}

const conConstancia = (defs: readonly MetricaDef[]) =>
	defs.some((m) => m.id === CONSTANCIA_ID && m.activa);

/** Scored with the live metric defs; includes the province ranks (nacional, provincia, sucursal). */
export async function getScoredPeriod(
	periodoId: string,
	vista: Vista,
): Promise<ScoredPeriod> {
	"use cache";
	cacheLife("hours");
	cacheTag("dataset", "config", `periodo:${periodoId}`);
	const [d, defs, constancia] = await Promise.all([
		getDataset(),
		getMetricas(),
		getConstancias(periodoId),
	]);
	return scorePeriodV2(d, periodoId, vista, {
		defs,
		constancia: conConstancia(defs) ? constancia : undefined,
	});
}

type Temporada = {
	season: ScoredPeriod[];
	liga: Liga;
	revelacion: Revelacion;
	album: Figu[];
	figus: FiguV2[];
};

/**
 * The season and every game mode in one cache entry: a cold fill reads the dataset once
 * and scores the closed months once, instead of once per mode (concurrent cold misses of
 * separate entries each regenerate, so / used to score the season three times).
 */
async function getTemporada(): Promise<Temporada> {
	"use cache";
	cacheLife("hours");
	cacheTag("dataset", "config");
	const [d, defs, juegos, constancias] = await Promise.all([
		getDataset(),
		getMetricas(),
		getJuegosConfig(),
		readConstanciasTabla(),
	]);
	const con = new Set(d.resultados.map((r) => r.periodoId));
	const season = d.periodos
		.filter((p) => !p.enCurso && con.has(p.id))
		.map((p) =>
			scorePeriodV2(d, p.id, "mes", {
				defs,
				constancia: conConstancia(defs) ? (constancias[p.id] ?? {}) : undefined,
			}),
		);
	return {
		season,
		liga: liga(season, d, juegos),
		revelacion: revelacion(season, d, juegos),
		album: album(season, d, juegos),
		figus: figusV2(season, d, defs, juegos),
	};
}

/** Per-request dedupe, so one render that reads several modes waits on a single fill. */
const temporada = cache(getTemporada);

/** Every closed period with data, vista mes, ascending. Input of the game modes. */
export async function getSeason(): Promise<ScoredPeriod[]> {
	return (await temporada()).season;
}

export async function getLiga(): Promise<Liga> {
	return (await temporada()).liga;
}

export async function getRevelacion(): Promise<Revelacion> {
	return (await temporada()).revelacion;
}

export async function getAlbum(): Promise<Figu[]> {
	return (await temporada()).album;
}

/** v2 album: figus earned by meeting goals, only where the album game is active. */
export async function getFigusV2(): Promise<FiguV2[]> {
	return (await temporada()).figus;
}

// ---------- claims (seller view) ----------

type ReclamableBase = { ref: string; periodoId: string };
export type Reclamable =
	| (ReclamableBase & { tipo: "figu"; juego: "album"; figu: FiguV2 })
	| (ReclamableBase & { tipo: "premio"; juego: JuegoId; premio: Premio });
export type Reclamables = {
	/** Not claimed yet, newest month first. */
	pendientes: Reclamable[];
	/** Already claimed, newest month first; reclamadoAt is ISO. */
	reclamados: (Reclamable & { reclamadoAt: string })[];
};

/**
 * What a seller can claim: their figus (closed months, album active) and the prizes of the
 * games active in their sucursal in the prize's (closed) month, split by claimed or not.
 * vendedorId comes from the session cookie; unknown ids get empty lists.
 */
export async function reclamables(vendedorId: string): Promise<Reclamables> {
	"use cache";
	cacheLife("hours");
	cacheTag("dataset", "config", "engagement");
	const [{ figus }, d, juegos, premios, hechos] = await Promise.all([
		getTemporada(),
		getDataset(),
		getJuegosConfig(),
		getPremios(),
		readReclamos(vendedorId),
	]);
	const v = d.vendedores.find((x) => x.id === vendedorId);
	if (!v) return { pendientes: [], reclamados: [] };
	const cerrados = new Set(
		d.periodos.filter((p) => !p.enCurso).map((p) => p.id),
	);
	const todos: Reclamable[] = [
		...figus
			.filter((f) => f.vendedorId === vendedorId)
			.map(
				(figu): Reclamable => ({
					tipo: "figu",
					ref: refFigu(figu.periodoId, figu.metrica),
					periodoId: figu.periodoId,
					juego: "album",
					figu,
				}),
			),
		...premios
			.filter(
				(p) =>
					cerrados.has(p.periodoId) &&
					p.periodoId >= v.altaPeriodo &&
					juegoActivo(juegos, p.juego, v.sucursal, p.periodoId),
			)
			.map(
				(premio): Reclamable => ({
					tipo: "premio",
					ref: premio.id,
					periodoId: premio.periodoId,
					juego: premio.juego,
					premio,
				}),
			),
	].sort((a, b) => b.periodoId.localeCompare(a.periodoId));
	const cuando = new Map(
		hechos.map((h) => [`${h.tipo}|${h.ref}`, h.reclamadoAt.toISOString()]),
	);
	return {
		pendientes: todos.filter((r) => !cuando.has(`${r.tipo}|${r.ref}`)),
		reclamados: todos.flatMap((r) => {
			const reclamadoAt = cuando.get(`${r.tipo}|${r.ref}`);
			return reclamadoAt ? [{ ...r, reclamadoAt }] : [];
		}),
	};
}

// ---------- seller tracker ----------

export { getTracker, trackerAt } from "@/lib/data/tracker";

// ---------- games measures (admin "Juegos") ----------

export type MedidasJuego = {
	juego: JuegoId;
	/** Current global switch. */
	activo: boolean;
	efecto: {
		/** y = mean card score / mean venta attainment of the sucursal's members. */
		sucursal: { score: EfectoVentas; venta: EfectoVentas };
		/** y = card score / venta attainment / kilos vendidos (β in kg per seller-month). */
		vendedor: { score: EfectoVentas; venta: EfectoVentas; kg: EfectoVentas };
	};
	/** Seller level, every sucursal. */
	engagement: EngagementResumen;
	/** Same measures restricted to one sucursal's sellers, by slug. */
	engagementSucursal: Record<string, EngagementResumen>;
	premios: ValorPremios;
};

const media = (xs: number[]) =>
	xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

export async function getJuegosMedidas(): Promise<MedidasJuego[]> {
	"use cache";
	cacheLife("hours");
	cacheTag("dataset", "config", "engagement");
	const [{ season }, d, config, eventos, premios, ajustes] = await Promise.all([
		getTemporada(),
		getDataset(),
		getJuegosConfig(),
		readEngagementMensual(),
		getPremios(),
		getAjustes(),
	]);
	// History comes from the intervals; the global switch is today's state, so it must
	// not turn every past treated cell into control.
	const historia: JuegosConfig = {
		...config,
		global: Object.fromEntries(JUEGOS.map((j) => [j, true])) as Record<
			JuegoId,
			boolean
		>,
	};
	const kilos = new Map(
		d.resultados
			.filter((r) => r.kpi === "venta")
			.map((r) => [`${r.vendedorId}|${r.periodoId}`, r.num]),
	);
	const sucursalDe = new Map(d.vendedores.map((v) => [v.id, v.sucursal]));

	return JUEGOS.map((juego) => {
		const on = (sucursal: string, p: string) =>
			juegoActivo(historia, juego, sucursal, p);
		const c = {
			vScore: [] as Celda[],
			vVenta: [] as Celda[],
			vKg: [] as Celda[],
			sScore: [] as Celda[],
			sVenta: [] as Celda[],
		};
		const elegibles: Record<string, string[]> = {};
		for (const p of season) {
			const id = p.periodoId;
			elegibles[id] = [];
			const ventaSuc = new Map<string, number[]>();
			for (const v of p.vendedores) {
				const suc = v.vendedor.sucursal;
				const activo = on(suc, id);
				if (activo) elegibles[id].push(v.vendedor.id);
				const unidad = v.vendedor.id;
				if (v.score !== null)
					c.vScore.push({ unidad, periodoId: id, y: v.score, activo });
				const att = v.kpis.venta?.attainment ?? null;
				if (att !== null) {
					c.vVenta.push({ unidad, periodoId: id, y: att, activo });
					ventaSuc.set(suc, [...(ventaSuc.get(suc) ?? []), att]);
				}
				const kg = kilos.get(`${unidad}|${id}`);
				if (kg !== undefined)
					c.vKg.push({ unidad, periodoId: id, y: kg, activo });
			}
			for (const s of p.sucursales) {
				const unidad = s.sucursal.slug;
				const activo = on(unidad, id);
				if (s.score !== null)
					c.sScore.push({ unidad, periodoId: id, y: s.score, activo });
				const y = media(ventaSuc.get(unidad) ?? []);
				if (y !== null) c.sVenta.push({ unidad, periodoId: id, y, activo });
			}
		}
		const filas = eventos.filter((e) => e.juego === juego);
		const kg = efectoVentas(c.vKg);
		const engagementSucursal = Object.fromEntries(
			d.sucursales.map((s) => {
				const de = (id: string) => sucursalDe.get(id) === s.slug;
				return [
					s.slug,
					engagementResumen(
						filas.filter((e) => de(e.vendedorId)),
						juego,
						Object.fromEntries(
							Object.entries(elegibles).map(([p, ids]) => [p, ids.filter(de)]),
						),
					),
				];
			}),
		);
		return {
			juego,
			activo: config.global[juego],
			efecto: {
				sucursal: {
					score: efectoVentas(c.sScore),
					venta: efectoVentas(c.sVenta),
				},
				vendedor: {
					score: efectoVentas(c.vScore),
					venta: efectoVentas(c.vVenta),
					kg,
				},
			},
			engagement: engagementResumen(filas, juego, elegibles),
			engagementSucursal,
			premios: valorPremios({
				juego,
				betaKg: kg.beta,
				vendedorMesesTratados: c.vKg.filter((x) => x.activo).length,
				premios,
				ajustes,
			}),
		};
	});
}
