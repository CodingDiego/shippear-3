import { describe, expect, test } from "vitest";
import {
	FECHA_INICIO,
	HOY,
	KPI_DEFS,
	KPI_IDS,
	METRICAS_DEFAULT,
	PERIODOS,
	periodosCerrados,
	SEASON_START,
	SUCURSAL_BY_SLUG,
	SUCURSALES,
} from "@/lib/domain";
import { scorePeriod } from "@/lib/scoring";
import { diaSemana, sumarDias } from "@/lib/time";
import { EFECTOS, generate, generateV2, JUEGOS_SEED } from "./generate";

const d = generate(42);
const g = generateV2(42);
const STOCK = new Set(["no_comp", "lanz"]);
const q = (xs: number[], p: number) =>
	[...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];

describe("generate (v1 shape)", () => {
	test("takes sucursales, periodos and defs from the domain", () => {
		expect(d.sucursales).toBe(SUCURSALES);
		expect(d.periodos).toBe(PERIODOS);
		expect(d.defs).toBe(KPI_DEFS);
		expect(d.sucursales).toHaveLength(16);
		expect(d.periodos).toHaveLength(13);
	});

	test("has 128-160 vendedores with valid sucursal", () => {
		expect(d.vendedores.length).toBeGreaterThanOrEqual(128);
		expect(d.vendedores.length).toBeLessThanOrEqual(160);
		for (const v of d.vendedores) {
			expect(SUCURSAL_BY_SLUG[v.sucursal]).toBeDefined();
		}
		expect(d.vendedores[0].id).toBe("V001");
	});

	test("exactly 10 mid-season hires, between 2026-01 and 2026-06", () => {
		const hires = d.vendedores.filter((v) => v.altaPeriodo > SEASON_START);
		expect(hires).toHaveLength(10);
		for (const v of hires) {
			expect(v.altaPeriodo >= "2026-01" && v.altaPeriodo <= "2026-06").toBe(
				true,
			);
		}
	});

	test("resultados cover every active month x 7 kpis", () => {
		const expected = d.vendedores.reduce(
			(n, v) =>
				n +
				PERIODOS.filter((p) => p.id >= v.altaPeriodo).length * KPI_IDS.length,
			0,
		);
		expect(d.resultados).toHaveLength(expected);
	});

	test("den > 0 and num >= 0", () => {
		for (const r of d.resultados) {
			expect(r.den).toBeGreaterThan(0);
			expect(r.num).toBeGreaterThanOrEqual(0);
		}
	});

	test("mean venta valor is within [0.9, 1.1]", () => {
		const rows = d.resultados.filter((r) => r.kpi === "venta");
		const mean = rows.reduce((s, r) => s + r.num / r.den, 0) / rows.length;
		expect(mean).toBeGreaterThanOrEqual(0.9);
		expect(mean).toBeLessThanOrEqual(1.1);
	});

	test("weights sum to 1", () => {
		const sum = KPI_IDS.reduce((s, k) => s + d.defs[k].peso, 0);
		expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
	});

	test("closed-month card scores stay close to v1 (median near 80, some under 65)", () => {
		const scores = periodosCerrados().flatMap((p) =>
			scorePeriod(d, p.id, "mes")
				.vendedores.map((v) => v.score)
				.filter((s): s is number => s !== null),
		);
		expect(q(scores, 0.5)).toBeGreaterThan(75);
		expect(q(scores, 0.5)).toBeLessThan(83);
		const bajo = scores.filter((s) => s < 65).length / scores.length;
		expect(bajo).toBeGreaterThan(0.05);
		expect(bajo).toBeLessThan(0.25);
		expect(scores.filter((s) => s >= 99.5).length / scores.length).toBeLessThan(
			0.03,
		);
	});
});

