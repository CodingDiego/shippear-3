import { describe, expect, test } from "vitest";
import {
	KPI_IDS,
	type KpiScore,
	PROVINCIAS,
	type ScoredSucursal,
	type ScoredVendedor,
	SUCURSAL_BY_SLUG,
} from "../domain";
import { rankProvincias } from "./provincia";

const kpis = (p: number) =>
	Object.fromEntries(
		KPI_IDS.map((k): [string, KpiScore] => [
			k,
			{ kpi: k, valor: 1, attainment: 1, puntos: p, puesto: 1, de: 1 },
		]),
	);

const v = (
	id: string,
	sucursal: string,
	score: number | null,
): ScoredVendedor => ({
	vendedor: {
		id,
		nombre: id,
		apellido: id,
		sucursal,
		canal: "plaza",
		altaPeriodo: "2025-10",
	},
	periodoId: "2026-09",
	vista: "mes",
	score,
	tier: null,
	puesto: null,
	de: 0,
	puestoSucursal: null,
	deSucursal: 0,
	kpis: kpis(score ?? 0),
});

const s = (
	slug: string,
	score: number | null,
	miembros: number,
): ScoredSucursal => ({
	sucursal: SUCURSAL_BY_SLUG[slug],
	score,
	tier: null,
	puesto: null,
	miembros,
});

// buenos-aires: moron (80, 70), quilmes (90, null); santa-fe: rosario (60); caba: caba (70)
const input = {
	vendedores: [
		v("V1", "moron", 80),
		v("V2", "moron", 70),
		v("V3", "quilmes", 90),
		v("V4", "quilmes", null),
		v("V5", "rosario", 60),
		v("V6", "caba", 70),
	],
	sucursales: [
		s("moron", 75, 2),
		s("quilmes", 90, 1),
		s("rosario", 60, 1),
		s("caba", 70, 1),
		s("salta", null, 0),
	],
};

const by = <T>(xs: T[], f: (x: T) => boolean) => {
	const x = xs.find(f);
	if (!x) throw new Error("missing");
	return x;
};

describe("rankProvincias", () => {
	const out = rankProvincias(input);
	const vend = (id: string) => by(out.vendedores, (x) => x.vendedor.id === id);

	test("sellers ranked inside their province, unscored get null", () => {
		expect(vend("V3").puestoProvincia).toBe(1);
		expect(vend("V1").puestoProvincia).toBe(2);
		expect(vend("V2").puestoProvincia).toBe(3);
		expect(vend("V4").puestoProvincia).toBeNull();
		for (const id of ["V1", "V2", "V3", "V4"])
			expect(vend(id).deProvincia).toBe(3);
		expect(vend("V5")).toMatchObject({ puestoProvincia: 1, deProvincia: 1 });
	});

	test("sucursales ranked inside their province", () => {
		const suc = (slug: string) =>
			by(out.sucursales, (x) => x.sucursal.slug === slug);
		expect(suc("quilmes").puestoProvincia).toBe(1);
		expect(suc("moron").puestoProvincia).toBe(2);
		expect(suc("rosario").puestoProvincia).toBe(1);
		expect(suc("salta").puestoProvincia).toBeNull();
	});

	test("provincias: every province, mean of seller scores, nulls last", () => {
		expect(out.provincias).toHaveLength(PROVINCIAS.length);
		expect(
			out.provincias
				.slice(0, 3)
				.map((p) => [p.provincia.slug, p.score, p.puesto, p.miembros]),
		).toEqual([
			["buenos-aires", 80, 1, 3],
			["caba", 70, 2, 1],
			["santa-fe", 60, 3, 1],
		]);
		const ba = by(out.provincias, (p) => p.provincia.slug === "buenos-aires");
		expect(ba.tier).toBe("verde");
		expect(ba.sucursales).toBe(2);
		const rest = out.provincias.slice(3);
		expect(rest.every((p) => p.score === null && p.puesto === null)).toBe(true);
		expect(rest.map((p) => p.provincia.slug)).toEqual(
			[...rest.map((p) => p.provincia.slug)].sort(),
		);
	});

	test("equal province scores: more scored members first", () => {
		const r = rankProvincias({
			vendedores: [
				v("A", "caba", 70),
				v("B", "rosario", 70),
				v("C", "santa-fe", 70),
			],
			sucursales: [],
		});
		expect(r.provincias.slice(0, 2).map((p) => p.provincia.slug)).toEqual([
			"santa-fe",
			"caba",
		]);
	});

	test("pure: input untouched", () => {
		expect(input.vendedores[0].puestoProvincia).toBeUndefined();
		expect(input.sucursales[0].puestoProvincia).toBeUndefined();
	});
});
