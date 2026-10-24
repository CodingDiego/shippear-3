import { describe, expect, test } from "vitest";
import {
	AJUSTES_DEFAULT,
	type EngagementRow,
	JUEGOS,
	type JuegosConfig,
	type Premio,
} from "@/lib/domain";
import {
	type Celda,
	efectoVentas,
	engagementResumen,
	juegoActivo,
	valorPremios,
} from "./index";

describe("juegoActivo", () => {
	const cfg: JuegosConfig = {
		global: Object.fromEntries(
			JUEGOS.map((j) => [j, true]),
		) as JuegosConfig["global"],
		intervalos: [
			{ juego: "liga", sucursal: "caba", desde: "2026-02", hasta: "2026-05" },
			{ juego: "liga", sucursal: "caba", desde: "2026-08", hasta: null },
		],
	};
	test("global on and an interval covers the month, bounds inclusive", () => {
		expect(
			["2026-01", "2026-02", "2026-05", "2026-06", "2026-08", "2026-12"].map(
				(p) => juegoActivo(cfg, "liga", "caba", p),
			),
		).toEqual([false, true, true, false, true, true]);
		expect(juegoActivo(cfg, "liga", "moron", "2026-03")).toBe(false);
		expect(juegoActivo(cfg, "album", "caba", "2026-03")).toBe(false);
	});
});

// deterministic noise in [-1, 1]
const ruido = (i: number) => {
	const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
	return 2 * (x - Math.floor(x)) - 1;
};

