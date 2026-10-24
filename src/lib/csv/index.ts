import { z } from "zod";
import {
	CANALES,
	type Canal,
	CSV_COLUMNS,
	type Dataset,
	KPI_DEFS,
	type KpiDiario,
	type KpiResultado,
	METRICAS_DEFAULT,
	type MetricaDef,
	PERIODO_BY_ID,
	PERIODOS,
	type Plan,
	periodoDe,
	SUCURSAL_BY_SLUG,
	SUCURSALES,
	type Vendedor,
} from "@/lib/domain";

const quote = (f: string) =>
	/[",;\n\r]/.test(f) ? `"${f.replaceAll('"', '""')}"` : f;

export function toCsv(d: Dataset): string {
	const byId = new Map(d.vendedores.map((v) => [v.id, v]));
	const lines = [CSV_COLUMNS.join(",")];
	for (const r of d.resultados) {
		const v = byId.get(r.vendedorId);
		if (!v) continue;
		lines.push(
			[
				v.id,
				v.nombre,
				v.apellido,
				v.sucursal,
				v.canal,
				v.altaPeriodo,
				r.periodoId,
				r.kpi,
				String(r.num),
				String(r.den),
			]
				.map(quote)
				.join(","),
		);
	}
	return `${lines.join("\n")}\n`;
}

/** RFC-4180 records; handles quoted separators, quotes and newlines. */
function splitRecords(text: string, sep: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let f = "";
	let inQ = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQ) {
			if (c !== '"') f += c;
			else if (text[i + 1] === '"') {
				f += '"';
				i++;
			} else inQ = false;
		} else if (c === '"') inQ = true;
		else if (c === sep) {
			row.push(f);
			f = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(f);
			rows.push(row);
			row = [];
			f = "";
		} else f += c;
	}
	if (f !== "" || row.length > 0) {
		row.push(f);
		rows.push(row);
	}
	return rows;
}

const ym = z
	.string()
	.trim()
	.regex(/^\d{4}-\d{2}$/, "formato YYYY-MM")
	.refine((s) => Object.hasOwn(PERIODO_BY_ID, s), "periodo fuera de temporada");
const dec = z
	.string()
	.trim()
	.min(1, "vacío")
	.transform((s) => Number(s.replace(",", ".")))
	.pipe(z.number("no es un número").min(0, "debe ser >= 0"));

const fecha = z
	.string()
	.trim()
	.refine((s) => {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
		const d = new Date(`${s}T00:00:00Z`);
		return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
	}, "fecha inválida (YYYY-MM-DD)");

const rowSchema = (kpis: ReadonlySet<string>) =>
	z
		.object({
			vendedor: z.string().trim().min(1, "vacío"),
			nombre: z.string(),
			apellido: z.string(),
			sucursal: z
				.string()
				.trim()
				.refine(
					(s) => Object.hasOwn(SUCURSAL_BY_SLUG, s),
					"sucursal desconocida",
				),
			canal: z
				.string()
				.trim()
				.refine((s) => CANALES.includes(s as Canal), "canal desconocido"),
			alta: ym,
			periodo: ym,
			kpi: z
				.string()
				.trim()
				.refine((k) => kpis.has(k), "kpi desconocido"),
			num: dec,
			den: dec,
			// Optional column: a row with fecha is a daily row (kpi_diarios).
			fecha: z.union([z.literal(""), fecha]),
			// Optional column: on a venta row, the full-month OV of that periodo (planes).
			plan: z.union([z.literal(""), dec]),
		})
		.refine((r) => r.periodo >= r.alta, {
			path: ["periodo"],
			message: "periodo anterior a alta",
		})
		.refine((r) => r.fecha === "" || periodoDe(r.fecha) === r.periodo, {
			path: ["fecha"],
			message: "fecha fuera del periodo",
		})
		.refine((r) => r.plan === "" || r.kpi === "venta", {
			path: ["plan"],
			message: "plan solo en filas de venta",
		});

type Err = { row: number; message: string };
const MAX_ERRORS = 50;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export type CsvOk = {
	ok: true;
	/** resultados: monthly rows, plus the monthly aggregate of every daily group. */
	dataset: Dataset;
	/** Rows with a fecha; [] for a v1 monthly file. */
	diarios: KpiDiario[];
	/** venta OV per (vendedor, periodo) from the optional plan column; [] without it. */
	planes: Plan[];
};

/**
 * v1 monthly long format, plus an optional `fecha` column (YYYY-MM-DD): rows with a
 * fecha are daily rows, and their (vendedor, periodo, kpi) monthly row is rebuilt from
 * them (flujo: sum; stock: the last day's snapshot). kpi is any stored metric in defs.
 * An optional `plan` column on venta rows gives that month's full OV (one value per
 * seller and month; repeating it on every daily row is fine).
 */
