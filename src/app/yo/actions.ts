"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_COOKIE } from "@/lib/auth";
import { salir, vendedorSesion } from "@/lib/auth/server";
import {
	getDataset,
	getJuegosConfig,
	getSeasonMeta,
	reclamables,
} from "@/lib/data/queries";
import { reclamar, registrarEvento } from "@/lib/data/writes";
import { JUEGOS } from "@/lib/domain";
import { juegoActivo } from "@/lib/games";

export async function salirAction() {
	await salir(SESSION_COOKIE);
	redirect("/entrar");
}

const reclamo = z.object({
	tipo: z.enum(["figu", "premio"]),
	ref: z.string().min(1).max(80),
	periodoId: z.string().regex(/^\d{4}-\d{2}$/),
});

export type ReclamoResultado = { ok: true } | { error: string };

export async function reclamarAction(
	input: z.input<typeof reclamo>,
): Promise<ReclamoResultado> {
	const id = await vendedorSesion();
	if (!id)
		return { error: "Tu sesión se cerró. Entrá de nuevo para reclamar." };
	const p = reclamo.safeParse(input);
	if (!p.success)
		return { error: "No pudimos leer el pedido. Recargá la página." };
	const { tipo, ref, periodoId } = p.data;
	const { pendientes, reclamados } = await reclamables(id);
	const es = (r: { tipo: string; ref: string; periodoId: string }) =>
		r.tipo === tipo && r.ref === ref && r.periodoId === periodoId;
	if (reclamados.some(es)) return { ok: true };
	if (!pendientes.some(es))
		return { error: "Eso no está para reclamar. Recargá la página." };
	await reclamar(id, tipo, ref, periodoId);
	updateTag("engagement");
	return { ok: true };
}

/** One real "vista" per visit of /yo, for each game active in the seller's sucursal this month. */
export async function registrarVista(): Promise<void> {
	const id = await vendedorSesion();
	if (!id) return;
	const [d, juegos, meta] = await Promise.all([
		getDataset(),
		getJuegosConfig(),
		getSeasonMeta(),
	]);
	const v = d.vendedores.find((x) => x.id === id);
	if (!v) return;
	const periodo = meta.enCurso ?? meta.latest;
	const activos = JUEGOS.filter((j) =>
		juegoActivo(juegos, j, v.sucursal, periodo),
	);
	if (activos.length === 0) return;
	await Promise.all(activos.map((j) => registrarEvento(id, j, "vista")));
	updateTag("engagement");
}
