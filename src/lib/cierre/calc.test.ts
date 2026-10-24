import { describe, expect, test } from "vitest";
import type { KpiDiario, Periodo } from "@/lib/domain";
import { constancia, serieRolling } from "@/lib/scoring";
import { generateV2 } from "@/lib/seed/generate";
import { habilesEntre, sumarDias } from "@/lib/time";
import { constanciasDe, diasRestantes, estadoDe, refConstancia } from "./calc";

const sep: Periodo = { id: "2026-09", label: "Sep", pesoMes: 1 };
const oct: Periodo = { id: "2026-10", label: "Oct", pesoMes: 1, enCurso: true };

/** Steady venta every working day from desde to hasta: attainment 1. */
const venta = (vendedorId: string, desde: string, hasta: string): KpiDiario[] =>
	habilesEntre({ desde, hasta }).map((fecha) => ({
		vendedorId,
		fecha,
		kpi: "venta",
		num: 100,
		den: 100,
	}));

describe("refConstancia", () => {
	test("closed: month end; in progress: the last day with data, or null", () => {
		expect(refConstancia(sep, "2026-09-12")).toBe("2026-09-30");
		expect(refConstancia(oct, "2026-10-24")).toBe("2026-10-24");
		expect(refConstancia(oct, null)).toBeNull();
	});
});

describe("constanciasDe", () => {
	const diarios = [
		...venta("V1", "2026-05-01", "2026-10-24"),
		{ vendedorId: "V1", fecha: "2026-10-24", kpi: "prod", num: 1, den: 9 },
	];

	test("one row per seller x period, at the period's reference date", () => {
		const filas = constanciasDe(["V1", "V2"], diarios, [sep, oct]);
		expect(filas.map(({ valor: _, ...f }) => f)).toEqual([
			{ vendedorId: "V1", periodoId: "2026-09", fecha: "2026-09-30" },
			{ vendedorId: "V2", periodoId: "2026-09", fecha: "2026-09-30" },
			{ vendedorId: "V1", periodoId: "2026-10", fecha: "2026-10-24" },
			{ vendedorId: "V2", periodoId: "2026-10", fecha: "2026-10-24" },
		]);
		// steady sales: cv 0, valor 1; a seller without rows has no value
		expect(filas.map((f) => f.valor)).toEqual([1, null, 1, null]);
	});

	test("a month in progress without data gets null rows", () => {
		const filas = constanciasDe(
			["V1"],
			venta("V1", "2026-05-01", "2026-09-30"),
			[oct],
		);
		expect(filas).toEqual([
			{ vendedorId: "V1", periodoId: "2026-10", fecha: null, valor: null },
		]);
	});

	test("matches the request-path computation on generated data", () => {
		const g = generateV2(42);
		const id = g.dataset.vendedores[7].id;
		const [fila] = constanciasDe([id], g.diarios, [sep]);
		const serie = g.diarios.filter(
			(r) =>
				r.vendedorId === id &&
				r.kpi === "venta" &&
				r.fecha >= sumarDias("2026-09-30", -118) &&
				r.fecha <= "2026-09-30",
		);
		expect(fila.valor).toBe(constancia(serieRolling(serie, "2026-09-30")));
		expect(fila.valor).not.toBeNull();
	});
});

describe("diasRestantes", () => {
	const g = generateV2(42, "2026-10-31");

	test("the month's rows after the last stored date", () => {
		const r = diasRestantes(g.diarios, "2026-10", "2026-10-24");
		expect(new Set(r.map((x) => x.fecha))).toEqual(
			new Set([
				"2026-10-26",
				"2026-10-27",
				"2026-10-28",
				"2026-10-29",
				"2026-10-30",
				"2026-10-31",
			]),
		);
		expect(diasRestantes(g.diarios, "2026-10", "2026-10-31")).toEqual([]);
	});

	test("null takes the whole month", () => {
		const r = diasRestantes(g.diarios, "2026-09", null);
		expect(r.length).toBeGreaterThan(0);
		expect(r.every((x) => x.fecha.startsWith("2026-09"))).toBe(true);
	});
});

describe("estadoDe", () => {
	test("in progress with days missing: nothing done", () => {
		expect(
			estadoDe({
				periodoId: "2026-10",
				enCurso: true,
				ultimaFecha: "2026-10-24",
				constanciasAlCierre: false,
			}),
		).toEqual({
			periodoId: "2026-10",
			enCurso: true,
			ultimaFecha: "2026-10-24",
			diasHabiles: 27,
			diasConDatos: 21,
			pasos: { dias: false, cerrado: false, constancias: false },
			listo: false,
		});
	});

	test("every step done: listo", () => {
		const e = estadoDe({
			periodoId: "2026-10",
			enCurso: false,
			ultimaFecha: "2026-10-31",
			constanciasAlCierre: true,
		});
		expect(e.pasos).toEqual({ dias: true, cerrado: true, constancias: true });
		expect(e.listo).toBe(true);
	});

	test("constancias only count once the month is closed", () => {
		const e = estadoDe({
			periodoId: "2026-10",
			enCurso: true,
			ultimaFecha: "2026-10-31",
			constanciasAlCierre: true,
		});
		expect(e.pasos).toEqual({ dias: true, cerrado: false, constancias: false });
	});
});
