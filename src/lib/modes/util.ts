import type {
	Dataset,
	JuegoId,
	JuegosConfig,
	ScoredPeriod,
} from "@/lib/domain";
import { juegoActivo, juegosTodos } from "@/lib/games";

/** Mean of the non-null values; null when there are none. */
export function mean(xs: readonly (number | null)[]): number | null {
	const v = xs.filter((x): x is number => x !== null);
	return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Plain code-unit string order: deterministic, unlike localeCompare across ICU builds. */
export function cmpStr(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** Descending comparison with nulls last. */
export function desc(a: number | null, b: number | null): number {
	if (a === b) return 0;
	if (a === null) return 1;
	if (b === null) return -1;
	return b - a;
}

/** Drops the month in progress (enCurso in dataset.periodos); games read closed months only. */
export function cerrados<P extends { periodoId: string }>(
	periods: readonly P[],
	dataset: Dataset,
): P[] {
	const abiertos = new Set(
		dataset.periodos.filter((p) => p.enCurso).map((p) => p.id),
	);
	return periods.filter((p) => !abiertos.has(p.periodoId));
}

/** juegos, or every game on everywhere when absent (v1 callers). */
export const configDe = (
	dataset: Dataset,
	juegos: JuegosConfig | undefined,
): JuegosConfig => juegos ?? juegosTodos(dataset.sucursales);

/**
 * Closed months, each keeping only the sellers whose sucursal had `juego` on that month,
 * so an inactive sucursal-month plays as if it had no data.
 */
export function jugados(
	periods: readonly ScoredPeriod[],
	dataset: Dataset,
	juego: JuegoId,
	juegos?: JuegosConfig,
): ScoredPeriod[] {
	const cfg = configDe(dataset, juegos);
	return cerrados(periods, dataset).map((p) => ({
		...p,
		vendedores: p.vendedores.filter((v) =>
			juegoActivo(cfg, juego, v.vendedor.sucursal, p.periodoId),
		),
	}));
}
