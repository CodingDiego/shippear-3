import { describe, expect, test } from "vitest";
import {
	type Dataset,
	KPI_DEFS,
	KPI_IDS,
	type KpiId,
	type KpiResultado,
	PERIODOS,
	SUCURSALES,
	type Vendedor,
} from "../domain";
import { scorePeriod } from "./period";
import { rescore } from "./score";

const DEN = 100;
const OCT = "2025-10";
const NOV = "2025-11";

const sucursales = [
	{ slug: "a", nombre: "A", region: "AMBA" as const, vecina: "b" },
	{ slug: "b", nombre: "B", region: "AMBA" as const, vecina: "a" },
	{ slug: "c", nombre: "C", region: "Interior" as const, vecina: "a" },
];

const vend = (id: string, sucursal: string, altaPeriodo = OCT): Vendedor => ({
	id,
	nombre: id,
	apellido: id,
	sucursal,
	canal: "plaza",
	altaPeriodo,
});

const vendedores = [
	vend("V1", "a"),
	vend("V2", "a"),
	vend("V3", "b"),
	vend("V4", "b"),
	vend("V5", "c"),
	vend("V6", "c", NOV),
];

// attainment factor per vendedor/periodo: score = 100 * f / 1.1 on every KPI
const F: Record<string, Record<string, number>> = {
	V1: { [OCT]: 1, [NOV]: 0.8 },
	V2: { [OCT]: 0.9, [NOV]: 1 },
	V3: { [OCT]: 0.8, [NOV]: 0.7 },
	V4: { [OCT]: 0.7, [NOV]: 0.9 },
	V5: { [OCT]: 0.6, [NOV]: 0.5 },
	V6: { [NOV]: 0.6 },
};

function build(opts: {
	f?: (vid: string, p: string, k: KpiId) => number;
	kpis?: (vid: string) => readonly KpiId[];
}): Dataset {
	const f = opts.f ?? ((v, p) => F[v][p]);
	const resultados: KpiResultado[] = [];
	for (const v of vendedores) {
		for (const p of Object.keys(F[v.id])) {
			for (const k of opts.kpis?.(v.id) ?? KPI_IDS) {
				const d = KPI_DEFS[k];
				const fac = f(v.id, p, k);
				const valor =
					d.direccion === "mayor" ? d.objetivo * fac : d.objetivo / fac;
				resultados.push({
					vendedorId: v.id,
					periodoId: p,
					kpi: k,
					num: valor * DEN,
					den: DEN,
				});
			}
		}
	}
	return {
		sucursales,
		vendedores,
		periodos: PERIODOS.slice(0, 2),
		defs: KPI_DEFS,
		resultados,
	};
}

const by = (
	sp: { vendedores: ReturnType<typeof scorePeriod>["vendedores"] },
	id: string,
) => {
	const v = sp.vendedores.find((x) => x.vendedor.id === id);
	if (!v) throw new Error(`missing ${id}`);
	return v;
};