describe("generateV2", () => {
	test("is deterministic", () => {
		expect(generateV2(42)).toEqual(g);
	});

	test("a different seed differs", () => {
		expect(generateV2(43).diarios).not.toEqual(g.diarios);
	});

	test("monthly resultados are the aggregate of the days (flujo sum, stock last day)", () => {
		const agg = new Map<string, { num: number; den: number }>();
		for (const r of g.diarios) {
			const key = `${r.vendedorId}|${r.fecha.slice(0, 7)}|${r.kpi}`;
			const a = agg.get(key);
			if (!a) agg.set(key, { num: r.num, den: r.den });
			else if (STOCK.has(r.kpi))
				[a.num, a.den] = [r.num, r.den]; // diarios are in date order
			else [a.num, a.den] = [a.num + r.num, a.den + r.den];
		}
		expect(agg.size).toBe(g.dataset.resultados.length);
		for (const r of g.dataset.resultados) {
			expect(agg.get(`${r.vendedorId}|${r.periodoId}|${r.kpi}`)).toEqual({
				num: r.num,
				den: r.den,
			});
		}
	});

	test("days run Mon-Sat from FECHA_INICIO to HOY, HOY being the last date", () => {
		let max = "";
		let min = "9999";
		for (const r of g.diarios) {
			if (diaSemana(r.fecha) === 7) throw new Error(`Sunday ${r.fecha}`);
			if (r.fecha > max) max = r.fecha;
			if (r.fecha < min) min = r.fecha;
		}
		expect(max).toBe(HOY);
		expect(min).toBe(FECHA_INICIO);
	});

	test("rows are whole, non-negative and num <= den except venta", () => {
		for (const r of g.diarios) {
			if (!Number.isInteger(r.num) || r.num < 0 || r.den < 0)
				throw new Error(JSON.stringify(r));
			if (r.kpi !== "venta" && r.num > r.den)
				throw new Error(JSON.stringify(r));
		}
	});

	test("generates the seven KPIs plus degus, and seeds METRICAS_DEFAULT", () => {
		expect(new Set(g.diarios.map((r) => r.kpi))).toEqual(
			new Set([...KPI_IDS, "degus"]),
		);
		expect(g.dataset.metricas).toBe(METRICAS_DEFAULT);
	});

	test("a later hasta only appends days (Simular cierre de mes)", () => {
		const cierre = generateV2(42, "2026-10-31");
		expect(cierre.diarios.filter((r) => r.fecha <= HOY)).toEqual(g.diarios);
		expect(cierre.diarios.some((r) => r.fecha === "2026-10-31")).toBe(true);
	});

	test("every game has treated and control sucursal-months", () => {
		for (const juego of JUEGOS_SEED) {
			expect(g.juegos.global[juego]).toBe(true);
			let tratadas = 0;
			let control = 0;
			for (const s of SUCURSALES)
				for (const p of periodosCerrados()) {
					const on = g.juegos.intervalos.some(
						(i) =>
							i.juego === juego && i.sucursal === s.slug && p.id >= i.desde,
					);
					if (on) tratadas++;
					else control++;
				}
			expect(tratadas).toBeGreaterThan(0);
			expect(control).toBeGreaterThan(0);
			// switches inside the season, so the effect is identified within units
			expect(
				new Set(
					g.juegos.intervalos
						.filter((i) => i.juego === juego)
						.map((i) => i.desde),
				).size,
			).toBeGreaterThan(1);
		}
		expect(Object.keys(EFECTOS).sort()).toEqual([...JUEGOS_SEED].sort());
	});

	test("simulated engagement only where the game is on, weekly on Mondays", () => {
		const suc = new Map(g.dataset.vendedores.map((v) => [v.id, v.sucursal]));
		expect(g.engagement.length).toBeGreaterThan(0);
		for (const e of g.engagement) {
			expect(e.fuente).toBe("simulado");
			expect(diaSemana(e.fecha)).toBe(1);
			expect(e.cantidad).toBeGreaterThan(0);
			const on = g.juegos.intervalos.some(
				(i) =>
					i.juego === e.juego &&
					i.sucursal === suc.get(e.vendedorId) &&
					e.fecha.slice(0, 7) >= i.desde,
			);
			expect(on).toBe(true);
		}
	});

	test("planes: venta OV for every seller-month, the full month even in progress", () => {
		const den = new Map(
			g.dataset.resultados
				.filter((r) => r.kpi === "venta")
				.map((r) => [`${r.vendedorId}|${r.periodoId}`, r.den]),
		);
		expect(g.planes).toHaveLength(den.size);
		const cierre = generateV2(42, "2026-10-31");
		const denCierre = new Map(
			cierre.dataset.resultados
				.filter((r) => r.kpi === "venta")
				.map((r) => [`${r.vendedorId}|${r.periodoId}`, r.den]),
		);
		for (const p of g.planes) {
			const k = `${p.vendedorId}|${p.periodoId}`;
			expect(p.kpi).toBe("venta");
			expect(p.den).toBe(denCierre.get(k));
			if (p.periodoId === "2026-10")
				expect(p.den).toBeGreaterThan(den.get(k) ?? 0);
			else expect(p.den).toBe(den.get(k));
		}
	});

	test("simulated claims: first Monday of a month, for a month the game was on", () => {
		const reclamos = g.engagement.filter((e) => e.evento === "reclamo");
		expect(reclamos.length).toBeGreaterThan(0);
		const suc = new Map(g.dataset.vendedores.map((v) => [v.id, v.sucursal]));
		for (const e of reclamos) {
			expect(Number(e.fecha.slice(8))).toBeLessThanOrEqual(7);
			const antes = sumarDias(e.fecha, -7).slice(0, 7);
			expect(
				g.juegos.intervalos.some(
					(i) =>
						i.juego === e.juego &&
						i.sucursal === suc.get(e.vendedorId) &&
						antes >= i.desde,
				),
			).toBe(true);
		}
	});

	test("premios per game and month, simulated, with a cost", () => {
		expect(g.premios.length).toBeGreaterThan(0);
		for (const p of g.premios) {
			expect(p.simulado).toBe(true);
			expect(p.costoArs).toBeGreaterThan(0);
		}
		expect(new Set(g.premios.map((p) => p.id)).size).toBe(g.premios.length);
	});

	test("volatilidad spreads Constancia across sellers", () => {
		// SPEC-V2 Constancia at the end of 2026-09, computed here from the days.
		const ref = "2026-09-30";
		const venta = new Map<string, Map<string, [number, number]>>();
		for (const r of g.diarios) {
			if (r.kpi !== "venta") continue;
			const m = venta.get(r.vendedorId) ?? new Map();
			venta.set(r.vendedorId, m);
			m.set(r.fecha, [r.num, r.den]);
		}
		const valores: number[] = [];
		for (const m of venta.values()) {
			const serie: number[] = [];
			for (let i = 89; i >= 0; i--) {
				let num = 0;
				let den = 0;
				for (let j = 0; j < 30; j++) {
					const x = m.get(sumarDias(ref, -i - j));
					if (x) [num, den] = [num + x[0], den + x[1]];
				}
				if (den > 0) serie.push(num / den);
			}
			if (serie.length < 60) continue;
			const mean = serie.reduce((a, b) => a + b, 0) / serie.length;
			const sd = Math.sqrt(
				serie.reduce((a, b) => a + (b - mean) ** 2, 0) / (serie.length - 1),
			);
			valores.push(1 - Math.min(1, sd / mean / 0.5));
		}
		expect(valores.length).toBeGreaterThan(120);
		expect(q(valores, 0.1)).toBeLessThan(0.45);
		expect(q(valores, 0.5)).toBeGreaterThan(0.5);
		expect(q(valores, 0.9)).toBeGreaterThan(0.88);
	});
});
