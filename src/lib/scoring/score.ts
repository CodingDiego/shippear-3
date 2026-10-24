import {
	KPI_IDS,
	type KpiDef,
	type KpiId,
	type MetricaId,
	type ScoredPeriod,
	type ScoredSucursal,
	type ScoredVendedor,
	type Sucursal,
	tierOf,
} from "../domain";
import { rankProvincias } from "./provincia";
import {
	cmpGeneral,
	cmpSucursal,
	type GeneralKey,
	nullsLast,
	puntosDe,
	rank,
} from "./rank";

type Puntos = Readonly<Record<MetricaId, number | null>>;
/** Weight per metric; only these keys count towards the score. */
type Pesos = Readonly<Record<MetricaId, number>>;

/** Sum(w*p)/Sum(w) over non-null; null if available weight is under 50% of the total. */
function weighted(p: Puntos, pesos: Pesos): number | null {
	let total = 0;
	let avail = 0;
	let sum = 0;
	for (const [k, w] of Object.entries(pesos)) {
		total += w;
		const v = p[k] ?? null;
		if (v !== null) {
			avail += w;
			sum += w * v;
		}
	}
	return avail <= 0 || avail < total * 0.5 - 1e-9 ? null : sum / avail;
}

const pesosOf = (defs: Record<KpiId, KpiDef>) =>
	Object.fromEntries(KPI_IDS.map((k) => [k, defs[k].peso])) as Record<
		KpiId,
		number
	>;

export function cardScore(
	kpis: Record<KpiId, number | null>,
	defs: Record<KpiId, KpiDef>,
): number | null {
	return weighted(kpis, pesosOf(defs));
}

export function blendVista(
	mes: number | null,
	acum: number | null,
	pesoMes: number,
): number | null {
	if (mes === null) return acum;
	if (acum === null) return mes;
	return pesoMes * mes + (1 - pesoMes) * acum;
}

/**
 * Recomputes score, tier, puesto, de, puestoSucursal, deSucursal and the sucursal
 * table from each vendedor's existing kpis[k].puntos. Shared by scorePeriod and rescore.
 */
export function finalize(
	vs: readonly ScoredVendedor[],
	sucursales: readonly Sucursal[],
	pesos: Pesos,
): Pick<ScoredPeriod, "vendedores" | "sucursales"> {
	type Item = GeneralKey & { v: ScoredVendedor };
	const items = vs.map((v) => {
		const puntos = puntosDe(v.kpis);
		return { id: v.vendedor.id, score: weighted(puntos, pesos), puntos, v };
	});
	const scored = items.filter((i): i is Item => i.score !== null);

	const puesto = new Map<string, number>();
	for (const r of rank(scored, cmpGeneral)) puesto.set(r.item.id, r.puesto);

	const bySuc = new Map<string, Item[]>();
	for (const i of scored) {
		const l = bySuc.get(i.v.vendedor.sucursal);
		if (l) l.push(i);
		else bySuc.set(i.v.vendedor.sucursal, [i]);
	}
	const puestoSuc = new Map<string, number>();
	for (const l of bySuc.values())
		for (const r of rank(l, cmpGeneral)) puestoSuc.set(r.item.id, r.puesto);

	const vendedores = items
		.map(
			({ id, score, v }): ScoredVendedor => ({
				...v,
				score,
				tier: tierOf(score),
				puesto: puesto.get(id) ?? null,
				de: scored.length,
				puestoSucursal: puestoSuc.get(id) ?? null,
				deSucursal: bySuc.get(v.vendedor.sucursal)?.length ?? 0,
			}),
		)
		.sort(
			(a, b) =>
				nullsLast(a.puesto, b.puesto) ||
				(a.vendedor.id < b.vendedor.id ? -1 : 1),
		);

	const sucs = sucursales.map((s) => {
		const m = bySuc.get(s.slug) ?? [];
		const score = m.length
			? m.reduce((t, i) => t + i.score, 0) / m.length
			: null;
		return { s, score, miembros: m.length };
	});
	const sucPuesto = new Map<string, number>();
	for (const r of rank(
		sucs.flatMap((x) =>
			x.score === null
				? []
				: [{ slug: x.s.slug, score: x.score, miembros: x.miembros }],
		),
		cmpSucursal,
	))
		sucPuesto.set(r.item.slug, r.puesto);

	const sucursalesOut = sucs
		.map(
			({ s, score, miembros }): ScoredSucursal => ({
				sucursal: s,
				score,
				tier: tierOf(score),
				puesto: sucPuesto.get(s.slug) ?? null,
				miembros,
			}),
		)
		.sort(
			(a, b) =>
				nullsLast(a.puesto, b.puesto) ||
				(a.sucursal.slug < b.sucursal.slug ? -1 : 1),
		);

	return { vendedores, sucursales: sucursalesOut };
}

/**
 * Same period, new weights (only the given keys score). Pure; per-KPI values and ranks
 * are untouched; the province layer is recomputed.
 */
export function rescore(scored: ScoredPeriod, pesos: Pesos): ScoredPeriod {
	return {
		...scored,
		...rankProvincias(
			finalize(
				scored.vendedores,
				scored.sucursales.map((s) => s.sucursal),
				pesos,
			),
		),
	};
}

export { pesosOf };
