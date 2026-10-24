import { describe, expect, test } from "vitest";
import { esHabil, sumarDias } from "../time";
import {
	CONSTANCIA,
	constancia,
	type FilaDiaria,
	serieRolling,
} from "./constancia";

const REF = "2026-09-30";

/** Working-day rows over ref-118..ref; f gives num for a day (den 100). */
const filas = (f: (fecha: string, i: number) => number): FilaDiaria[] => {
	const out: FilaDiaria[] = [];
	for (let i = 0; i < 119; i++) {
		const fecha = sumarDias(REF, i - 118);
		if (esHabil(fecha)) out.push({ fecha, num: f(fecha, i), den: 100 });
	}
	return out;
};

describe("constancia", () => {
	test("flat series -> 1", () => {
		expect(constancia(Array(90).fill(0.95))).toBeCloseTo(1, 12);
	});
	test("alternating 0.5 / 1.5 -> 0 (cv 0.5 is the cap)", () => {
		const s = Array.from({ length: 90 }, (_, i) => (i % 2 ? 1.5 : 0.5));
		expect(constancia(s)).toBe(0);
	});
	test("mild swings land in between, linear in cv", () => {
		// mean 1, population stdev 0.1 -> cv 0.1 -> 1 - 0.1/0.5 = 0.8
		const s = Array.from({ length: 90 }, (_, i) => (i % 2 ? 1.1 : 0.9));
		expect(constancia(s)).toBeCloseTo(0.8, 9);
	});
	test("fewer than 60 points -> null; mean <= 0 -> null", () => {
		expect(constancia(Array(CONSTANCIA.minPuntos - 1).fill(1))).toBeNull();
		expect(constancia(Array(CONSTANCIA.minPuntos).fill(1))).toBe(1);
		expect(constancia(Array(90).fill(0))).toBeNull();
	});
});

describe("serieRolling", () => {
	test("constant daily attainment -> 90 points of that value", () => {
		const s = serieRolling(
			filas(() => 90),
			REF,
		);
		expect(s).toHaveLength(90);
		for (const r of s) expect(r).toBeCloseTo(0.9, 12);
	});
	test("each point is Σnum/Σden over d-29..d, ascending", () => {
		// num = 100 only on the last day: only the windows that include REF see it
		const rows = filas((f) => (f === REF ? 3000 : 0));
		const s = serieRolling(rows, REF);
		const den30 = rows.filter((r) => r.fecha >= sumarDias(REF, -29)).length;
		expect(s.at(-1)).toBeCloseTo(3000 / (den30 * 100), 12);
		expect(s.at(-2)).toBe(0);
	});
	test("windows without den are skipped; order of rows does not matter", () => {
		// rows only from ref-60 (a Saturday): window ends ref-89..ref-61 have Σden = 0
		const rows = filas((_, i) => i).filter(
			(r) => r.fecha >= sumarDias(REF, -60),
		);
		const s = serieRolling([...rows].reverse(), REF);
		expect(s).toHaveLength(61);
		expect(constancia(s)).not.toBeNull();
		expect(serieRolling([], REF)).toEqual([]);
	});
	test("rows outside ref-118..ref are ignored", () => {
		const extra = [
			{ fecha: sumarDias(REF, 1), num: 1e6, den: 1 },
			{ fecha: sumarDias(REF, -119), num: 1e6, den: 1 },
		];
		const s = serieRolling([...filas(() => 90), ...extra], REF);
		for (const r of s) expect(r).toBeCloseTo(0.9, 12);
	});
});
