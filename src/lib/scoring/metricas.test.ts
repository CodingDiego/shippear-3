import { describe, expect, test } from "vitest";
import {
	CONSTANCIA_ID,
	type Dataset,
	KPI_DEFS,
	KPI_IDS,
	type KpiResultado,
	METRICAS_DEFAULT,
	type MetricaDef,
	metricasDe,
	PERIODOS,
	SUCURSALES,
	type Vendedor,
} from "../domain";
import { attainment, puntos } from "./kpi";
import { scorePeriodV2 } from "./metricas";
import { scorePeriod } from "./period";

const SEP = "2026-09";
const DEN = 100;

const vend = (id: string, sucursal: string): Vendedor => ({
	id,
	nombre: id,
	apellido: id,
	sucursal,
	canal: "plaza",
	altaPeriodo: "2025-10",
});
const vendedores = [
	vend("V1", "moron"),
	vend("V2", "quilmes"),
	vend("V3", "rosario"),
	vend("V4", "rosario"),
];
// attainment factor on every base KPI; venta is reversed
const F: Record<string, number> = { V1: 1, V2: 0.9, V3: 0.8, V4: 0.7 };
const VENTA: Record<string, number> = { V1: 0.6, V2: 0.8, V3: 1, V4: 1.1 };
const DEGUS: Record<string, number> = { V1: 0.45, V2: 0.9, V3: 0.9, V4: 0.99 };

const degus = METRICAS_DEFAULT.find((m) => m.id === "degus") as MetricaDef;
const constanciaDef = METRICAS_DEFAULT.find(
	(m) => m.id === CONSTANCIA_ID,
) as MetricaDef;

function dataset(): Dataset {
	const resultados: KpiResultado[] = [];
	for (const v of vendedores) {
		for (const k of KPI_IDS) {
			const d = KPI_DEFS[k];
			const fac = k === "venta" ? VENTA[v.id] : F[v.id];
			const valor =
				d.direccion === "mayor" ? d.objetivo * fac : d.objetivo / fac;
			resultados.push({
				vendedorId: v.id,
				periodoId: SEP,
				kpi: k,
				num: valor * DEN,
				den: DEN,
			});
		}
		resultados.push({
			vendedorId: v.id,
			periodoId: SEP,
			kpi: "degus",
			num: DEGUS[v.id] * DEN,
			den: DEN,
		});
	}
	return {
		sucursales: SUCURSALES,
		vendedores,
		periodos: PERIODOS,
		defs: KPI_DEFS,
		resultados,
	};
}

const by = (sp: ReturnType<typeof scorePeriod>, id: string) => {
	const v = sp.vendedores.find((x) => x.vendedor.id === id);
	if (!v) throw new Error(`missing ${id}`);
	return v;
};
const pts = (f: number) => puntos(Math.min(1.1, f));
const base = metricasDe(KPI_DEFS);
const d = dataset();

