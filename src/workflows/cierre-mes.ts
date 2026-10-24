// "Simular cierre de mes": the steps of src/lib/cierre, in order, each one durable and
// safe to retry (every cierre function is idempotent).
import { revalidateTag } from "next/cache";
import {
	cerrarPeriodo,
	generarDiasRestantes,
	recalcularConstancias,
} from "@/lib/cierre";

async function completarDias(seed: number, periodoId: string) {
	"use step";
	return generarDiasRestantes(seed, periodoId);
}

async function cerrar(periodoId: string) {
	"use step";
	return cerrarPeriodo(periodoId);
}

async function constancias(periodoId: string) {
	"use step";
	return recalcularConstancias(periodoId);
}

async function revalidar() {
	"use step";
	revalidateTag("dataset", "max");
	revalidateTag("engagement", "max");
}

export async function cierreMes(periodoId: string, seed: number) {
	"use workflow";
	const dias = await completarDias(seed, periodoId);
	const cierre = await cerrar(periodoId);
	const c = await constancias(periodoId);
	await revalidar();
	return { periodoId, ...dias, ...cierre, ...c };
}
