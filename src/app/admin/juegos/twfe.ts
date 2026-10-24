// The same two-way fixed effects β as efectoVentas (src/lib/games), plus a 95 % interval
// clustered by unit. efectoVentas returns no residuals, so the demeaning is repeated here.
import type { Celda } from "@/lib/games";

export type EfectoConIntervalo = {
	/** null when not identified (no treated or no control cells). */
	beta: number | null;
	lo: number | null;
	hi: number | null;
	tratadas: number;
	control: number;
	sinControl: boolean;
};

function demean(x: number[], grupo: readonly string[]): number {
	const suma = new Map<string, [number, number]>();
	grupo.forEach((g, i) => {
		const s = suma.get(g) ?? [0, 0];
		s[0] += x[i];
		s[1]++;
		suma.set(g, s);
	});
	let max = 0;
	grupo.forEach((g, i) => {
		const [t, n] = suma.get(g) as [number, number];
		x[i] -= t / n;
		max = Math.max(max, Math.abs(t / n));
	});
	return max;
}

export function efectoConIntervalo(
	celdas: readonly Celda[],
): EfectoConIntervalo {
	const tratadas = celdas.filter((c) => c.activo).length;
	const control = celdas.length - tratadas;
	const vacio = {
		beta: null,
		lo: null,
		hi: null,
		tratadas,
		control,
		sinControl: control === 0,
	};
	if (tratadas === 0 || control === 0) return vacio;

	const y = celdas.map((c) => c.y);
	const d = celdas.map((c) => (c.activo ? 1 : 0));
	const unidades = celdas.map((c) => c.unidad);
	const grupos = [unidades, celdas.map((c) => c.periodoId)];
	for (let it = 0; it < 200; it++) {
		let cambio = 0;
		for (const g of grupos)
			cambio = Math.max(cambio, demean(y, g), demean(d, g));
		if (cambio < 1e-9) break;
	}
	let yd = 0;
	let dd = 0;
	for (let i = 0; i < y.length; i++) {
		yd += y[i] * d[i];
		dd += d[i] * d[i];
	}
	if (dd < 1e-12) return vacio;
	const beta = yd / dd;

	// Cluster-robust variance by unit: Σ_g (Σ_i d̃·e)² / (Σ d̃²)², with the G/(G-1) correction.
	const score = new Map<string, number>();
	for (let i = 0; i < y.length; i++) {
		const e = y[i] - beta * d[i];
		score.set(unidades[i], (score.get(unidades[i]) ?? 0) + d[i] * e);
	}
	const g = score.size;
	let s2 = 0;
	for (const s of score.values()) s2 += s * s;
	const se = g > 1 ? Math.sqrt((s2 / (dd * dd)) * (g / (g - 1))) : 0;
	return {
		...vacio,
		beta,
		lo: beta - 1.96 * se,
		hi: beta + 1.96 * se,
	};
}
