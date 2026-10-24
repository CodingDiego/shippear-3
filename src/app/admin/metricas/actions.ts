"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import {
	addMetrica,
	METRICA_ID_RE,
	setAjuste,
	setMetrica,
} from "@/lib/data/writes";
import { ACCION_CUSTOM_DEFAULT } from "@/lib/domain";
import { soloAdmin } from "../_lib/guard";

export type Resultado = { error: string | null; ok?: string };

const Cambio = z.object({
	id: z.string().regex(METRICA_ID_RE),
	activa: z.boolean(),
	peso: z.number().min(0).max(10),
	objetivo: z.number().min(0).max(10),
});

/** Saves every metric row of the form at once (activa, peso, objetivo). */
export async function guardarMetricas(filas: unknown): Promise<Resultado> {
	await soloAdmin();
	const p = z.array(Cambio).min(1).max(64).safeParse(filas);
	if (!p.success) return { error: "Revisá los pesos y objetivos." };
	if (!p.data.some((m) => m.activa && m.peso > 0))
		return { error: "Dejá al menos una métrica activa con peso mayor a 0." };
	for (const { id, ...patch } of p.data)
		if (!(await setMetrica(id, patch)))
			return { error: `No existe la métrica ${id}.` };
	updateTag("config");
	updateTag("dataset");
	return { error: null, ok: "Métricas guardadas." };
}

const num = (min: number, max: number) => z.coerce.number().min(min).max(max);

const Nueva = z.object({
	nombre: z.string().trim().min(3).max(40),
	unidad: z.string().trim().min(1).max(20),
	num: z.string().trim().min(3).max(80),
	den: z.string().trim().min(3).max(80),
	peso: num(0, 10),
	// The form asks for a percentage.
	objetivo: num(0, 1000),
	direccion: z.enum(["mayor", "menor"]),
	accion: z
		.string()
		.trim()
		.max(80)
		.refine((s) => s === "" || s.includes("{n}"), "falta {n}"),
	activa: z.literal("on").optional(),
});

/** "Degustaciones en góndola" -> "degustaciones_en_gondo". */
const idDe = (nombre: string) =>
	nombre
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^[^a-z]+|_+$/g, "")
		.slice(0, 24)
		.replace(/_+$/, "");

export async function agregarMetrica(
	_prev: Resultado,
	form: FormData,
): Promise<Resultado> {
	await soloAdmin();
	const p = Nueva.safeParse(Object.fromEntries(form));
	if (!p.success) {
		const campo = p.error.issues[0]?.path[0];
		return { error: `Revisá el campo ${String(campo ?? "")}.` };
	}
	const m = p.data;
	const id = idDe(m.nombre);
	if (!METRICA_ID_RE.test(id))
		return { error: "El nombre tiene que empezar con una letra." };
	const creada = await addMetrica({
		id,
		nombre: m.nombre,
		corto: id.slice(0, 5).toUpperCase(),
		peso: m.peso,
		objetivo: m.objetivo / 100,
		direccion: m.direccion,
		num: m.num,
		den: m.den,
		unidad: m.unidad,
		accion: m.accion || ACCION_CUSTOM_DEFAULT,
		activa: m.activa === "on",
	});
	if (!creada) return { error: `Ya hay una métrica llamada ${id}.` };
	updateTag("config");
	updateTag("dataset");
	return { error: null, ok: `Métrica ${m.nombre} agregada.` };
}

const Ajustes = z.object({
	meta_puntos: num(1, 100),
	valor_kg_ars: num(0, 1e7),
});

export async function guardarAjustes(
	_prev: Resultado,
	form: FormData,
): Promise<Resultado> {
	await soloAdmin();
	const p = Ajustes.safeParse(Object.fromEntries(form));
	if (!p.success)
		return {
			error:
				"La meta va de 1 a 100 puntos y el margen por kilo no puede ser negativo.",
		};
	await setAjuste("meta_puntos", p.data.meta_puntos);
	await setAjuste("valor_kg_ars", p.data.valor_kg_ars);
	updateTag("config");
	return { error: null, ok: "Meta y margen guardados." };
}
