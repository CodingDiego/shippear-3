import {
	PROVINCIAS,
	provinciaDe,
	type ScoredPeriod,
	type ScoredProvincia,
	type ScoredVendedor,
	tierOf,
} from "../domain";
import { cmpGeneral, cmpSucursal, nullsLast, puntosDe, rank } from "./rank";

const agrupar = <T>(xs: readonly T[], key: (x: T) => string | null) => {
	const m = new Map<string, T[]>();
	for (const x of xs) {
		const k = key(x);
		if (k === null) continue;
		const l = m.get(k);
		if (l) l.push(x);
		else m.set(k, [x]);
	}
	return m;
};

/**
 * Province layer over an already finalized period. Pure, returns copies.
 * - sellers: puestoProvincia/deProvincia by cmpGeneral among scored sellers of the province
 *   (provinciaDe(vendedor.sucursal)); unscored sellers get null / the province's scored count.
 * - sucursales: puestoProvincia by cmpSucursal among scored sucursales of the province.
 * - provincias: every PROVINCIAS entry, score = mean of member seller scores, puesto by
 *   cmpSucursal (slug as id), sorted puesto asc, nulls last.
 */
export function rankProvincias(
	p: Pick<ScoredPeriod, "vendedores" | "sucursales">,
): Required<Pick<ScoredPeriod, "vendedores" | "sucursales" | "provincias">> {
	type Scored = ScoredVendedor & { score: number };
	const vPorProv = agrupar(
		p.vendedores.filter((v): v is Scored => v.score !== null),
		(v) => provinciaDe(v.vendedor.sucursal),
	);
	const puestoV = new Map<string, number>();
	for (const l of vPorProv.values())
		for (const r of rank(
			l.map((v) => ({
				id: v.vendedor.id,
				score: v.score,
				puntos: puntosDe(v.kpis),
			})),
			cmpGeneral,
		))
			puestoV.set(r.item.id, r.puesto);

	const sPorProv = agrupar(
		p.sucursales.flatMap((s) =>
			s.score === null
				? []
				: [{ slug: s.sucursal.slug, score: s.score, miembros: s.miembros }],
		),
		(s) => provinciaDe(s.slug),
	);
	const puestoS = new Map<string, number>();
	for (const l of sPorProv.values())
		for (const r of rank(l, cmpSucursal)) puestoS.set(r.item.slug, r.puesto);

	const provs = PROVINCIAS.map((provincia) => {
		const m = vPorProv.get(provincia.slug) ?? [];
		const score = m.length
			? m.reduce((t, v) => t + v.score, 0) / m.length
			: null;
		return { provincia, score, miembros: m.length };
	});
	const puestoP = new Map<string, number>();
	for (const r of rank(
		provs.flatMap(({ provincia, score, miembros }) =>
			score === null ? [] : [{ slug: provincia.slug, score, miembros }],
		),
		cmpSucursal,
	))
		puestoP.set(r.item.slug, r.puesto);

	const provincias = provs
		.map(
			({ provincia, score, miembros }): ScoredProvincia => ({
				provincia,
				score,
				tier: tierOf(score),
				puesto: puestoP.get(provincia.slug) ?? null,
				miembros,
				sucursales: p.sucursales.filter(
					(s) => provinciaDe(s.sucursal.slug) === provincia.slug,
				).length,
			}),
		)
		.sort(
			(a, b) =>
				nullsLast(a.puesto, b.puesto) ||
				(a.provincia.slug < b.provincia.slug ? -1 : 1),
		);

	return {
		vendedores: p.vendedores.map((v) => {
			const prov = provinciaDe(v.vendedor.sucursal);
			return {
				...v,
				puestoProvincia: puestoV.get(v.vendedor.id) ?? null,
				deProvincia: prov === null ? 0 : (vPorProv.get(prov)?.length ?? 0),
			};
		}),
		sucursales: p.sucursales.map((s) => ({
			...s,
			puestoProvincia: puestoS.get(s.sucursal.slug) ?? null,
		})),
		provincias,
	};
}
