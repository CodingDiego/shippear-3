import { describe, expect, test } from "vitest";
import { KPI_DEFS, KPI_IDS, type KpiId } from "../domain";
import { attainment, puntos } from "./kpi";
import { blendVista, cardScore } from "./score";

const all = (v: number | null): Record<KpiId, number | null> =>
	Object.fromEntries(KPI_IDS.map((k) => [k, v])) as Record<
		KpiId,
		number | null
	>;

describe("cardScore", () => {
	test("every KPI exactly on target -> 90.91", () => {
		const p = Object.fromEntries(
			KPI_IDS.map((k) => [
				k,
				puntos(attainment(KPI_DEFS[k], KPI_DEFS[k].objetivo)),
			]),
		) as Record<KpiId, number | null>;
		expect(cardScore(p, KPI_DEFS)).toBeCloseTo(90.91, 2);
	});
	test("relev null renormalises over 0.95", () => {
		const p = { ...all(50), venta: 100, relev: null };
		expect(cardScore(p, KPI_DEFS)).toBeCloseTo((30 + 0.65 * 50) / 0.95, 2);
	});
	test("only venta+prod (0.40) -> null", () => {
		const p = { ...all(null), venta: 100, prod: 100 };
		expect(cardScore(p, KPI_DEFS)).toBeNull();
	});
	test("exactly half the weight is enough", () => {
		// venta .30 + lanz .15 + relev .05 = .50
		const p = { ...all(null), venta: 80, lanz: 80, relev: 80 };
		expect(cardScore(p, KPI_DEFS)).toBeCloseTo(80, 2);
	});
});

describe("blendVista", () => {
	test("blends, falls back, nulls", () => {
		expect(blendVista(100, 80, 0.5)).toBeCloseTo(90, 2);
		expect(blendVista(null, 80, 0.5)).toBe(80);
		expect(blendVista(100, null, 0.5)).toBe(100);
		expect(blendVista(null, null, 0.5)).toBeNull();
	});
});
