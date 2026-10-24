import { describe, expect, test } from "vitest";
import {
	JUEGOS,
	type JuegoId,
	type JuegosConfig,
	KPI_IDS,
	METRICAS_DEFAULT,
	type ScoredPeriod,
} from "@/lib/domain";
import { album, albumDe, figusV2, rarezasDe } from "./album";
import { dataset, mesId, periodo, temporada } from "./fixtures";
import { liga } from "./liga";
import { revelacion } from "./revelacion";

// fixtures: attainment = puntos / 100 * 1.1, so puntos >= 90.91 meets the objetivo.
const SI = 100;
const NO = 50;

const config = (
	intervalos: [JuegoId, string, string, string | null][],
	global: Partial<Record<JuegoId, boolean>> = {},
): JuegosConfig => ({
	global: Object.fromEntries(
		JUEGOS.map((j) => [j, global[j] ?? true]),
	) as JuegosConfig["global"],
	intervalos: intervalos.map(([juego, sucursal, desde, hasta]) => ({
		juego,
		sucursal,
		desde,
		hasta,
	})),
});
const albumEn = (...sucursales: string[]) =>
	config(sucursales.map((s) => ["album", s, "2025-01", null]));

describe("figus v2 shares, medals and order", () => {
	// 20 sellers; venta met by 1 (5%), prod by 4 (20%), lanz by 9 (45%), cobr by 10 (50%).
	const ids = Array.from(
		{ length: 20 },
		(_, i) => `V${String(i).padStart(2, "0")}`,
	);
	const filas = ids.map((id, i) => ({
		id,
		score: null,
		puntos: {
			venta: i < 1 ? SI : NO,
			prod: i < 4 ? SI - i : NO,
			lanz: i < 9 ? SI : NO,
			cobr: i < 10 ? SI : NO,
		},
	}));
	const periods = [periodo(mesId(0), filas)];
	const figus = figusV2(
		periods,
		dataset(periods),
		METRICAS_DEFAULT,
		albumEn("caba"),
	);
	const de = (m: string) => figus.filter((f) => f.metrica === m);

	test("p is the share of sellers with data who met the objetivo", () => {
		expect(de("venta").map((f) => f.p)).toEqual([0.05]);
		expect(new Set(de("prod").map((f) => f.p))).toEqual(new Set([0.2]));
		expect(new Set(de("lanz").map((f) => f.p))).toEqual(new Set([0.45]));
		expect(new Set(de("cobr").map((f) => f.p))).toEqual(new Set([0.5]));
	});

	test("metrics without data or not met give nothing; one figu per seller who met it", () => {
		expect(de("no_comp")).toEqual([]);
		expect(de("prod").map((f) => f.vendedorId)).toEqual(ids.slice(0, 4));
		expect(figus.filter((f) => f.vendedorId === "V19")).toEqual([]);
	});

	test("national top 3 by puntos get oro/plata/bronce, medal holders first, then by id", () => {
		expect(de("prod").map((f) => f.medalla)).toEqual([
			"oro",
			"plata",
			"bronce",
			undefined,
		]);
		// cobr: 10 tied at 100 puntos -> puesto (id) breaks the tie
		expect(de("cobr").map((f) => [f.vendedorId, f.medalla ?? null])).toEqual(
			ids
				.slice(0, 10)
				.map((id, i) => [id, ["oro", "plata", "bronce"][i] ?? null]),
		);
	});

	test("order: periodo -> metric orden", () => {
		expect([...new Set(figus.map((f) => f.metrica))]).toEqual([
			"venta",
			"prod",
			"lanz",
			"cobr",
		]);
	});
});

