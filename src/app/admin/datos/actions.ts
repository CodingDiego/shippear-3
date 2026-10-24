"use server";

import { updateTag } from "next/cache";
import { start } from "workflow/api";
import { replaceDataset } from "@/db/upsert";
import { reabrirDemo } from "@/lib/cierre";
import { parseCsv } from "@/lib/csv";
import { getMetricas } from "@/lib/data/queries";
import { cierreMes } from "@/workflows/cierre-mes";
import { soloAdmin } from "../_lib/guard";
import { DEMO_SEED, mesAbierto } from "./data";

// Server actions take at most 1 MB per request (Next default); the monthly export fits.
const MAX_BYTES = 1_000_000;

export type Revision =
	| { estado: "vacio" }
	| {
			estado: "error";
			mensaje: string;
			errores: { row: number; message: string }[];
	  }
	| {
			estado: "listo" | "aplicado";
			archivo: string;
			vendedores: number;
			meses: string[];
			mensuales: number;
			diarias: number;
			planes: number;
	  };

async function leer(
	form: FormData,
): Promise<
	{ error: string } | { nombre: string; parsed: ReturnType<typeof parseCsv> }
> {
	const f = form.get("archivo");
	if (!(f instanceof File) || f.size === 0)
		return { error: "Elegí un archivo CSV." };
	if (f.size > MAX_BYTES)
		return {
			error:
				"El archivo pesa más de 1 MB. Dividilo o importá solo filas mensuales.",
		} as const;
	const parsed = parseCsv(await f.text(), await getMetricas());
	return { nombre: f.name, parsed };
}

/** Parses the file and reports what it holds, without writing anything. */
export async function revisarCsv(
	_prev: Revision,
	form: FormData,
): Promise<Revision> {
	await soloAdmin();
	const r = await leer(form);
	if (!("parsed" in r))
		return { estado: "error", mensaje: r.error, errores: [] };
	const { parsed: p } = r;
	if (p.ok === false)
		return {
			estado: "error",
			mensaje: `El archivo tiene ${p.errors.length >= 50 ? "50 o más" : p.errors.length} filas con problemas. No se cambió nada.`,
			errores: p.errors,
		};
	const aplicar = form.get("aplicar") === "si";
	if (aplicar) {
		await replaceDataset(
			{ dataset: p.dataset, diarios: p.diarios, planes: p.planes },
			{ source: "csv" },
		);
		updateTag("dataset");
		updateTag("config");
		updateTag("engagement");
	}
	return {
		estado: aplicar ? "aplicado" : "listo",
		archivo: r.nombre,
		vendedores: p.dataset.vendedores.length,
		meses: [...new Set(p.dataset.resultados.map((x) => x.periodoId))].sort(),
		mensuales: p.dataset.resultados.length,
		diarias: p.diarios.length,
		planes: p.planes.length,
	};
}

/** Full reseed with the demo seed: the month in progress opens again, claims are gone. */
export async function reiniciarDemo(): Promise<{ error: string | null }> {
	await soloAdmin();
	await reabrirDemo(DEMO_SEED);
	updateTag("dataset");
	updateTag("config");
	updateTag("engagement");
	return { error: null };
}

export type InicioCierre =
	| { error: string }
	| { error: null; runId: string; periodoId: string };

export async function iniciarCierre(): Promise<InicioCierre> {
	await soloAdmin();
	const { periodoId, seed } = await mesAbierto();
	if (!periodoId) return { error: "No hay un mes en curso para cerrar." };
	const run = await start(cierreMes, [periodoId, seed]);
	return { error: null, runId: run.runId, periodoId };
}

/** After the workflow ends: its revalidateTag serves stale once, this shows the close now. */
export async function verCierre(): Promise<void> {
	await soloAdmin();
	updateTag("dataset");
	updateTag("engagement");
}