describe("scorePeriod", () => {
	const data = build({});

	test("alta after the period is excluded; de counts the rest", () => {
		const sp = scorePeriod(data, OCT, "mes");
		expect(sp.vendedores.map((v) => v.vendedor.id)).not.toContain("V6");
		expect(sp.vendedores).toHaveLength(5);
		for (const v of sp.vendedores) expect(v.de).toBe(5);
		const nov = scorePeriod(data, NOV, "mes");
		expect(nov.vendedores).toHaveLength(6);
		for (const v of nov.vendedores) expect(v.de).toBe(6);
	});

	test("mes scores, tiers and ordering (Oct)", () => {
		const sp = scorePeriod(data, OCT, "mes");
		expect(sp.vendedores.map((v) => v.vendedor.id)).toEqual([
			"V1",
			"V2",
			"V3",
			"V4",
			"V5",
		]);
		expect(by(sp, "V1").score).toBeCloseTo(90.91, 2);
		expect(by(sp, "V1").tier).toBe("verde");
		expect(by(sp, "V3").score).toBeCloseTo(72.73, 2);
		expect(by(sp, "V3").tier).toBe("amarillo");
		expect(by(sp, "V5").tier).toBe("rojo");
		expect(by(sp, "V5").puesto).toBe(5);
	});

	test("Nov mes ranking", () => {
		const sp = scorePeriod(data, NOV, "mes");
		expect(sp.vendedores.map((v) => [v.vendedor.id, v.puesto])).toEqual([
			["V2", 1],
			["V4", 2],
			["V1", 3],
			["V3", 4],
			["V6", 5],
			["V5", 6],
		]);
	});

	test("per-KPI rank is direction-aware (menor: lower valor first)", () => {
		const sp = scorePeriod(data, NOV, "mes");
		expect(by(sp, "V2").kpis.no_comp.puesto).toBe(1);
		expect(by(sp, "V5").kpis.no_comp.puesto).toBe(6);
		expect(by(sp, "V2").kpis.no_comp.valor).toBeCloseTo(0.1, 3);
		expect(by(sp, "V5").kpis.no_comp.valor).toBeCloseTo(0.2, 3);
		expect(by(sp, "V2").kpis.venta.puesto).toBe(1);
		expect(by(sp, "V2").kpis.venta.de).toBe(6);
	});

	test("acum for Nov uses both months", () => {
		const sp = scorePeriod(data, NOV, "acum");
		const venta = by(sp, "V1").kpis.venta;
		expect(venta.valor).toBeCloseTo(0.9, 3); // (100 + 80) / 200
		expect(venta.puntos).toBeCloseTo(81.82, 2);
		const noComp = by(sp, "V1").kpis.no_comp;
		expect(noComp.valor).toBeCloseTo(0.1125, 4); // (10 + 12.5) / 200
		expect(noComp.puntos).toBeCloseTo(80.81, 2);
		// V6 only has Nov: acum == mes
		expect(by(sp, "V6").kpis.venta.valor).toBeCloseTo(0.6, 3);
	});

	test("mix blends puntos with pesoMes, valor shown is the month's", () => {
		const sp = scorePeriod(data, NOV, "mix");
		const venta = by(sp, "V1").kpis.venta;
		expect(venta.valor).toBeCloseTo(0.8, 3);
		expect(venta.puntos).toBeCloseTo((72.73 + 81.82) / 2, 2);
		expect(venta.attainment).toBeCloseTo((venta.puntos as number) * 0.011, 3);
	});

	test("puestoSucursal is 1..n inside each sucursal", () => {
		const sp = scorePeriod(data, NOV, "mes");
		const ps = (slug: string) =>
			sp.vendedores
				.filter((v) => v.vendedor.sucursal === slug)
				.map((v) => [v.vendedor.id, v.puestoSucursal, v.deSucursal])
				.sort();
		expect(ps("a")).toEqual([
			["V1", 2, 2],
			["V2", 1, 2],
		]);
		expect(ps("b")).toEqual([
			["V3", 2, 2],
			["V4", 1, 2],
		]);
		expect(ps("c")).toEqual([
			["V5", 2, 2],
			["V6", 1, 2],
		]);
	});

	test("sucursal means and puesto", () => {
		const oct = scorePeriod(data, OCT, "mes");
		expect(oct.sucursales.map((s) => s.sucursal.slug)).toEqual(["a", "b", "c"]);
		expect(oct.sucursales[0].score).toBeCloseTo(86.36, 2);
		expect(oct.sucursales[1].score).toBeCloseTo(68.18, 2);
		expect(oct.sucursales[2].score).toBeCloseTo(54.55, 2);
		expect(oct.sucursales.map((s) => s.puesto)).toEqual([1, 2, 3]);
		expect(oct.sucursales.map((s) => s.miembros)).toEqual([2, 2, 1]);
		const nov = scorePeriod(data, NOV, "mes");
		expect(nov.sucursales.map((s) => s.score?.toFixed(2))).toEqual([
			"81.82",
			"72.73",
			"50.00",
		]);
		expect(nov.sucursales[0].tier).toBe("verde");
		expect(nov.sucursales[2].tier).toBe("rojo");
	});

	test("vendedor with only venta+prod rows: score/puesto null, de counts scored only", () => {
		const sparse = build({
			kpis: (vid) => (vid === "V5" ? ["venta", "prod"] : KPI_IDS),
		});
		const sp = scorePeriod(sparse, OCT, "mes");
		const v5 = by(sp, "V5");
		expect(v5.score).toBeNull();
		expect(v5.tier).toBeNull();
		expect(v5.puesto).toBeNull();
		expect(v5.puestoSucursal).toBeNull();
		expect(v5.deSucursal).toBe(0);
		expect(v5.kpis.lanz.valor).toBeNull();
		expect(v5.kpis.lanz.puesto).toBeNull();
		expect(v5.kpis.venta.de).toBe(5);
		expect(sp.vendedores.at(-1)?.vendedor.id).toBe("V5");
		for (const v of sp.vendedores) expect(v.de).toBe(4);
		const c = sp.sucursales.find((s) => s.sucursal.slug === "c");
		expect(c?.score).toBeNull();
		expect(c?.puesto).toBeNull();
		expect(sp.sucursales.at(-1)?.sucursal.slug).toBe("c");
	});

	test("den <= 0 gives a null valor", () => {
		const d = build({});
		for (const r of d.resultados)
			if (r.vendedorId === "V1" && r.kpi === "prod") r.den = 0;
		const v1 = by(scorePeriod(d, OCT, "mes"), "V1");
		expect(v1.kpis.prod.valor).toBeNull();
		expect(v1.kpis.prod.puntos).toBeNull();
		expect(v1.score).toBeCloseTo(90.91, 2); // renormalised
	});
});

