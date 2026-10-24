import {
	type Direccion,
	KPI_TIE_ORDER,
	type KpiScore,
	type MetricaId,
} from "../domain";

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Sorts a copy with `cmp` and assigns 1-based, never shared, positions. */
export function rank<T>(
	items: readonly T[],
	cmp: (a: T, b: T) => number,
): { item: T; puesto: number }[] {
	return [...items].sort(cmp).map((item, i) => ({ item, puesto: i + 1 }));
}

export type GeneralKey = {
	id: string;
	score: number;
	/** Points per metric; ties read KPI_TIE_ORDER, a missing key counts as null. */
	puntos: Readonly<Record<MetricaId, number | null>>;
};

/** The puntos map of a seller's kpis, for cmpGeneral. */
export const puntosDe = (
	kpis: Readonly<Record<MetricaId, KpiScore>>,
): Record<MetricaId, number | null> =>
	Object.fromEntries(Object.entries(kpis).map(([k, s]) => [k, s.puntos]));

/** Ascending, nulls last. */
export const nullsLast = (a: number | null, b: number | null) =>
	a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b;

/** Score desc (unrounded) -> KPI points in KPI_TIE_ORDER -> id. */
export function cmpGeneral(a: GeneralKey, b: GeneralKey): number {
	if (a.score !== b.score) return b.score - a.score;
	for (const k of KPI_TIE_ORDER) {
		const d = (b.puntos[k] ?? -1) - (a.puntos[k] ?? -1);
		if (d !== 0) return d;
	}
	return cmpStr(a.id, b.id);
}

export type KpiKey = { id: string; valor: number; den: number };

/** Direction-aware valor -> larger den -> id. */
export function cmpKpi(dir: Direccion) {
	return (a: KpiKey, b: KpiKey): number => {
		if (a.valor !== b.valor)
			return dir === "mayor" ? b.valor - a.valor : a.valor - b.valor;
		if (a.den !== b.den) return b.den - a.den;
		return cmpStr(a.id, b.id);
	};
}

export type SucursalKey = { slug: string; score: number; miembros: number };

/** Score desc -> more miembros -> slug. */
export function cmpSucursal(a: SucursalKey, b: SucursalKey): number {
	if (a.score !== b.score) return b.score - a.score;
	if (a.miembros !== b.miembros) return b.miembros - a.miembros;
	return cmpStr(a.slug, b.slug);
}
