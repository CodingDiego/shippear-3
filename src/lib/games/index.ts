// Game management and measurement (SPEC-V2 "Games" and "Measuring games"). Pure.
import {
	type Ajustes,
	type EngagementRow,
	type FuenteEngagement,
	JUEGOS,
	type JuegoId,
	type JuegosConfig,
	type Premio,
	periodoDe,
	type Sucursal,
} from "@/lib/domain";

/** Global switch on AND an interval of (juego, sucursal) covers periodoId (desde <= p <= hasta ?? ∞). */
export function juegoActivo(
	config: JuegosConfig,
	juego: JuegoId,
	sucursal: string,
	periodoId: string,
): boolean {
	return (
		config.global[juego] &&
		config.intervalos.some(
			(i) =>
				i.juego === juego &&
				i.sucursal === sucursal &&
				i.desde <= periodoId &&
				(i.hasta === null || periodoId <= i.hasta),
		)
	);
}

/** Every game on in every given sucursal, always: the v1 behaviour when no JuegosConfig is passed. */
export function juegosTodos(sucursales: readonly Sucursal[]): JuegosConfig {
	return {
		global: Object.fromEntries(JUEGOS.map((j) => [j, true])) as Record<
			JuegoId,
			boolean
		>,
		intervalos: JUEGOS.flatMap((juego) =>
			sucursales.map((s) => ({
				juego,
				sucursal: s.slug,
				desde: "0000-00",
				hasta: null,
			})),
		),
	};
}

/** One monthly cell of the TWFE panel. */
export type Celda = {
	/** Sucursal slug or vendedorId. */
	unidad: string;
	periodoId: string;
	/** Outcome: mean card score, venta attainment, or kilos vendidos per seller-month. */
	y: number;
	/** The game was active for this unit that month. */
	activo: boolean;
};

export type EfectoVentas = {
	/** Treatment coefficient; null when not identified (no treated or no control cells). */
	beta: number | null;
	/** Cells with activo = true. */
	tratadas: number;
	/** Cells with activo = false. */
	control: number;
	/** No control cells: the UI shows "sin grupo de control". */
	sinControl: boolean;
};

/** Subtracts each group's mean in place; returns the largest mean removed. */
function demean(x: number[], grupo: readonly string[]): number {
	const suma = new Map<string, [number, number]>();
	grupo.forEach((g, i) => {
		const s = suma.get(g) ?? [0, 0];
		s[0] += x[i];
		s[1]++;
		suma.set(g, s);
	});
	let max = 0;
	grupo.forEach((g, i) => {
		const [t, n] = suma.get(g) as [number, number];
		x[i] -= t / n;
		max = Math.max(max, Math.abs(t / n));
	});
	return max;
}

/**
 * Two-way fixed effects y = α_unit + γ_month + β·activo, β by alternating demeaning
 * (unit then month) until the change is under tol or maxIter passes.
 * Call once per outcome: y = score, y = venta attainment, y = kilos (β in kg per seller-month).
 */
export function efectoVentas(
	celdas: readonly Celda[],
	opts?: { maxIter?: number; tol?: number },
): EfectoVentas {
	const { maxIter = 200, tol = 1e-9 } = opts ?? {};
	const tratadas = celdas.filter((c) => c.activo).length;
	const control = celdas.length - tratadas;
	const base = { tratadas, control, sinControl: control === 0 };
	if (tratadas === 0 || control === 0) return { beta: null, ...base };

	// FWL: β = <ỹ, d̃> / <d̃, d̃>, with y and d both residualised on unit and month effects.
	const y = celdas.map((c) => c.y);
	const d = celdas.map((c) => (c.activo ? 1 : 0));
	const grupos = [celdas.map((c) => c.unidad), celdas.map((c) => c.periodoId)];
	for (let it = 0; it < maxIter; it++) {
		let cambio = 0;
		for (const g of grupos)
			cambio = Math.max(cambio, demean(y, g), demean(d, g));
		if (cambio < tol) break;
	}
	let yd = 0;
	let dd = 0;
	for (let i = 0; i < y.length; i++) {
		yd += y[i] * d[i];
		dd += d[i] * d[i];
	}
	// treatment absorbed by the fixed effects (e.g. every unit switches on the same month)
	return { beta: dd < 1e-12 ? null : yd / dd, ...base };
}