describe("rescore", () => {
	// venta is reversed relative to every other KPI
	const VENTA: Record<string, number> = {
		V1: 0.6,
		V2: 0.7,
		V3: 0.8,
		V4: 0.9,
		V5: 1,
	};
	const data = build({
		f: (v, p, k) => (k === "venta" ? VENTA[v] : F[v][p]),
	});
	const sp = scorePeriod(data, OCT, "mes");
	const ventaOnly = Object.fromEntries(
		KPI_IDS.map((k) => [k, k === "venta" ? 1 : 0]),
	) as Record<KpiId, number>;

	test("all weight on venta -> venta points order, tiers update", () => {
		expect(sp.vendedores[0].vendedor.id).toBe("V1");
		const r = rescore(sp, ventaOnly);
		expect(r.vendedores.map((v) => v.vendedor.id)).toEqual([
			"V5",
			"V4",
			"V3",
			"V2",
			"V1",
		]);
		for (const v of r.vendedores)
			expect(v.score).toBeCloseTo(v.kpis.venta.puntos as number, 6);
		expect(by(r, "V5").tier).toBe("verde");
		expect(by(r, "V1").tier).toBe("rojo");
		expect(by(r, "V5").puesto).toBe(1);
		expect(by(r, "V5").puestoSucursal).toBe(1);
		expect(r.sucursales.map((s) => s.sucursal.slug)).toEqual(["c", "b", "a"]);
		expect(r.sucursales[0].score).toBeCloseTo(90.91, 2);
		// input untouched
		expect(sp.vendedores[0].vendedor.id).toBe("V1");
	});

	test("50% rule is relative to the given weights", () => {
		const sparse = build({
			kpis: (vid) => (vid === "V5" ? ["venta", "prod"] : KPI_IDS),
		});
		const s = scorePeriod(sparse, OCT, "mes");
		expect(by(s, "V5").score).toBeNull();
		const pesos = Object.fromEntries(
			KPI_IDS.map((k) => [k, k === "venta" ? 1 : 0.1]),
		) as Record<KpiId, number>;
		const r = rescore(s, pesos); // available 1.1 of 1.6
		expect(by(r, "V5").score).not.toBeNull();
		expect(by(r, "V5").puesto).not.toBeNull();
	});
});

describe("performance", () => {
	test("140 vendedores x 12 periodos x 7 kpis under 200 ms", () => {
		const vs: Vendedor[] = Array.from({ length: 140 }, (_, i) => ({
			id: `V${String(i + 1).padStart(3, "0")}`,
			nombre: "n",
			apellido: "a",
			sucursal: SUCURSALES[i % 16].slug,
			canal: i % 2 ? "plaza" : "campaña",
			altaPeriodo: PERIODOS[0].id,
		}));
		const resultados: KpiResultado[] = [];
		vs.forEach((v, i) => {
			PERIODOS.forEach((p, j) => {
				KPI_IDS.forEach((k, m) => {
					const d = KPI_DEFS[k];
					const fac = 0.6 + ((i * 7 + j * 3 + m * 5) % 50) / 100;
					const valor =
						d.direccion === "mayor" ? d.objetivo * fac : d.objetivo / fac;
					resultados.push({
						vendedorId: v.id,
						periodoId: p.id,
						kpi: k,
						num: valor * 200,
						den: 200,
					});
				});
			});
		});
		const data: Dataset = {
			sucursales: SUCURSALES,
			vendedores: vs,
			periodos: PERIODOS,
			defs: KPI_DEFS,
			resultados,
		};
		const t0 = performance.now();
		const sp = scorePeriod(data, PERIODOS[11].id, "mix");
		const ms = performance.now() - t0;
		expect(sp.vendedores).toHaveLength(140);
		expect(sp.sucursales).toHaveLength(16);
		expect(ms).toBeLessThan(200);
	});
});
