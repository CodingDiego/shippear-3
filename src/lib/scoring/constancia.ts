// Constancia: steadiness of venta attainment on rolling 30-day windows (SPEC-V2).
import { sumarDias } from "../time";

export const CONSTANCIA = {
	/** Window ends: the 90 calendar days ending at the reference date. */
	dias: 90,
	/** Rolling window length, calendar days (d-29..d). */
	ventana: 30,
	/** Fewer rolling points than this -> null. */
	minPuntos: 60,
	/** cv at which valor reaches 0. */
	cvTope: 0.5,
} as const;

export type FilaDiaria = { fecha: string; num: number; den: number };

/**
 * One seller's r_d series: for each of the CONSTANCIA.dias days d ending at ref,
 * Σnum/Σden of venta over d-29..d. Days with Σden = 0 are skipped. Ascending by d.
 * `diarios` are that seller's venta daily rows covering ref-118..ref, 119 calendar days (any order).
 */
export function serieRolling(
	diarios: readonly FilaDiaria[],
	ref: string,
): number[] {
	const span = CONSTANCIA.dias + CONSTANCIA.ventana - 1;
	const desde = sumarDias(ref, 1 - span);
	const dia = new Map<string, number>();
	for (let i = 0; i < span; i++) dia.set(sumarDias(desde, i), i);
	const num = new Array<number>(span).fill(0);
	const den = new Array<number>(span).fill(0);
	for (const r of diarios) {
		const i = dia.get(r.fecha);
		if (i === undefined) continue;
		num[i] += r.num;
		den[i] += r.den;
	}
	const out: number[] = [];
	for (let fin = CONSTANCIA.ventana - 1; fin < span; fin++) {
		let n = 0;
		let d = 0;
		for (let i = fin - CONSTANCIA.ventana + 1; i <= fin; i++) {
			n += num[i];
			d += den[i];
		}
		if (d > 0) out.push(n / d);
	}
	return out;
}

/**
 * valor = 1 - min(1, cv / CONSTANCIA.cvTope), cv = population stdev(r) / mean(r).
 * null when series.length < CONSTANCIA.minPuntos or mean(r) <= 0. In [0, 1].
 */
export function constancia(series: readonly number[]): number | null {
	if (series.length < CONSTANCIA.minPuntos) return null;
	const mean = series.reduce((t, r) => t + r, 0) / series.length;
	if (mean <= 0) return null;
	const varianza =
		series.reduce((t, r) => t + (r - mean) ** 2, 0) / series.length;
	return 1 - Math.min(1, Math.sqrt(varianza) / mean / CONSTANCIA.cvTope);
}
