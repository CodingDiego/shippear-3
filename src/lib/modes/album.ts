import {
	type Dataset,
	type FiguV2,
	type JuegosConfig,
	KPI_IDS,
	type MetricaDef,
	type MetricaId,
	metricasDe,
	type Rareza,
	type ScoredPeriod,
	type ScoredVendedor,
} from "@/lib/domain";
import { juegoActivo } from "@/lib/games";
import type { AlbumVendedor, Figu, Medalla } from "./types";
import { cerrados, cmpStr, configDe, desc } from "./util";

const MEDALLAS: readonly Medalla[] = ["oro", "plata", "bronce"];
/** attainment is a float ratio: exactly-at-objetivo can land a hair under 1. */
const EPS = 1e-9;

/**
 * Rarity by quantile of p over every (month, metric) cell of the season: the hardest 5 %
 * (lowest p) legendaria, the next 20 % epica, the next 35 % rara, the rest comun. A tie
 * takes the tier of its first (hardest) member, so equal p never splits across tiers.
 */
export function rarezasDe(ps: readonly number[]): Rareza[] {
	const orden = [...ps].sort((a, b) => a - b);
	return ps.map((p) => {
		const q = orden.indexOf(p) / orden.length;
		return q < 0.05
			? "legendaria"
			: q < 0.25
				? "epica"
				: q < 0.6
					? "rara"
					: "comun";
	});
}

const cumple = (v: ScoredVendedor | undefined, m: MetricaId): boolean =>
	(v?.kpis[m]?.attainment ?? 0) >= 1 - EPS;

/**
 * v2 Álbum: figus come from goals (SPEC-V2 "Figus v2"). A figu = (seller, period, active
 * metric incl. constancia) with kpis[metrica].attainment >= 1, only where
 * juegoActivo(juegos, "album", seller's sucursal, periodoId). p = share of
 * sellers with a value that month who met it, rarity = quantile of p over all cells (rarezasDe); holográfica = met in this and the two
 * previous entries of `periods`; medalla = national top 3 by puntos among those who met it
 * (v1 per-KPI tie rules: kpis[metrica].puesto).
 * periods: closed months only, vista "mes", ascending, from scorePeriodV2.
 * Order: periodo -> metric orden -> medalla holders first -> vendedorId.
 *
 * p and holográfica look at every seller nationally (difficulty does not depend on the
 * game); medals go only to figu holders, so a seller where the album is off never takes
 * a medal from one where it is on. A month in progress in `periods` is dropped.
 */
export function figusV2(
	periods: readonly ScoredPeriod[],
	dataset: Dataset,
	defs: readonly MetricaDef[],
	juegos: JuegosConfig,
): FiguV2[] {
	const meses = cerrados(periods, dataset);
	const metricas = defs
		.filter((d) => d.activa)
		.sort((a, b) => a.orden - b.orden || cmpStr(a.id, b.id));
	const byId = meses.map(
		(p) => new Map(p.vendedores.map((v) => [v.vendedor.id, v])),
	);
	const celdas = meses.flatMap((p, i) =>
		metricas.flatMap(({ id: m }) => {
			const conDato = p.vendedores.filter(
				(v) => (v.kpis[m]?.attainment ?? null) !== null,
			);
			const cumplen = conDato.filter((v) => cumple(v, m));
			return cumplen.length === 0
				? []
				: [{ p, i, m, cumplen, share: cumplen.length / conDato.length }];
		}),
	);
	const rarezas = rarezasDe(celdas.map((c) => c.share));
	const figus: FiguV2[] = [];

	celdas.forEach(({ p, i, m, cumplen, share }, c) => {
		const rareza = rarezas[c];
		const ganadores = cumplen
			.filter((v) =>
				juegoActivo(juegos, "album", v.vendedor.sucursal, p.periodoId),
			)
			.sort(
				(a, b) =>
					desc(a.kpis[m].puntos, b.kpis[m].puntos) ||
					(a.kpis[m].puesto ?? Number.POSITIVE_INFINITY) -
						(b.kpis[m].puesto ?? Number.POSITIVE_INFINITY) ||
					cmpStr(a.vendedor.id, b.vendedor.id),
			);
		const resto = ganadores
			.slice(3)
			.sort((a, b) => cmpStr(a.vendedor.id, b.vendedor.id));
		[...ganadores.slice(0, 3), ...resto].forEach((v, rank) => {
			const id = v.vendedor.id;
			const k = v.kpis[m];
			figus.push({
				vendedorId: id,
				periodoId: p.periodoId,
				metrica: m,
				valor: k.valor as number,
				attainment: k.attainment as number,
				puntos: k.puntos as number,
				p: share,
				rareza,
				holografica:
					i >= 2 &&
					cumple(byId[i - 1].get(id), m) &&
					cumple(byId[i - 2].get(id), m),
				...(rank < 3 ? { medalla: MEDALLAS[rank] } : {}),
			});
		});
	});
	return figus;
}

/**
 * Álbum de figuritas, v2 rules (see figusV2) in the v1 Figu shape the pages read.
 * Metrics: dataset.metricas, or the seven base ones. juegos absent = album on everywhere.
 */
export function album(
	periods: ScoredPeriod[],
	dataset: Dataset,
	juegos?: JuegosConfig,
): Figu[] {
	return figusV2(
		periods,
		dataset,
		dataset.metricas ?? metricasDe(dataset.defs),
		configDe(dataset, juegos),
	).map((f) => ({ ...f, kpi: f.metrica, ambito: "nacional" }));
}

/** One vendedor's album: grid[metrica][periodoId] (only filled cells), completion over the 7 KPIs. */
export function albumDe(figus: Figu[], vendedorId: string): AlbumVendedor {
	const grid: AlbumVendedor["grid"] = Object.fromEntries(
		KPI_IDS.map((k) => [k, {}]),
	);
	let total = 0;
	for (const f of figus) {
		if (f.vendedorId !== vendedorId) continue;
		grid[f.kpi] ??= {};
		grid[f.kpi][f.periodoId] = [...(grid[f.kpi][f.periodoId] ?? []), f];
		total++;
	}
	const lleno = (m: MetricaId) => Object.keys(grid[m]).length > 0;
	return {
		grid,
		completado: KPI_IDS.filter(lleno).length / KPI_IDS.length,
		metricasConFigu: Object.keys(grid).filter(lleno).length,
		total,
	};
}
