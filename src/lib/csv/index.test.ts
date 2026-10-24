import { describe, expect, test } from "vitest";
import type { Dataset } from "@/lib/domain";
import { CSV_COLUMNS, METRICAS_DEFAULT } from "@/lib/domain";
import { generate } from "@/lib/seed/generate";
import { parseCsv, toCsv } from "./index";

const sorted = (d: Dataset): Dataset => ({
	...d,
	resultados: [...d.resultados].sort(
		(a, b) =>
			(a.vendedorId < b.vendedorId
				? -1
				: a.vendedorId > b.vendedorId
					? 1
					: 0) ||
			(a.periodoId < b.periodoId ? -1 : a.periodoId > b.periodoId ? 1 : 0) ||
			(a.kpi < b.kpi ? -1 : a.kpi > b.kpi ? 1 : 0),
	),
});

const HEADER =
	"vendedor;nombre;apellido;sucursal;canal;alta;periodo;kpi;num;den";

describe("toCsv", () => {
	test("header is CSV_COLUMNS, LF endings", () => {
		const csv = toCsv(generate(42));
		expect(csv.split("\n")[0]).toBe(CSV_COLUMNS.join(","));
		expect(csv).not.toContain("\r");
	});
});

describe("parseCsv", () => {
	test("round-trips generate(42)", () => {
		const d = generate(42);
		const r = parseCsv(toCsv(d));
		if (!r.ok) throw new Error(JSON.stringify(r.errors.slice(0, 3)));
		expect(sorted(r.dataset)).toEqual(sorted(d));
	});

	test("parses a ';' fixture with ',' decimals, BOM and CRLF", () => {
		const text = `﻿${[
			HEADER,
			"V001;Ana;Paz;caba;plaza;2025-10;2025-10;venta;1234,5;2000",
			"V001;Ana;Paz;caba;plaza;2025-10;2025-10;prod;70.5;100",
			"V002;Luis;Gil;rosario;campaña;2025-11;2025-12;cobr;0,9;1",
		].join("\r\n")}\r\n`;
		const r = parseCsv(text);
		if (!r.ok) throw new Error(JSON.stringify(r.errors));
		expect(r.dataset.vendedores.map((v) => v.id)).toEqual(["V001", "V002"]);
		expect(r.dataset.vendedores[1].altaPeriodo).toBe("2025-11");
		expect(r.dataset.resultados).toEqual([
			{
				vendedorId: "V001",
				periodoId: "2025-10",
				kpi: "prod",
				num: 70.5,
				den: 100,
			},
			{
				vendedorId: "V001",
				periodoId: "2025-10",
				kpi: "venta",
				num: 1234.5,
				den: 2000,
			},
			{
				vendedorId: "V002",
				periodoId: "2025-12",
				kpi: "cobr",
				num: 0.9,
				den: 1,
			},
		]);
	});

	test("rejects an unknown kpi with its row number", () => {
		const r = parseCsv(
			[
				HEADER,
				"V001;Ana;Paz;caba;plaza;2025-10;2025-10;venta;1;2",
				"V001;Ana;Paz;caba;plaza;2025-10;2025-10;ventas;1;2",
			].join("\n"),
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors.map((e) => e.row)).toEqual([3]);
	});

	test("reports a duplicate row", () => {
		const row = "V001;Ana;Paz;caba;plaza;2025-10;2025-10;venta;1;2";
		const r = parseCsv([HEADER, row, row].join("\n"));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors[0].row).toBe(3);
	});

	test("rejects periodo before alta and missing columns", () => {
		const early = parseCsv(
			[HEADER, "V001;Ana;Paz;caba;plaza;2025-11;2025-10;venta;1;2"].join("\n"),
		);
		expect(early.ok).toBe(false);
		const missing = parseCsv("vendedor,nombre\nV001,Ana");
		expect(missing.ok).toBe(false);
		if (!missing.ok) expect(missing.errors[0].row).toBe(1);
	});

	test("a quoted field with comma, quote and newline survives", () => {
		const d = generate(42);
		const small: Dataset = {
			...d,
			vendedores: [
				{
					...d.vendedores[0],
					nombre: 'Ana "la" Jr.',
					apellido: "Paz, de\nla Sierra",
				},
			],
			resultados: d.resultados.filter(
				(r) => r.vendedorId === d.vendedores[0].id,
			),
		};
		const r = parseCsv(toCsv(small));
		if (!r.ok) throw new Error(JSON.stringify(r.errors.slice(0, 3)));
		expect(r.dataset.vendedores[0]).toEqual(small.vendedores[0]);
	});
});