describe("scorePeriodV2", () => {
	test("base metrics only: same result as v1 scorePeriod", () => {
		for (const vista of ["mes", "acum", "mix"] as const) {
			const a = scorePeriodV2(d, SEP, vista, { defs: base });
			const b = scorePeriod(d, SEP, vista);
			expect(a.vendedores.map((v) => [v.vendedor.id, v.puesto])).toEqual(
				b.vendedores.map((v) => [v.vendedor.id, v.puesto]),
			);
			for (const v of a.vendedores)
				expect(v.score).toBeCloseTo(by(b, v.vendedor.id).score as number, 9);
		}
	});

	test("deactivating venta renormalises over the other six", () => {
		const defs = base.map((m) =>
			m.id === "venta" ? { ...m, activa: false } : m,
		);
		const sp = scorePeriodV2(d, SEP, "mes", { defs });
		expect(sp.vendedores.map((v) => v.vendedor.id)).toEqual([
			"V1",
			"V2",
			"V3",
			"V4",
		]);
		for (const v of sp.vendedores) {
			expect(v.score).toBeCloseTo(pts(F[v.vendedor.id]), 9);
			expect(v.kpis.venta).toMatchObject({
				valor: null,
				puntos: null,
				puesto: null,
				de: 0,
			});
		}
		// with venta active the reversed venta pulls V1 down
		const all = scorePeriodV2(d, SEP, "mes", { defs: base });
		expect(by(all, "V1").score).toBeLessThan(by(sp, "V1").score as number);
	});

	test("an active custom metric scores with peso / Σ peso", () => {
		const defs = [...base, { ...degus, activa: true }];
		const sp = scorePeriodV2(d, SEP, "mes", { defs });
		const v1 = by(sp, "V1");
		expect(v1.kpis.degus.valor).toBeCloseTo(0.45, 9);
		expect(v1.kpis.degus.puntos).toBeCloseTo(pts(0.5), 9);
		expect(v1.kpis.degus.puesto).toBe(4);
		expect(v1.kpis.degus.de).toBe(4);
		const sinDegus = by(scorePeriodV2(d, SEP, "mes", { defs: base }), "V1");
		const esperado = ((sinDegus.score as number) * 1 + 0.05 * pts(0.5)) / 1.05;
		expect(v1.score).toBeCloseTo(esperado, 9);
		for (const v of sp.vendedores) {
			expect(v.score).toBeGreaterThanOrEqual(0);
			expect(v.score).toBeLessThanOrEqual(100);
		}
	});

	test("an inactive custom metric is absent; the seven KPI_IDS are always there", () => {
		const sp = scorePeriodV2(d, SEP, "mes", { defs: METRICAS_DEFAULT });
		const v = by(sp, "V2");
		expect(v.kpis.degus).toBeUndefined();
		for (const k of KPI_IDS) expect(v.kpis[k]).toBeDefined();
		expect(v.kpis[CONSTANCIA_ID]).toBeDefined();
	});

	test("constancia: valor from opts, same for every vista, null renormalises", () => {
		const defs = [...base, constanciaDef];
		const constancia = { V1: 0.8, V2: 0.4, V3: null };
		for (const vista of ["mes", "acum", "mix"] as const) {
			const sp = scorePeriodV2(d, SEP, vista, { defs, constancia });
			const c1 = by(sp, "V1").kpis[CONSTANCIA_ID];
			expect(c1.valor).toBe(0.8);
			expect(c1.attainment).toBeCloseTo(1, 9);
			expect(c1.puntos).toBeCloseTo(puntos(attainment(constanciaDef, 0.8)), 9);
			expect(c1.puesto).toBe(1);
			expect(c1.de).toBe(2);
			expect(by(sp, "V3").kpis[CONSTANCIA_ID].valor).toBeNull();
			expect(by(sp, "V4").kpis[CONSTANCIA_ID].puesto).toBeNull();
			const sinC = by(scorePeriodV2(d, SEP, vista, { defs: base }), "V3");
			expect(by(sp, "V3").score).toBeCloseTo(sinC.score as number, 9);
		}
	});

	test("fills the province layer", () => {
		const sp = scorePeriodV2(d, SEP, "mes", { defs: base });
		expect(by(sp, "V3")).toMatchObject({ puestoProvincia: 1, deProvincia: 2 });
		expect(by(sp, "V4")).toMatchObject({ puestoProvincia: 2, deProvincia: 2 });
		expect(sp.provincias).toHaveLength(10);
		expect(sp.provincias?.[0].miembros).toBeGreaterThan(0);
		const rosario = sp.sucursales.find((s) => s.sucursal.slug === "rosario");
		expect(rosario?.puestoProvincia).toBe(1);
	});

	test("v1 scorePeriod uses dataset.metricas when present", () => {
		const defs = base.map((m) =>
			m.id === "venta" ? { ...m, activa: false } : m,
		);
		const sp = scorePeriod({ ...d, metricas: defs }, SEP, "mes");
		expect(by(sp, "V1").kpis.venta.valor).toBeNull();
		expect(sp.provincias).toHaveLength(10);
	});
});
