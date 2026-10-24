"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { esAdmin } from "@/lib/auth/server";
import { getDataset } from "@/lib/data/queries";
import { setJuegoGlobal, setJuegoSucursal } from "@/lib/data/writes";
import { JUEGOS } from "@/lib/domain";

export type Resultado = { ok: true } | { ok: false; error: string };

const globalSchema = z.object({ juego: z.enum(JUEGOS), activo: z.boolean() });
const sucursalSchema = globalSchema.extend({
	sucursal: z.string().min(1).max(64),
	periodoId: z.string().regex(/^\d{4}-\d{2}$/),
});

function listo(): Resultado {
	// Switches change which games count where: configs and every score-derived view.
	updateTag("config");
	updateTag("dataset");
	return { ok: true };
}

export async function cambiarJuegoGlobal(input: unknown): Promise<Resultado> {
	if (!(await esAdmin()))
		return { ok: false, error: "Tu sesión de admin venció. Entrá de nuevo." };
	const p = globalSchema.safeParse(input);
	if (!p.success) return { ok: false, error: "Pedido inválido." };
	await setJuegoGlobal(p.data.juego, p.data.activo);
	return listo();
}

export async function cambiarJuegoSucursal(input: unknown): Promise<Resultado> {
	if (!(await esAdmin()))
		return { ok: false, error: "Tu sesión de admin venció. Entrá de nuevo." };
	const p = sucursalSchema.safeParse(input);
	if (!p.success) return { ok: false, error: "Pedido inválido." };
	const { sucursales, periodos } = await getDataset();
	if (!sucursales.some((s) => s.slug === p.data.sucursal))
		return { ok: false, error: "Esa sucursal no existe." };
	if (!periodos.some((x) => x.id === p.data.periodoId))
		return { ok: false, error: "Ese mes no existe." };
	await setJuegoSucursal(
		p.data.juego,
		p.data.sucursal,
		p.data.activo,
		p.data.periodoId,
	);
	return listo();
}
