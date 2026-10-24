// Test helper: hand-built ScoredPeriods from a compact table. Not used by app code.
import {
	type Canal,
	type Dataset,
	KPI_DEFS,
	KPI_IDS,
	type KpiId,
	type KpiScore,
	PERIODOS,
	type ScoredPeriod,
	type ScoredVendedor,
	SUCURSALES,
	tierOf,
	type Vendedor,
} from "@/lib/domain";

export type Fila = {
	id: string;
	sucursal?: string;
	canal?: Canal;
	score: number | null;
	/** One number for all seven KPIs, or per KPI. Missing KPIs default to score. */
	puntos?: number | null | Partial<Record<KpiId, number | null>>;
	/** General puesto override; default ranks by score desc, then id. */
	puesto?: number | null;
};

/** "YYYY-MM" of the i-th month from 2025-10 (goes past the 12-month season if asked). */
export function mesId(i: number): string {
	const m = 9 + i;
	return `${2025 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
}

function rank<T>(
	items: T[],
	value: (t: T) => number | null,
	id: (t: T) => string,
) {
	const scored = items.filter((t) => value(t) !== null);
	scored.sort(
		(a, b) =>
			(value(b) as number) - (value(a) as number) || (id(a) < id(b) ? -1 : 1),
	);
	return new Map(scored.map((t, i) => [id(t), i + 1]));
}

/** Build one mes ScoredPeriod. KPI puestos rank puntos desc, then id. */
export function periodo(periodoId: string, filas: Fila[]): ScoredPeriod {
	const puntosDe = (f: Fila, kpi: KpiId): number | null => {
		if (f.puntos === undefined) return f.score;
		if (f.puntos === null || typeof f.puntos === "number") return f.puntos;
		return kpi in f.puntos ? (f.puntos[kpi] ?? null) : f.score;
	};
	const general = rank(
		filas,
		(f) => f.score,
		(f) => f.id,
	);
	const kpiRanks = Object.fromEntries(
		KPI_IDS.map((k) => [
			k,
			rank(
				filas,
				(f) => puntosDe(f, k),
				(f) => f.id,
			),
		]),
	) as Record<KpiId, Map<string, number>>;
	const vendedores: ScoredVendedor[] = filas.map((f) => {
		const kpis = Object.fromEntries(
			KPI_IDS.map((k): [KpiId, KpiScore] => {
				const p = puntosDe(f, k);
				return [
					k,
					{
						kpi: k,
						valor: p,
						attainment: p === null ? null : (p / 100) * 1.1,
						puntos: p,
						puesto: kpiRanks[k].get(f.id) ?? null,
						de: kpiRanks[k].size,
					},
				];
			}),
		) as Record<KpiId, KpiScore>;
		return {
			vendedor: vendedor(f),
			periodoId,
			vista: "mes",
			score: f.score,
			tier: tierOf(f.score),
			puesto: f.puesto !== undefined ? f.puesto : (general.get(f.id) ?? null),
			de: general.size,
			puestoSucursal: null,
			deSucursal: 0,
			kpis,
		};
	});
	return { periodoId, vista: "mes", vendedores, sucursales: [] };
}

/** One ScoredPeriod per month, ids from mesId(0). */
export function temporada(meses: Fila[][]): ScoredPeriod[] {
	return meses.map((filas, i) => periodo(mesId(i), filas));
}

/**
 * Build monthly rows from per-vendedor score series. null = no data that month.
 * meta gives sucursal/canal; series shorter than the season leave the rest null.
 */
export function series(
	scores: Record<string, (number | null)[]>,
	meta: Record<string, Partial<Pick<Fila, "sucursal" | "canal">>> = {},
): Fila[][] {
	const n = Math.max(...Object.values(scores).map((s) => s.length));
	return Array.from({ length: n }, (_, i) =>
		Object.entries(scores)
			.filter(([, s]) => s[i] !== null && s[i] !== undefined)
			.map(([id, s]) => ({ id, score: s[i] as number, ...meta[id] })),
	);
}

function vendedor(
	f: Pick<Fila, "id" | "sucursal" | "canal">,
	alta?: string,
): Vendedor {
	return {
		id: f.id,
		nombre: f.id,
		apellido: f.id,
		sucursal: f.sucursal ?? "caba",
		canal: f.canal ?? "plaza",
		altaPeriodo: alta ?? PERIODOS[0].id,
	};
}

/** Dataset with every vendedor seen in periods; altas overrides altaPeriodo by id. */
export function dataset(
	periods: ScoredPeriod[],
	altas: Record<string, string> = {},
): Dataset {
	const seen = new Map<string, Vendedor>();
	for (const p of periods)
		for (const v of p.vendedores)
			if (!seen.has(v.vendedor.id)) seen.set(v.vendedor.id, { ...v.vendedor });
	for (const [id, alta] of Object.entries(altas)) {
		const v = seen.get(id) ?? vendedor({ id });
		seen.set(id, { ...v, altaPeriodo: alta });
	}
	return {
		sucursales: SUCURSALES,
		vendedores: [...seen.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
		periodos: PERIODOS,
		defs: KPI_DEFS,
		resultados: [],
	};
}
