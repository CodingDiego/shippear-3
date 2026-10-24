import { describe, expect, test } from "vitest";
import { KPI_IDS, type KpiId } from "../domain";
import { cmpGeneral, cmpKpi, cmpSucursal, rank } from "./rank";

const pts = (o: Partial<Record<KpiId, number>>) =>
	Object.fromEntries(KPI_IDS.map((k) => [k, o[k] ?? 50])) as Record<
		KpiId,
		number | null
	>;

describe("rank", () => {
	test("1-based, no shared positions, input untouched", () => {
		const input = [{ id: "b" }, { id: "a" }, { id: "c" }];
		const out = rank(input, (x, y) => x.id.localeCompare(y.id));
		expect(out.map((r) => [r.item.id, r.puesto])).toEqual([
			["a", 1],
			["b", 2],
			["c", 3],
		]);
		expect(input[0].id).toBe("b");
	});
});

describe("cmpGeneral", () => {
	test("equal score: higher venta points first", () => {
		const a = { id: "V1", score: 80, puntos: pts({ venta: 60 }) };
		const b = { id: "V2", score: 80, puntos: pts({ venta: 90 }) };
		expect(rank([a, b], cmpGeneral).map((r) => r.item.id)).toEqual([
			"V2",
			"V1",
		]);
	});
	test("tie order follows KPI_TIE_ORDER (venta then no_comp)", () => {
		const a = { id: "V1", score: 80, puntos: pts({ venta: 70, no_comp: 90 }) };
		const b = { id: "V2", score: 80, puntos: pts({ venta: 70, no_comp: 60 }) };
		expect(rank([b, a], cmpGeneral).map((r) => r.item.id)).toEqual([
			"V1",
			"V2",
		]);
	});
	test("equal everything: lower id first", () => {
		const a = { id: "V2", score: 80, puntos: pts({}) };
		const b = { id: "V1", score: 80, puntos: pts({}) };
		expect(rank([a, b], cmpGeneral).map((r) => r.item.id)).toEqual([
			"V1",
			"V2",
		]);
	});
	test("higher score wins", () => {
		const a = { id: "V1", score: 70, puntos: pts({}) };
		const b = { id: "V2", score: 71, puntos: pts({}) };
		expect(rank([a, b], cmpGeneral)[0].item.id).toBe("V2");
	});
});

describe("cmpKpi", () => {
	const x = (id: string, valor: number, den: number) => ({ id, valor, den });
	test("menor: lower valor first", () => {
		const out = rank([x("A", 0.2, 10), x("B", 0.1, 10)], cmpKpi("menor"));
		expect(out.map((r) => r.item.id)).toEqual(["B", "A"]);
	});
	test("mayor: higher valor first", () => {
		const out = rank([x("A", 0.2, 10), x("B", 0.1, 10)], cmpKpi("mayor"));
		expect(out.map((r) => r.item.id)).toEqual(["A", "B"]);
	});
	test("menor: equal valor -> larger den first, then id", () => {
		const out = rank(
			[x("A", 0.1, 10), x("B", 0.1, 50), x("C", 0.1, 50)],
			cmpKpi("menor"),
		);
		expect(out.map((r) => r.item.id)).toEqual(["B", "C", "A"]);
	});
});

describe("cmpSucursal", () => {
	test("score, then more miembros, then slug", () => {
		const s = (slug: string, score: number, miembros: number) => ({
			slug,
			score,
			miembros,
		});
		const out = rank(
			[s("z", 70, 3), s("b", 70, 3), s("m", 70, 5), s("q", 80, 1)],
			cmpSucursal,
		);
		expect(out.map((r) => r.item.slug)).toEqual(["q", "m", "b", "z"]);
	});
});
