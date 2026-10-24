"use server";

import { redirect } from "next/navigation";
import { env } from "@/env";
import { ADMIN_COOKIE, checkAdminPasscode } from "@/lib/auth";
import { entrarAdmin, salir } from "@/lib/auth/server";

export type EstadoEntrar = { error: string | null };

export async function entrar(
	_prev: EstadoEntrar,
	form: FormData,
): Promise<EstadoEntrar> {
	if (!env.ADMIN_PASSCODE)
		return { error: "La administración está desactivada en este entorno." };
	const clave = form.get("clave");
	if (
		typeof clave !== "string" ||
		!checkAdminPasscode(clave, env.ADMIN_PASSCODE)
	)
		return { error: "La clave no es correcta." };
	await entrarAdmin();
	redirect("/admin");
}

export async function salirAdmin(): Promise<void> {
	await salir(ADMIN_COOKIE);
	redirect("/admin");
}