describe("figus v2 rarity by quantile of p", () => {
	// 3 months x 7 KPIs = 21 cells; cell c is met by c + 1 of 30 sellers, so p rises with c.
	const ids = Array.from(
		{ length: 30 },
		(_, i) => `V${String(i).padStart(2, "0")}`,
	);
	const periods = [0, 1, 2].map((t) =>
		periodo(
			mesId(t),
			ids.map((id, i) => ({
				id,
				score: null,
				puntos: Object.fromEntries(
					KPI_IDS.map((k, j) => [k, i < t * 7 + j + 1 ? SI : NO]),
				),
			})),
		),
	);
	const defs = METRICAS_DEFAULT.filter((m) =>
		(KPI_IDS as readonly string[]).includes(m.id),
	);
	const figus = figusV2(periods, dataset(periods), defs, albumEn("caba"));
	const tiers = (r: string) =>
		new Set(figus.filter((f) => f.rareza === r).map((f) => f.p));

	test("hardest 5 % legendaria, next 20 % epica, next 35 % rara, the rest comun; none empty", () => {
		const cell = (c: number) => (c + 1) / 30;
		expect(tiers("legendaria")).toEqual(new Set([0, 1].map(cell)));
		expect(tiers("epica")).toEqual(new Set([2, 3, 4, 5].map(cell)));
		expect(tiers("rara")).toEqual(new Set([6, 7, 8, 9, 10, 11, 12].map(cell)));
		expect(tiers("comun")).toEqual(
			new Set([13, 14, 15, 16, 17, 18, 19, 20].map(cell)),
		);
	});

	test("ties in p share the harder tier", () => {
		// 20 cells; the tie starts at the 5th hardest (epica) and runs into rara territory
		const ps = [
			1,
			2,
			3,
			4,
			5,
			5,
			...Array.from({ length: 14 }, (_, i) => 7 + i),
		];
		expect(rarezasDe(ps).slice(0, 8)).toEqual([
			"legendaria",
			"epica",
			"epica",
			"epica",
			"epica",
			"epica",
			"rara",
			"rara",
		]);
		expect(rarezasDe([0.4, 0.4, 0.4])).toEqual([
			"legendaria",
			"legendaria",
			"legendaria",
		]);
		expect(rarezasDe([])).toEqual([]);
	});
});

describe("figus v2 album activation and closed months", () => {
	const filas = [
		{ id: "A", sucursal: "caba", score: null, puntos: { venta: 99 } },
		{ id: "B", sucursal: "moron", score: null, puntos: { venta: 100 } },
		{ id: "C", sucursal: "caba", score: null, puntos: { venta: NO } },
	];
	const periods = [periodo(mesId(0), filas)];
	const d = dataset(periods);

	test("inactive album yields no figus, but the seller still counts for p", () => {
		const figus = figusV2(periods, d, METRICAS_DEFAULT, albumEn("caba"));
		expect(figus.map((f) => [f.vendedorId, f.medalla, f.p])).toEqual([
			["A", "oro", 2 / 3],
		]);
	});

	test("global switch off or an interval that ended -> nothing", () => {
		expect(
			figusV2(
				periods,
				d,
				METRICAS_DEFAULT,
				config([["album", "caba", "2025-01", null]], { album: false }),
			),
		).toEqual([]);
		expect(
			figusV2(
				periods,
				d,
				METRICAS_DEFAULT,
				config([["album", "caba", "2025-01", "2025-09"]]),
			),
		).toEqual([]);
		expect(
			figusV2(
				periods,
				d,
				METRICAS_DEFAULT,
				config([["liga", "caba", "2025-01", null]]),
			),
		).toEqual([]);
	});

	test("the month in progress gives no figus", () => {
		const abierto = [periodo(mesId(12), filas)];
		expect(
			figusV2(
				abierto,
				dataset(abierto),
				METRICAS_DEFAULT,
				albumEn("caba", "moron"),
			),
		).toEqual([]);
	});

	test("inactive metrics give nothing; constancia counts as a metric", () => {
		const conConstancia: ScoredPeriod[] = periods.map((p) => ({
			...p,
			vendedores: p.vendedores.map((v) => ({
				...v,
				kpis: {
					...v.kpis,
					constancia: {
						kpi: "constancia",
						valor: 0.85,
						attainment: 1.0625,
						puntos: 96.6,
						puesto: 1,
						de: 1,
					},
				},
			})),
		}));
		const sinVenta = METRICAS_DEFAULT.map((m) =>
			m.id === "venta" ? { ...m, activa: false } : m,
		);
		const figus = figusV2(conConstancia, d, sinVenta, albumEn("caba", "moron"));
		expect(figus.map((f) => f.metrica)).toEqual([
			"constancia",
			"constancia",
			"constancia",
		]);
		// the only cell of the season is, by definition, its hardest
		expect(figus[0].rareza).toBe("legendaria");
	});
});