describe("parseCsv v2: fecha and custom metrics", () => {
	const H = `${HEADER};fecha`;
	const fila = (kpi: string, fecha: string, num: number, den: number) =>
		`V001;Ana;Paz;caba;plaza;2025-10;${fecha.slice(0, 7) || "2025-10"};${kpi};${num};${den};${fecha}`;

	test("daily rows rebuild the month: flujo sums, stock keeps the last day", () => {
		const r = parseCsv(
			[
				H,
				fila("venta", "2025-10-02", 10, 20),
				fila("venta", "2025-10-01", 5, 10),
				fila("lanz", "2025-10-31", 7, 40),
				fila("lanz", "2025-10-01", 1, 38),
				fila("venta", "2025-11-03", 1, 1),
			].join("\n"),
		);
		if (!r.ok) throw new Error(JSON.stringify(r.errors));
		expect(r.diarios).toHaveLength(5);
		expect(r.dataset.resultados).toEqual([
			{
				vendedorId: "V001",
				periodoId: "2025-10",
				kpi: "lanz",
				num: 7,
				den: 40,
			},
			{
				vendedorId: "V001",
				periodoId: "2025-10",
				kpi: "venta",
				num: 15,
				den: 30,
			},
			{
				vendedorId: "V001",
				periodoId: "2025-11",
				kpi: "venta",
				num: 1,
				den: 1,
			},
		]);
	});

	test("optional plan column: venta OV per seller and month", () => {
		const P = `${H};plan`;
		const r = parseCsv(
			[
				P,
				`${fila("venta", "2026-10-01", 5, 10)};270`,
				`${fila("venta", "2026-10-02", 6, 10)};270`,
				`${fila("prod", "2026-10-02", 6, 10)};`,
			].join("\n"),
		);
		if (!r.ok) throw new Error(JSON.stringify(r.errors));
		expect(r.planes).toEqual([
			{ vendedorId: "V001", periodoId: "2026-10", kpi: "venta", den: 270 },
		]);
		const mal = parseCsv(
			[
				P,
				`${fila("venta", "2026-10-01", 5, 10)};270`,
				`${fila("venta", "2026-10-02", 6, 10)};280`,
				`${fila("prod", "2026-10-03", 6, 10)};9`,
			].join("\n"),
		);
		expect(mal.ok).toBe(false);
		if (!mal.ok) expect(mal.errors.map((e) => e.row)).toEqual([3, 4]);
		const v1 = parseCsv([H, fila("venta", "2026-10-01", 5, 10)].join("\n"));
		expect(v1.ok && v1.planes).toEqual([]);
	});

	test("a v1 file has no daily rows; blank fecha is a monthly row", () => {
		const v1 = parseCsv(
			[HEADER, "V001;Ana;Paz;caba;plaza;2025-10;2025-10;venta;1;2"].join("\n"),
		);
		if (!v1.ok) throw new Error(JSON.stringify(v1.errors));
		expect(v1.diarios).toEqual([]);
		const blank = parseCsv([H, fila("venta", "", 1, 2)].join("\n"));
		if (!blank.ok) throw new Error(JSON.stringify(blank.errors));
		expect(blank.dataset.resultados).toHaveLength(1);
	});

	test("rejects bad dates, a fecha outside its periodo and mixed rows", () => {
		const bad = (lines: string[]) => {
			const r = parseCsv([H, ...lines].join("\n"));
			return r.ok ? [] : r.errors.map((e) => e.message);
		};
		expect(bad([fila("venta", "2025-10-32", 1, 1)])[0]).toMatch(/fecha/);
		expect(
			bad(["V001;Ana;Paz;caba;plaza;2025-10;2025-10;venta;1;1;2025-11-03"])[0],
		).toMatch(/fuera del periodo/);
		expect(
			bad([fila("venta", "", 1, 1), fila("venta", "2025-10-01", 1, 1)])[0],
		).toMatch(/mensual/);
		expect(
			bad([
				fila("venta", "2025-10-01", 1, 1),
				fila("venta", "2025-10-01", 1, 1),
			])[0],
		).toMatch(/duplicada/);
	});

	test("accepts metrics present in defs, rejects derived and unknown ones", () => {
		expect(parseCsv([H, fila("degus", "2025-10-01", 3, 4)].join("\n")).ok).toBe(
			true,
		);
		expect(
			parseCsv([H, fila("constancia", "2025-10-01", 1, 1)].join("\n")).ok,
		).toBe(false);
		const custom = parseCsv(
			[H, fila("visitas_x", "2025-10-01", 1, 1)].join("\n"),
			[
				...METRICAS_DEFAULT,
				{ ...METRICAS_DEFAULT[0], id: "visitas_x", tipo: "custom" },
			],
		);
		expect(custom.ok).toBe(true);
		expect(
			parseCsv([H, fila("visitas_x", "2025-10-01", 1, 1)].join("\n")).ok,
		).toBe(false);
	});

	test("rejects prototype keys as sucursal", () => {
		const r = parseCsv(
			[HEADER, "V001;Ana;Paz;constructor;plaza;2025-10;2025-10;venta;1;2"].join(
				"\n",
			),
		);
		expect(r.ok).toBe(false);
	});
});
