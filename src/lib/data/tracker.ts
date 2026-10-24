import { cacheLife, cacheTag } from "next/cache";
import { readAjustes, readMetricas } from "@/lib/data/db-reads";
import {
	desdeConstancia,
	readAgregadosVentana,
	readSerieVentaDe,
} from "@/lib/data/windows";
import { CONSTANCIA_ID, hoy, type Tracker, type Ventana } from "@/lib/domain";
import { tracker } from "@/lib/goals";
import { constancia, serieRolling } from "@/lib/scoring";
import { ventanaDe } from "@/lib/time";

// Seller goal tracker. Lives apart from queries.ts (which re-exports getTracker) and reads
// defs and ajustes straight from the DB inside its own cache scope to avoid an import cycle.

/** Tracker for the window containing ref; cached, so ref comes in as a plain value. */
export async function trackerAt(
	vendedorId: string,
	ventana: Ventana,
	ref: string,
): Promise<Tracker> {
	"use cache";
	cacheLife("hours");
	cacheTag("dataset", "config");
	const v = ventanaDe(ventana, ref);
	const [defs, ajustes] = await Promise.all([readMetricas(), readAjustes()]);
	const conConstancia =
		ventana === "mes" && defs.some((m) => m.id === CONSTANCIA_ID && m.activa);
	const [agregados, serie] = await Promise.all([
		readAgregadosVentana(vendedorId, v, defs),
		conConstancia
			? readSerieVentaDe(vendedorId, desdeConstancia(ref), ref)
			: null,
	]);
	return tracker({
		vendedorId,
		ventana: v,
		defs,
		ajustes,
		agregados,
		constancia: serie ? constancia(serieRolling(serie, ref)) : null,
	});
}

/** Goal tracker for the window containing hoy(). vendedorId comes from the session cookie. */
export function getTracker(
	vendedorId: string,
	ventana: Ventana,
): Promise<Tracker> {
	return trackerAt(vendedorId, ventana, hoy());
}