describe("figus v2 holografica", () => {
	// A meets venta 4 months running; B misses month 2.
	const periods = temporada(
		[0, 1, 2, 3].map((i) => [
			{ id: "A", score: null, puntos: { venta: SI } },
			{ id: "B", score: null, puntos: { venta: i === 2 ? NO : SI } },
			{ id: "C", score: null, puntos: { venta: NO } },
		]),
	);
	const figus = album(periods, dataset(periods));
	const de = (id: string) =>
		figus
			.filter((f) => f.vendedorId === id)
			.map((f) => [f.periodoId, f.holografica]);

	test("met this month and the two closed months before it", () => {
		expect(de("A")).toEqual([
			[mesId(0), false],
			[mesId(1), false],
			[mesId(2), true],
			[mesId(3), true],
		]);
	});

	test("a gap resets it", () => {
		expect(de("B")).toEqual([
			[mesId(0), false],
			[mesId(1), false],
			[mesId(3), false],
		]);
	});

	test("album() keeps the v1 field names: kpi = metrica, ambito nacional", () => {
		expect(
			figus.every((f) => f.kpi === f.metrica && f.ambito === "nacional"),
		).toBe(true);
	});

	test("albumDe: grid per kpi and periodo, completado over the 7 KPIs, total", () => {
		const a = albumDe(figus, "A");
		expect(a.total).toBe(4);
		expect(a.completado).toBeCloseTo(1 / 7, 10);
		expect(a.metricasConFigu).toBe(1);
		expect(a.grid.venta[mesId(0)].map((f) => f.medalla)).toEqual(["oro"]);
		expect(a.grid.prod).toEqual({});
		expect(Object.keys(a.grid)).toHaveLength(7);
		expect(albumDe(figus, "nobody")).toMatchObject({ total: 0, completado: 0 });
	});
});

describe("liga and revelacion skip inactive sucursal-months and the month in progress", () => {
	const scores = (i: number) => [
		{ id: "A", sucursal: "caba", score: 60 + i },
		{ id: "M", sucursal: "moron", score: 70 + i },
	];
	// months 0..12; mesId(12) = 2026-10 is in progress
	const periods = temporada(Array.from({ length: 13 }, (_, i) => scores(i)));
	const d = dataset(periods);
	const juegos = config([
		["liga", "caba", mesId(0), null],
		["liga", "moron", mesId(8), null],
		["revelacion", "caba", mesId(0), mesId(9)],
		["revelacion", "moron", mesId(0), null],
	]);

	test("liga: counts only active closed months, months required too", () => {
		const r = liga(periods, d, juegos);
		const a = r.vendedores.find((v) => v.vendedorId === "A");
		const m = r.vendedores.find((v) => v.vendedorId === "M");
		expect(a).toMatchObject({ meses: 12, mesesRequeridos: 9, elegible: true });
		expect(m).toMatchObject({ meses: 4, mesesRequeridos: 3, elegible: true });
		expect(m?.promedio).toBeCloseTo(70 + 9.5, 10);
		expect(r.sucursales.map((s) => s.slug).sort()).toEqual(["caba", "moron"]);
	});

	test("revelacion: last closed month; a seller whose sucursal is off is not in it", () => {
		const r = revelacion(periods, d, juegos);
		expect(r.periodoId).toBe(mesId(11));
		expect(r.absoluta.map((x) => x.vendedorId)).toEqual(["M"]);
	});
});