export type EngagementMes = {
	periodoId: string;
	/** Eligible sellers with at least one event that month. */
	activos: number;
	elegibles: number;
	/** activos / elegibles; null when elegibles = 0. */
	tasa: number | null;
	/** Σcantidad / activos; null when activos = 0. */
	eventosPorActivo: number | null;
	/** Share of last month's activos active again; null for the first month or 0 last month. */
	retencion: number | null;
	/** Active sellers and Σcantidad per fuente (a seller can count under both). */
	porFuente: Record<FuenteEngagement, { activos: number; eventos: number }>;
	/** Σcantidad of evento "reclamo" (figus and prizes claimed) per fuente. */
	reclamos: Record<FuenteEngagement, number>;
};

export type EngagementResumen = {
	juego: JuegoId;
	/** Some rows are fuente "simulado": the UI must label it. */
	simulado: boolean;
	/** Ascending by periodoId; one entry per key of elegibles. */
	meses: EngagementMes[];
	/** Σcantidad of evento "reclamo" over every row of the game, any month, per fuente. */
	reclamos: Record<FuenteEngagement, number>;
};

const FUENTES: readonly FuenteEngagement[] = ["real", "simulado"];
const sumar = (rs: readonly EngagementRow[]) =>
	rs.reduce((t, r) => t + r.cantidad, 0);
const reclamosDe = (rs: readonly EngagementRow[]) =>
	Object.fromEntries(
		FUENTES.map((f) => [
			f,
			sumar(rs.filter((r) => r.evento === "reclamo" && r.fuente === f)),
		]),
	) as Record<FuenteEngagement, number>;

/**
 * Engagement measures for one game. elegibles[periodoId] = vendedorIds whose sucursal
 * had the game active that month. Per sucursal or per seller: pre-filter rows and elegibles.
 * A row belongs to the month of its fecha (a simulated weekly row: the month of its Monday).
 * Retention compares with the previous key of elegibles.
 */
export function engagementResumen(
	rows: readonly EngagementRow[],
	juego: JuegoId,
	elegibles: Readonly<Record<string, readonly string[]>>,
): EngagementResumen {
	const propias = rows.filter((r) => r.juego === juego && r.cantidad > 0);
	let previos: Set<string> | null = null;
	const meses = Object.keys(elegibles)
		.sort()
		.map((periodoId): EngagementMes => {
			const elig = new Set(elegibles[periodoId]);
			const mes = propias.filter(
				(r) => periodoDe(r.fecha) === periodoId && elig.has(r.vendedorId),
			);
			const activos = new Set(mes.map((r) => r.vendedorId));
			const eventos = sumar(mes);
			const prev: Set<string> | null = previos;
			previos = activos;
			return {
				periodoId,
				activos: activos.size,
				elegibles: elig.size,
				tasa: elig.size ? activos.size / elig.size : null,
				eventosPorActivo: activos.size ? eventos / activos.size : null,
				retencion: prev?.size
					? [...prev].filter((id) => activos.has(id)).length / prev.size
					: null,
				porFuente: Object.fromEntries(
					FUENTES.map((f) => {
						const fs = mes.filter((r) => r.fuente === f);
						return [
							f,
							{
								activos: new Set(fs.map((r) => r.vendedorId)).size,
								eventos: sumar(fs),
							},
						];
					}),
				) as EngagementMes["porFuente"],
				reclamos: reclamosDe(mes),
			};
		});
	return {
		juego,
		simulado: propias.some((r) => r.fuente === "simulado"),
		meses,
		reclamos: reclamosDe(propias),
	};
}

export type ValorPremios = {
	juego: JuegoId;
	/** Σ costo_ars of the game's prizes. */
	costoArs: number;
	/** betaKg × vendedorMesesTratados × ajustes.valor_kg_ars; null when betaKg is null. */
	valorArs: number | null;
	/** valorArs / costoArs; null when either is null or costoArs = 0. */
	roi: number | null;
	/** Some prizes are simulado: the UI must label it. */
	simulado: boolean;
};

export function valorPremios(input: {
	juego: JuegoId;
	/** β from efectoVentas with y = kilos, seller level. */
	betaKg: number | null;
	/** Treated seller-month cells. */
	vendedorMesesTratados: number;
	/** Any prizes; only input.juego's are counted. */
	premios: readonly Premio[];
	ajustes: Ajustes;
}): ValorPremios {
	const propios = input.premios.filter((p) => p.juego === input.juego);
	const costoArs = propios.reduce((t, p) => t + p.costoArs, 0);
	const valorArs =
		input.betaKg === null
			? null
			: input.betaKg * input.vendedorMesesTratados * input.ajustes.valor_kg_ars;
	return {
		juego: input.juego,
		costoArs,
		valorArs,
		roi: valorArs === null || costoArs === 0 ? null : valorArs / costoArs,
		simulado: propios.some((p) => p.simulado),
	};
}
