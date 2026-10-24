import { describe, expect, test } from "vitest";
import { KPI_DEFS, TOPE } from "../domain";
import { attainment, kpiValue, puntos } from "./kpi";

describe("kpiValue", () => {
	test("null when den <= 0 or undefined", () => {
		expect(kpiValue({ num: 5, den: 0 })).toBeNull();
		expect(kpiValue({ num: 5, den: -1 })).toBeNull();
		expect(kpiValue(undefined)).toBeNull();
	});
	test("num/den", () => {
		expect(kpiValue({ num: 52, den: 50 })).toBeCloseTo(1.04, 2);
	});
});

describe("attainment and puntos", () => {
	test("menor: lower valor is better", () => {
		const a = attainment(KPI_DEFS.no_comp, 0.21);
		expect(a).toBeCloseTo(0.476, 3);
		expect(puntos(a)).toBeCloseTo(43.29, 2);
		expect(attainment(KPI_DEFS.no_comp, 0.05)).toBe(TOPE);
	});
	test("menor: valor 0 is the cap", () => {
		expect(attainment(KPI_DEFS.no_comp, 0)).toBe(TOPE);
		expect(puntos(attainment(KPI_DEFS.no_comp, 0))).toBeCloseTo(100, 2);
	});
	test("mayor: venta 1.04 and 1.20", () => {
		expect(attainment(KPI_DEFS.venta, 1.04)).toBeCloseTo(1.04, 2);
		expect(puntos(attainment(KPI_DEFS.venta, 1.04))).toBeCloseTo(94.55, 2);
		expect(attainment(KPI_DEFS.venta, 1.2)).toBeCloseTo(1.1, 2);
		expect(puntos(attainment(KPI_DEFS.venta, 1.2))).toBeCloseTo(100, 2);
	});
	test("mayor: negative valor clamps to 0", () => {
		expect(attainment(KPI_DEFS.venta, -1)).toBe(0);
	});
});
