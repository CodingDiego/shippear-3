import { getScoredPeriod } from "@/lib/data/queries";
import { provinciaDe } from "@/lib/domain";
import type { RankingParams, RankingResponse } from "./options";

type ConPuesto = { puesto: number | null };
export const byPuesto = (a: ConPuesto, b: ConPuesto) =>
	(a.puesto ?? Number.POSITIVE_INFINITY) -
	(b.puesto ?? Number.POSITIVE_INFINITY);

/** Server-side source of /api/ranking; also used to prefetch the same query key. */
export async function loadRanking(p: RankingParams): Promise<RankingResponse> {
	const period = await getScoredPeriod(p.periodo, p.vista);
	const enProvincia = (sucursal: string) =>
		!p.provincia || provinciaDe(sucursal) === p.provincia;
	const vendedores = period.vendedores
		.filter(
			(v) =>
				(!p.sucursal || v.vendedor.sucursal === p.sucursal) &&
				enProvincia(v.vendedor.sucursal) &&
				(!p.canal || v.vendedor.canal === p.canal),
		)
		.sort(byPuesto);
	return {
		periodoId: period.periodoId,
		vista: period.vista,
		de: period.vendedores.length,
		vendedores,
		sucursales: period.sucursales
			.filter((s) => enProvincia(s.sucursal.slug))
			.sort(byPuesto),
		provincias: [...(period.provincias ?? [])].sort(byPuesto),
	};
}
