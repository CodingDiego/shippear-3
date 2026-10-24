import { describe, expect, it } from "vitest";
import { type Celda, efectoVentas } from "@/lib/games";
import { efectoConIntervalo } from "./twfe";

// Deterministic noise so the test never flakes.
function lcg(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) % 2 ** 32;
		return s / 2 ** 32 - 0.5;
	};
}

function panel(beta: number, seed = 7): Celda[] {
	const r = lcg(seed);
	const celdas: Celda[] = [];
	for (let u = 0; u < 30; u++)
		for (let m = 0; m < 12; m++)
			celdas.push({
				unidad: `u${u}`,
				periodoId: `2026-${String(m + 1).padStart(2, "0")}`,
				activo: u % 2 === 0 && m >= 4 + (u % 5),
				y: 0,
			});
	for (const c of celdas) {
		const u = Number(c.unidad.slice(1));
		const m = Number(c.periodoId.slice(5));
		c.y = 0.9 + u * 0.004 + m * 0.002 + (c.activo ? beta : 0) + r() * 0.02;
	}
	return celdas;
}

describe("efectoConIntervalo", () => {
	it("matches efectoVentas and its 95 % interval covers the truth about 95 % of the time", () => {
		const celdas = panel(0.03);
		const e = efectoConIntervalo(celdas);
		expect(e.beta).toBeCloseTo(efectoVentas(celdas).beta as number, 9);
		expect(e.hi as number).toBeGreaterThan(e.lo as number);
		const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
		const cubre = seeds.filter((seed) => {
			const x = efectoConIntervalo(panel(0.03, seed));
			return (x.lo as number) < 0.03 && 0.03 < (x.hi as number);
		}).length;
		expect(cubre / seeds.length).toBeGreaterThan(0.85);
	});

	it("returns no estimate without control cells", () => {
		const celdas = panel(0).map((c) => ({ ...c, activo: true }));
		expect(efectoConIntervalo(celdas)).toMatchObject({
			beta: null,
			lo: null,
			sinControl: true,
		});
	});
});