describe("efectoVentas (TWFE)", () => {
	test("2x2 balanced panel equals the diff-in-diff exactly", () => {
		const celdas: Celda[] = [
			{ unidad: "A", periodoId: "m1", y: 1, activo: false },
			{ unidad: "A", periodoId: "m2", y: 3, activo: true },
			{ unidad: "B", periodoId: "m1", y: 2, activo: false },
			{ unidad: "B", periodoId: "m2", y: 2.5, activo: false },
		];
		const r = efectoVentas(celdas);
		expect(r.beta).toBeCloseTo(1.5, 9);
		expect(r).toMatchObject({ tratadas: 1, control: 3, sinControl: false });
	});

	// 6 sucursales x 5 sellers x 12 months, staggered adoption, two never treated.
	const BETA = 0.03;
	const inicio = [2, 5, 8, null, null, 10];
	const meses = Array.from(
		{ length: 12 },
		(_, t) => `m${String(t).padStart(2, "0")}`,
	);
	const vendedores = inicio.flatMap((_, s) =>
		Array.from({ length: 5 }, (_, k) => ({
			id: `s${s}v${k}`,
			s,
			alfa: 0.75 + 0.3 * ((s * 5 + k) / 30) + 0.05 * ruido(s * 7 + k),
		})),
	);
	const panel = vendedores.flatMap((v, vi) =>
		meses.map((periodoId, t) => {
			const activo = inicio[v.s] !== null && t >= (inicio[v.s] as number);
			const y =
				v.alfa +
				0.05 * Math.sin(t) +
				0.01 * t +
				(activo ? BETA : 0) +
				0.005 * ruido(vi * 100 + t);
			return { v, t, periodoId, activo, y };
		}),
	);

	test("seller unit, unbalanced panel: recovers beta within 10% despite unit and month effects", () => {
		// late hires and dropouts make it unbalanced, so demeaning needs several rounds
		const celdas = panel
			.filter(
				({ v, t }) =>
					!(v.id.endsWith("v4") && t < 4) && !(v.id.endsWith("v3") && t > 9),
			)
			.map(({ v, periodoId, y, activo }) => ({
				unidad: v.id,
				periodoId,
				y,
				activo,
			}));
		const r = efectoVentas(celdas);
		expect(Math.abs((r.beta as number) - BETA)).toBeLessThan(0.1 * BETA);
		expect(r.tratadas + r.control).toBe(celdas.length);
		// naive treated-minus-control mean is far off: the fixed effects matter
		const media = (xs: Celda[]) => xs.reduce((t, c) => t + c.y, 0) / xs.length;
		const naive =
			media(celdas.filter((c) => c.activo)) -
			media(celdas.filter((c) => !c.activo));
		expect(Math.abs(naive - BETA)).toBeGreaterThan(0.1 * BETA);
	});

	test("sucursal unit (mean of members per month): recovers the same beta", () => {
		const porCelda = new Map<
			string,
			{ s: number; periodoId: string; activo: boolean; ys: number[] }
		>();
		for (const c of panel) {
			const k = `${c.v.s}|${c.periodoId}`;
			const e = porCelda.get(k) ?? {
				s: c.v.s,
				periodoId: c.periodoId,
				activo: c.activo,
				ys: [],
			};
			e.ys.push(c.y);
			porCelda.set(k, e);
		}
		const celdas = [...porCelda.values()].map((e) => ({
			unidad: `s${e.s}`,
			periodoId: e.periodoId,
			y: e.ys.reduce((a, b) => a + b, 0) / e.ys.length,
			activo: e.activo,
		}));
		const r = efectoVentas(celdas);
		expect(celdas).toHaveLength(6 * 12);
		expect(Math.abs((r.beta as number) - BETA)).toBeLessThan(0.1 * BETA);
	});

	test("beta in kilos scales with the outcome", () => {
		const celdas = panel.map(({ v, periodoId, y, activo }) => ({
			unidad: v.id,
			periodoId,
			y: y * 4000,
			activo,
		}));
		expect(
			Math.abs((efectoVentas(celdas).beta as number) - BETA * 4000),
		).toBeLessThan(0.1 * BETA * 4000);
	});

	test("no control cells -> sin grupo de control; no treated cells -> beta null", () => {
		const todos = panel.map(({ v, periodoId, y }) => ({
			unidad: v.id,
			periodoId,
			y,
			activo: true,
		}));
		expect(efectoVentas(todos)).toEqual({
			beta: null,
			tratadas: todos.length,
			control: 0,
			sinControl: true,
		});
		const ninguno = todos.map((c) => ({ ...c, activo: false }));
		expect(efectoVentas(ninguno)).toEqual({
			beta: null,
			tratadas: 0,
			control: todos.length,
			sinControl: false,
		});
		expect(efectoVentas([])).toMatchObject({ beta: null, sinControl: true });
	});

	test("treatment absorbed by month effects (everyone switches on together) -> beta null", () => {
		const celdas = ["A", "B"].flatMap((unidad) =>
			["m1", "m2"].map((periodoId, t) => ({
				unidad,
				periodoId,
				y: t,
				activo: t === 1,
			})),
		);
		expect(efectoVentas(celdas).beta).toBeNull();
	});
});

