import type {
	Dataset,
	JuegosConfig,
	ScoredPeriod,
	ScoredVendedor,
} from "@/lib/domain";
import type {
	Revelacion,
	RevelacionAbsoluta,
	RevelacionRacha,
	RevelacionRemontada,
} from "./types";
import { cmpStr, jugados } from "./util";

/** relativa is skipped from this previous score up (the denominator 100 - prev gets too small). */
export const RELATIVA_MAX_PREV = 99.5;
/** Minimum consecutive positive deltas for a racha. */
export const RACHA_MIN = 3;
/** Minimum scored months for a remontada. */
export const REMONTADA_MIN_MESES = 6;

/**
 * Revelación del mes for the LAST period of `periods`.
 *
 * - absoluta: everyone scored in the last two periods, by delta desc -> id.
 * - relativa: delta / (100 - prev), only delta > 0 and prev < 99.5; desc -> delta -> id.
 * - racha: consecutive deltas > 0 ending at the last period; a month without score or a
 *   flat month breaks it. Kept when >= 3; racha desc -> ganancia desc -> id.
 * - remontada: worst general puesto in an earlier period minus the current puesto, for
 *   vendedores with >= 6 scored months (the current one included) and a positive climb;
 *   desc -> puestoActual asc -> id. Each month's puesto is used as published, so a
 *   hire is compared only against months they played.
 *
 * Every list is empty when there are fewer than two periods.
 *
 * v2: closed months only; a sucursal-month where revelacion was off (`juegos`; absent = on
 * everywhere) counts as a month without score for its sellers.
 */
export function revelacion(
	todos: ScoredPeriod[],
	dataset: Dataset,
	juegos?: JuegosConfig,
): Revelacion {
	const periods = jugados(todos, dataset, "revelacion", juegos);
	const last = periods.at(-1);
	const vacio: Revelacion = {
		periodoId: last?.periodoId ?? null,
		absoluta: [],
		relativa: [],
		racha: [],
		remontada: [],
	};
	if (!last || periods.length < 2) return vacio;

	const byId = periods.map(
		(p) => new Map(p.vendedores.map((v) => [v.vendedor.id, v])),
	);
	const at = (i: number, id: string): ScoredVendedor | undefined =>
		byId[i].get(id);
	const iLast = periods.length - 1;
	const ids = last.vendedores.map((v) => v.vendedor.id).sort(cmpStr);

	const absoluta: RevelacionAbsoluta[] = [];
	const racha: RevelacionRacha[] = [];
	const remontada: RevelacionRemontada[] = [];

	for (const id of ids) {
		const actual = at(iLast, id)?.score ?? null;
		if (actual === null) continue;
		const anterior = at(iLast - 1, id)?.score ?? null;
		if (anterior !== null)
			absoluta.push({
				vendedorId: id,
				anterior,
				actual,
				delta: actual - anterior,
			});

		// walk back while each month beats the one before it
		let i = iLast;
		while (i > 0) {
			const cur = at(i, id)?.score ?? null;
			const prev = at(i - 1, id)?.score ?? null;
			if (cur === null || prev === null || cur <= prev) break;
			i--;
		}
		const k = iLast - i;
		if (k >= RACHA_MIN)
			racha.push({
				vendedorId: id,
				racha: k,
				ganancia: actual - (at(i, id)?.score as number),
				actual,
			});

		const puestoActual = at(iLast, id)?.puesto ?? null;
		const meses = byId.filter(
			(m) => (m.get(id)?.score ?? null) !== null,
		).length;
		if (puestoActual === null || meses < REMONTADA_MIN_MESES) continue;
		let peor: { puesto: number; periodoId: string } | null = null;
		for (let j = 0; j < iLast; j++) {
			const p = at(j, id)?.puesto ?? null;
			if (p !== null && (!peor || p > peor.puesto))
				peor = { puesto: p, periodoId: periods[j].periodoId };
		}
		if (peor && peor.puesto > puestoActual)
			remontada.push({
				vendedorId: id,
				peorPuesto: peor.puesto,
				peorPeriodoId: peor.periodoId,
				puestoActual,
				remontada: peor.puesto - puestoActual,
				meses,
			});
	}

	const relativa = absoluta
		.filter((a) => a.delta > 0 && a.anterior < RELATIVA_MAX_PREV)
		.map((a) => ({ ...a, relativa: a.delta / (100 - a.anterior) }))
		.sort(
			(a, b) =>
				b.relativa - a.relativa ||
				b.delta - a.delta ||
				cmpStr(a.vendedorId, b.vendedorId),
		);
	absoluta.sort(
		(a, b) => b.delta - a.delta || cmpStr(a.vendedorId, b.vendedorId),
	);
	racha.sort(
		(a, b) =>
			b.racha - a.racha ||
			b.ganancia - a.ganancia ||
			cmpStr(a.vendedorId, b.vendedorId),
	);
	remontada.sort(
		(a, b) =>
			b.remontada - a.remontada ||
			a.puestoActual - b.puestoActual ||
			cmpStr(a.vendedorId, b.vendedorId),
	);

	return { ...vacio, absoluta, relativa, racha, remontada };
}
