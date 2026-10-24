import {
	type Dataset,
	type JuegosConfig,
	KPI_IDS,
	type KpiId,
	type ScoredPeriod,
} from "@/lib/domain";
import { juegoActivo } from "@/lib/games";
import type { BotinKpi, Liga, LigaSucursal, LigaVendedor } from "./types";
import { cmpStr, configDe, desc, jugados, mean } from "./util";

/** Season floor of months a vendedor must play to be eligible. */
export const LIGA_MIN_MESES = 9;
/** Share of the months since alta a vendedor must play. */
export const LIGA_FRACCION = 0.75;
/** Eligible members a sucursal needs. */
export const LIGA_MIN_MIEMBROS = 3;

/**
 * Liga anual / Balón de Oro over the played monthly periods.
 *
 * Eligibility: meses >= min(9, ceil(0.75 · mesesDesdeAlta)). mesesDesdeAlta counts
 * the periods in `periods` from altaPeriodo (inclusive) up to the last one, so a hire
 * is only asked for 75% of the months they could have played, capped at 9 for a full
 * season; an alta before the first period counts from the first period. Early in the
 * season the table is provisional (ineligibles are still listed, sorted, with puesto
 * null).
 *
 * Sort: eligibles first, then promedio desc -> meses desc -> mediana desc -> mejorMes desc -> id.
 * Sucursales use only their eligible members (mean of their promedios) and need 3.
 * Botín: per KPI the eligible vendedor with the best mean puntos (nulls skipped);
 * ties -> more months with puntos -> id.
 *
 * v2: closed months only, and only the months the liga was on for the seller's sucursal
 * (`juegos`; absent = on everywhere). mesesDesdeAlta counts those months too, so a sucursal
 * that joined late is not asked for months it could not play. Sellers with no such month
 * and sucursales where the liga never ran are left out.
 */
export function liga(
	todos: ScoredPeriod[],
	dataset: Dataset,
	juegos?: JuegosConfig,
): Liga {
	const cfg = configDe(dataset, juegos);
	const periods = jugados(todos, dataset, "liga", juegos);
	const on = (sucursal: string, periodoId: string) =>
		juegoActivo(cfg, "liga", sucursal, periodoId);
	const jugadores = dataset.vendedores.filter((v) =>
		periods.some(
			(p) => p.periodoId >= v.altaPeriodo && on(v.sucursal, p.periodoId),
		),
	);
	const vendedores: LigaVendedor[] = jugadores.map((v) => {
		const scores = periods
			.map(
				(p) => p.vendedores.find((s) => s.vendedor.id === v.id)?.score ?? null,
			)
			.filter((s): s is number => s !== null);
		const sorted = [...scores].sort((a, b) => a - b);
		const m = sorted.length;
		// periods are all <= the last one, so this counts alta (inclusive) .. last
		const desdeAlta = periods.filter(
			(p) => p.periodoId >= v.altaPeriodo && on(v.sucursal, p.periodoId),
		).length;
		// min, not max: a mid-season hire qualifies with 75% of their own months.
		const mesesRequeridos = Math.min(
			LIGA_MIN_MESES,
			Math.ceil(LIGA_FRACCION * desdeAlta),
		);
		return {
			vendedorId: v.id,
			sucursal: v.sucursal,
			canal: v.canal,
			promedio: mean(scores),
			meses: m,
			mediana: m ? (sorted[(m - 1) >> 1] + sorted[m >> 1]) / 2 : null,
			mejorMes: m ? sorted[m - 1] : null,
			mesesRequeridos,
			elegible: m >= mesesRequeridos,
			puesto: null,
		};
	});
	vendedores.sort(
		(a, b) =>
			Number(b.elegible) - Number(a.elegible) ||
			desc(a.promedio, b.promedio) ||
			b.meses - a.meses ||
			desc(a.mediana, b.mediana) ||
			desc(a.mejorMes, b.mejorMes) ||
			cmpStr(a.vendedorId, b.vendedorId),
	);
	vendedores.forEach((v, i) => {
		if (v.elegible) v.puesto = i + 1;
	});
	const elegibles = vendedores.filter((v) => v.elegible);

	const sucursales: LigaSucursal[] = dataset.sucursales
		.filter((s) => periods.some((p) => on(s.slug, p.periodoId)))
		.map((s) => {
			const miembros = elegibles.filter((v) => v.sucursal === s.slug);
			return {
				slug: s.slug,
				promedio: mean(miembros.map((v) => v.promedio)),
				miembros: miembros.length,
				elegible: miembros.length >= LIGA_MIN_MIEMBROS,
				puesto: null,
			};
		});
	sucursales.sort(
		(a, b) =>
			Number(b.elegible) - Number(a.elegible) ||
			desc(a.promedio, b.promedio) ||
			b.miembros - a.miembros ||
			cmpStr(a.slug, b.slug),
	);
	sucursales.forEach((s, i) => {
		if (s.elegible) s.puesto = i + 1;
	});

	const botin = Object.fromEntries(
		KPI_IDS.map((kpi): [KpiId, BotinKpi | null] => {
			let best: (BotinKpi & { n: number }) | null = null;
			for (const v of elegibles) {
				const pts = periods
					.map(
						(p) =>
							p.vendedores.find((s) => s.vendedor.id === v.vendedorId)?.kpis[
								kpi
							].puntos ?? null,
					)
					.filter((x): x is number => x !== null);
				const avg = mean(pts);
				if (avg === null) continue;
				const cand = {
					vendedorId: v.vendedorId,
					promedioPuntos: avg,
					n: pts.length,
				};
				if (
					!best ||
					avg > best.promedioPuntos ||
					(avg === best.promedioPuntos &&
						(cand.n > best.n ||
							(cand.n === best.n &&
								cmpStr(cand.vendedorId, best.vendedorId) < 0)))
				)
					best = cand;
			}
			return [
				kpi,
				best && {
					vendedorId: best.vendedorId,
					promedioPuntos: best.promedioPuntos,
				},
			];
		}),
	) as Record<KpiId, BotinKpi | null>;

	return { vendedores, sucursales, botin };
}
