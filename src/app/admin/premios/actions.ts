"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { upsertPremio } from "@/lib/data/writes";
import { JUEGOS, PERIODO_BY_ID } from "@/lib/domain";
import { soloAdmin } from "../_lib/guard";

export type Resultado = { error: string | null; ok?: string };

const Premio = z.object({
	juego: z.enum(JUEGOS),
	periodoId: z.string().refine((p) => Object.hasOwn(PERIODO_BY_ID, p)),
	descripcion: z.string().trim().min(3).max(160),
	costoArs: z.coerce.number().min(0).max(1e10),
});

/** One prize per game and month: the id is juego-periodo, so saving again replaces it. */
export async function guardarPremio(
	_prev: Resultado,
	form: FormData,
): Promise<Resultado> {
	await soloAdmin();
	const p = Premio.safeParse(Object.fromEntries(form));
	if (!p.success)
		return {
			error: "Elegí juego y mes, describí el premio y poné un costo en pesos.",
		};
	const { juego, periodoId } = p.data;
	await upsertPremio({
		...p.data,
		id: `${juego}-${periodoId}`,
		simulado: false,
	});
	updateTag("config");
	return { error: null, ok: "Premio guardado." };
}
