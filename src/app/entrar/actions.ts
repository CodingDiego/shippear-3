"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/env";
import { checkAdminPasscode, pinDe } from "@/lib/auth";
import {
	limpiarFallos,
	minutosBloqueado,
	registrarFallo,
} from "@/lib/auth/intentos";
import { entrarComo } from "@/lib/auth/server";
import { getDataset } from "@/lib/data/queries";

export type EntrarEstado = { error: string } | null;

const schema = z.object({
	codigo: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^V\d{3,4}$/),
	pin: z
		.string()
		.trim()
		.regex(/^\d{6}$/),
});

export async function entrar(
	_prev: EntrarEstado,
	form: FormData,
): Promise<EntrarEstado> {
	const parsed = schema.safeParse({
		codigo: form.get("codigo"),
		pin: form.get("pin"),
	});
	if (!parsed.success)
		return {
			error: "Escribí tu código (por ejemplo V001) y los 6 números de tu PIN.",
		};
	const { codigo, pin } = parsed.data;
	const espera = await minutosBloqueado(codigo);
	if (espera > 0)
		return {
			error: `Hubo demasiados intentos con ese código. Probá de nuevo en ${espera} ${espera === 1 ? "minuto" : "minutos"}.`,
		};
	const [{ vendedores }, esperado] = await Promise.all([
		getDataset(),
		pinDe(codigo, env.PIN_SECRET ?? env.AUTH_SECRET),
	]);
	// checkAdminPasscode is the shared constant-time compare.
	const ok = checkAdminPasscode(pin, esperado);
	if (!ok || !vendedores.some((v) => v.id === codigo)) {
		await registrarFallo(codigo);
		return {
			error:
				"El código y el PIN no coinciden. Revisá los 6 números o pedile el PIN a tu jefe de sucursal.",
		};
	}
	await limpiarFallos(codigo);
	await entrarComo(codigo);
	redirect("/yo");
}