export function parseCsv(
	text: string,
	defs: readonly MetricaDef[] = METRICAS_DEFAULT,
): CsvOk | { ok: false; errors: Err[] } {
	const src = text.replace(/^﻿/, "");
	const head = src.split(/\r\n|\n|\r/, 1)[0];
	const sep = head.split(";").length > head.split(",").length ? ";" : ",";
	const records = splitRecords(src, sep);
	const header = (records[0] ?? []).map((h) => h.trim());
	const missing = CSV_COLUMNS.filter((c) => !header.includes(c));
	if (missing.length > 0)
		return {
			ok: false,
			errors: [{ row: 1, message: `faltan columnas: ${missing.join(", ")}` }],
		};
	const cols = [...CSV_COLUMNS, "fecha", "plan"] as const;
	const col = Object.fromEntries(cols.map((c) => [c, header.indexOf(c)]));
	const acum = new Map(
		defs
			.filter((d) => d.acumulacion !== "derivada")
			.map((d) => [d.id, d.acumulacion]),
	);
	const RowSchema = rowSchema(new Set(acum.keys()));

	const errors: Err[] = [];
	const vendedores = new Map<string, Vendedor>();
	const mensual = new Set<string>();
	const diarioMes = new Set<string>();
	const diarioDia = new Set<string>();
	const resultados: KpiResultado[] = [];
	const diarios: KpiDiario[] = [];
	const planes = new Map<string, Plan>();
	for (let i = 1; i < records.length && errors.length < MAX_ERRORS; i++) {
		const rec = records[i];
		if (rec.length === 1 && rec[0].trim() === "") continue;
		const row = i + 1;
		const parsed = RowSchema.safeParse(
			Object.fromEntries(
				cols.map((c) => [c, col[c] < 0 ? "" : (rec[col[c]] ?? "")]),
			),
		);
		if (!parsed.success) {
			const issue = parsed.error.issues[0];
			errors.push({
				row,
				message: `${issue.path.join(".")}: ${issue.message}`,
			});
			continue;
		}
		const r = parsed.data;
		const key = `${r.vendedor}|${r.periodo}|${r.kpi}`;
		const dia = `${r.vendedor}|${r.fecha}|${r.kpi}`;
		const choque =
			r.fecha === ""
				? diarioMes.has(key)
					? "fila mensual de un mes que ya tiene filas diarias"
					: mensual.has(key) && "fila duplicada (vendedor, periodo, kpi)"
				: mensual.has(key)
					? "fila diaria de un mes que ya tiene fila mensual"
					: diarioDia.has(dia) && "fila duplicada (vendedor, fecha, kpi)";
		if (choque) {
			errors.push({ row, message: choque });
			continue;
		}
		if (r.plan !== "") {
			const k = `${r.vendedor}|${r.periodo}`;
			const antes = planes.get(k);
			if (antes && antes.den !== r.plan) {
				errors.push({
					row,
					message: "plan distinto para el mismo vendedor y periodo",
				});
				continue;
			}
			planes.set(k, {
				vendedorId: r.vendedor,
				periodoId: r.periodo,
				kpi: "venta",
				den: r.plan,
			});
		}
		if (r.fecha === "") mensual.add(key);
		else {
			diarioMes.add(key);
			diarioDia.add(dia);
		}
		if (!vendedores.has(r.vendedor))
			vendedores.set(r.vendedor, {
				id: r.vendedor,
				nombre: r.nombre,
				apellido: r.apellido,
				sucursal: r.sucursal,
				canal: r.canal as Canal,
				altaPeriodo: r.alta,
			});
		const base = { vendedorId: r.vendedor, kpi: r.kpi, num: r.num, den: r.den };
		if (r.fecha === "") resultados.push({ ...base, periodoId: r.periodo });
		else diarios.push({ ...base, fecha: r.fecha });
	}
	if (errors.length > 0) return { ok: false, errors };

	diarios.sort(
		(a, b) =>
			cmp(a.vendedorId, b.vendedorId) ||
			cmp(a.kpi, b.kpi) ||
			cmp(a.fecha, b.fecha),
	);
	const mes = new Map<string, KpiResultado>();
	for (const x of diarios) {
		const periodoId = periodoDe(x.fecha);
		const k = `${x.vendedorId}|${periodoId}|${x.kpi}`;
		const prev = mes.get(k);
		// Sorted by fecha, so for stock the last set is the month's last snapshot.
		if (prev && acum.get(x.kpi) === "flujo") {
			prev.num += x.num;
			prev.den += x.den;
		} else
			mes.set(k, {
				vendedorId: x.vendedorId,
				periodoId,
				kpi: x.kpi,
				num: x.num,
				den: x.den,
			});
	}
	resultados.push(...mes.values());

	return {
		ok: true,
		dataset: {
			sucursales: SUCURSALES,
			vendedores: [...vendedores.values()].sort((a, b) => cmp(a.id, b.id)),
			periodos: PERIODOS,
			defs: KPI_DEFS,
			resultados: resultados.sort(
				(a, b) =>
					cmp(a.vendedorId, b.vendedorId) ||
					cmp(a.periodoId, b.periodoId) ||
					cmp(a.kpi, b.kpi),
			),
		},
		diarios,
		planes: [...planes.values()],
	};
}
