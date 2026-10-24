import { describe, expect, test } from "vitest";
import { dataset, mesId, periodo, series, temporada } from "./fixtures";
import { revelacion } from "./revelacion";

const n = null;
const run = (scores: Record<string, (number | null)[]>) => {
	const periods = temporada(series(scores));
	return revelacion(periods, dataset(periods));
};

describe("revelacion", () => {
	test("one period (or none) -> every list empty", () => {
		const one = [periodo(mesId(0), [{ id: "A", score: 80 }])];
		expect(revelacion(one, dataset(one))).toEqual({
			periodoId: mesId(0),
			absoluta: [],
			relativa: [],
			racha: [],
			remontada: [],
		});
		expect(revelacion([], dataset([])).periodoId).toBeNull();
	});

	test("absoluta: delta vs previous month, desc; needs both months", () => {
		const r = run({ A: [50, 60], B: [70, 90], C: [80, 70], D: [n, 99] });
		expect(r.periodoId).toBe(mesId(1));
		expect(r.absoluta).toEqual([
			{ vendedorId: "B", anterior: 70, actual: 90, delta: 20 },
			{ vendedorId: "A", anterior: 50, actual: 60, delta: 10 },
			{ vendedorId: "C", anterior: 80, actual: 70, delta: -10 },
		]);
	});

	test("relativa: delta/(100-prev), only delta > 0 and prev < 99.5", () => {
		const r = run({
			A: [50, 60], // 10/50 = 0.2
			B: [90, 95], // 5/10 = 0.5
			G: [99.4, 99.9], // 0.5/0.6
			X: [99.6, 100], // prev >= 99.5 -> out
			Z: [80, 70], // delta < 0 -> out
			Q: [70, 70], // delta 0 -> out
		});
		expect(r.relativa.map((x) => x.vendedorId)).toEqual(["G", "B", "A"]);
		expect(r.relativa[0].relativa).toBeCloseTo(0.5 / 0.6, 10);
		expect(r.relativa[1]).toMatchObject({
			relativa: 0.5,
			delta: 5,
			anterior: 90,
		});
	});

	test("racha: >= 3 consecutive positive deltas ending now, longest first", () => {
		const r = run({
			TRES: [90, 50, 60, 70, 80], // 3 deltas
			DOS: [50, 40, 60, 70, 80], // down, then 3 ups
			CORTA: [50, 60, 50, 70, 80], // only 2 ups at the end
			CUATRO: [10, 20, 30, 40, 50], // 4
			HUECO: [10, 20, n, 40, 50], // null breaks it: 1
			EMPATE: [10, 20, 30, 30, 50], // flat breaks it: 1
		});
		expect(r.racha.map((x) => [x.vendedorId, x.racha])).toEqual([
			["CUATRO", 4],
			["DOS", 3],
			["TRES", 3],
		]);
		expect(r.racha[0]).toMatchObject({ ganancia: 40, actual: 50 });
		// DOS gained 40 (40 -> 80), TRES 30 (50 -> 80): ganancia breaks the tie
		expect(r.racha[1].ganancia).toBe(40);
	});

	test("racha of exactly 2 is not a racha", () => {
		expect(run({ A: [80, 60, 70, 80] }).racha).toEqual([]);
		expect(run({ A: [50, 60, 70, 80] }).racha).toHaveLength(1);
	});

	test("remontada: max earlier puesto minus current, >= 6 scored months, largest first", () => {
		const fila = (puestos: Record<string, number | null>) =>
			Object.entries(puestos)
				.filter(([, p]) => p !== null)
				.map(([id, p]) => ({ id, score: 50, puesto: p }));
		const periods = [
			fila({ A: 10, B: 3, C: 9, D: 2 }),
			fila({ A: 5, B: 4, C: 9, D: 2 }),
			fila({ A: 12, B: 4, C: 9, D: 2 }),
			fila({ A: 6, B: 6, C: 9, D: 2 }),
			fila({ A: 4, B: 2, C: 9, D: 2 }),
			fila({ A: 2, B: 1, C: null, D: 3 }),
		].map((f, i) => periodo(mesId(i), f));
		const r = revelacion(periods, dataset(periods));
		// A: worst 12 (month 3) -> 2 = 10; B: worst 6 -> 1 = 5; C has 5 months; D got worse.
		expect(r.remontada).toEqual([
			{
				vendedorId: "A",
				peorPuesto: 12,
				peorPeriodoId: mesId(2),
				puestoActual: 2,
				remontada: 10,
				meses: 6,
			},
			{
				vendedorId: "B",
				peorPuesto: 6,
				peorPeriodoId: mesId(3),
				puestoActual: 1,
				remontada: 5,
				meses: 6,
			},
		]);
	});

	test("remontada needs 6 scored months: 5 is not enough", () => {
		const periods = [10, 8, 6, 4, 2].map((p, i) =>
			periodo(mesId(i), [{ id: "A", score: 50, puesto: p }]),
		);
		expect(revelacion(periods, dataset(periods)).remontada).toEqual([]);
	});
});