describe("engagementResumen", () => {
	const row = (
		fecha: string,
		vendedorId: string,
		cantidad: number,
		fuente: EngagementRow["fuente"],
		juego: EngagementRow["juego"] = "liga",
	): EngagementRow => ({
		fecha,
		vendedorId,
		juego,
		evento: "vista",
		cantidad,
		fuente,
	});
	const rows = [
		row("2026-01-05", "V1", 3, "real"),
		row("2026-01-12", "V2", 2, "simulado"),
		row("2026-01-12", "V9", 5, "real"), // not eligible
		row("2026-01-19", "V3", 0, "real"), // zero is not activity
		row("2026-02-02", "V1", 1, "simulado"),
		row("2026-02-03", "V4", 2, "real"),
		row("2026-02-03", "V2", 7, "real", "album"), // other game
	];
	const r = engagementResumen(rows, "liga", {
		"2026-02": ["V1", "V2", "V3", "V4"],
		"2026-01": ["V1", "V2", "V3"],
		"2026-03": [],
	});

	test("active/eligible, events per active, month-over-month retention", () => {
		expect(r.meses.map(({ porFuente: _, reclamos: __, ...m }) => m)).toEqual([
			{
				periodoId: "2026-01",
				activos: 2,
				elegibles: 3,
				tasa: 2 / 3,
				eventosPorActivo: 2.5,
				retencion: null,
			},
			{
				periodoId: "2026-02",
				activos: 2,
				elegibles: 4,
				tasa: 0.5,
				eventosPorActivo: 1.5,
				retencion: 0.5,
			},
			{
				periodoId: "2026-03",
				activos: 0,
				elegibles: 0,
				tasa: null,
				eventosPorActivo: null,
				retencion: 0,
			},
		]);
		expect(r).toMatchObject({ juego: "liga", simulado: true });
	});

	test("split by fuente", () => {
		expect(r.meses[0].porFuente).toEqual({
			real: { activos: 1, eventos: 3 },
			simulado: { activos: 1, eventos: 2 },
		});
		expect(r.meses[1].porFuente).toEqual({
			real: { activos: 1, eventos: 2 },
			simulado: { activos: 1, eventos: 1 },
		});
	});

	test("only real rows -> simulado false", () => {
		expect(
			engagementResumen(rows, "album", { "2026-02": ["V2"] }),
		).toMatchObject({
			simulado: false,
			meses: [{ activos: 1, eventosPorActivo: 7 }],
		});
	});

	test("claims are counted per fuente, per month and over every month", () => {
		const reclamo = (
			fecha: string,
			cantidad: number,
			fuente: EngagementRow["fuente"],
		): EngagementRow => ({
			...row(fecha, "V1", cantidad, fuente),
			evento: "reclamo",
		});
		const e = engagementResumen(
			[
				...rows,
				reclamo("2026-02-02", 2, "simulado"),
				reclamo("2026-02-10", 1, "real"),
				reclamo("2026-10-24", 1, "real"), // outside elegibles: total only
			],
			"liga",
			{ "2026-02": ["V1"] },
		);
		expect(e.meses[0].reclamos).toEqual({ real: 1, simulado: 2 });
		expect(e.reclamos).toEqual({ real: 2, simulado: 2 });
		expect(r.reclamos).toEqual({ real: 0, simulado: 0 });
	});
});

describe("valorPremios", () => {
	const premio = (
		id: string,
		juego: Premio["juego"],
		costoArs: number,
		simulado = true,
	): Premio => ({
		id,
		juego,
		periodoId: "2026-09",
		descripcion: id,
		costoArs,
		simulado,
	});
	const premios = [
		premio("a", "liga", 1_000_000),
		premio("b", "liga", 1_000_000, false),
		premio("c", "album", 9_999),
	];

	test("value = beta kg x treated seller-months x valor_kg_ars; ROI = value / cost", () => {
		const r = valorPremios({
			juego: "liga",
			betaKg: 120,
			vendedorMesesTratados: 50,
			premios,
			ajustes: AJUSTES_DEFAULT,
		});
		expect(r).toEqual({
			juego: "liga",
			costoArs: 2_000_000,
			valorArs: 10_800_000,
			roi: 5.4,
			simulado: true,
		});
	});

	test("null beta -> null value and ROI; no prizes -> ROI null", () => {
		expect(
			valorPremios({
				juego: "liga",
				betaKg: null,
				vendedorMesesTratados: 50,
				premios,
				ajustes: AJUSTES_DEFAULT,
			}),
		).toMatchObject({ valorArs: null, roi: null });
		expect(
			valorPremios({
				juego: "revelacion",
				betaKg: 10,
				vendedorMesesTratados: 2,
				premios,
				ajustes: { ...AJUSTES_DEFAULT, valor_kg_ars: 1000 },
			}),
		).toEqual({
			juego: "revelacion",
			costoArs: 0,
			valorArs: 20_000,
			roi: null,
			simulado: false,
		});
	});
});
