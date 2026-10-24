// DB write helpers for the admin and seller server actions. The actions own auth,
// input validation (zod) and updateTag ("config" | "engagement" | "dataset"); these only write.
import { and, eq, max, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
	ajustes,
	engagement,
	juegos,
	juegosSucursal,
	kpiDefiniciones,
	premios,
	reclamos,
} from "@/db/schema";
import {
	AJUSTES_DEFAULT,
	type Ajustes,
	type EventoEngagement,
	hoy,
	JUEGO_LABEL,
	type JuegoId,
	type MetricaDef,
	type MetricaId,
	type Premio,
} from "@/lib/domain";

/** Fields an admin may edit on any metric. */
export type MetricaPatch = Partial<
	Pick<
		MetricaDef,
		"peso" | "activa" | "objetivo" | "nombre" | "corto" | "accion" | "unidad"
	>
>;

/** false when the metric does not exist. */
export async function setMetrica(
	id: MetricaId,
	patch: MetricaPatch,
): Promise<boolean> {
	if (Object.keys(patch).length === 0) return true;
	const rows = await db
		.update(kpiDefiniciones)
		.set(patch)
		.where(eq(kpiDefiniciones.kpi, id))
		.returning({ kpi: kpiDefiniciones.kpi });
	return rows.length > 0;
}

export type NuevaMetrica = Pick<
	MetricaDef,
	"id" | "nombre" | "corto" | "peso" | "objetivo" | "direccion" | "num" | "den"
> &
	Partial<Pick<MetricaDef, "activa" | "accion" | "unidad">>;

/** Lowercase id usable as a CSV kpi value and a URL segment. */
export const METRICA_ID_RE = /^[a-z][a-z0-9_]{1,23}$/;

/** Adds a custom flujo metric at the end of the order. false when the id is taken. */
export async function addMetrica(m: NuevaMetrica): Promise<boolean> {
	if (!METRICA_ID_RE.test(m.id)) throw new Error("id de métrica inválido");
	const [{ ultimo }] = await db
		.select({ ultimo: max(kpiDefiniciones.orden) })
		.from(kpiDefiniciones);
	const { id, ...rest } = m;
	const rows = await db
		.insert(kpiDefiniciones)
		.values({
			...rest,
			kpi: id,
			tipo: "custom",
			acumulacion: "flujo",
			activa: m.activa ?? false,
			orden: (ultimo ?? -1) + 1,
		})
		.onConflictDoNothing()
		.returning({ kpi: kpiDefiniciones.kpi });
	return rows.length > 0;
}

export async function setJuegoGlobal(
	juego: JuegoId,
	activo: boolean,
): Promise<void> {
	await db
		.insert(juegos)
		.values({ id: juego, nombre: JUEGO_LABEL[juego], activo })
		.onConflictDoUpdate({ target: juegos.id, set: { activo } });
}

/** "YYYY-MM" of the month before. */
export function mesAnterior(periodoId: string): string {
	const [y, m] = periodoId.split("-").map(Number);
	return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Turns a game on or off for a sucursal from periodoId on (usually the month in
 * progress). On: opens an interval at periodoId unless one already covers it.
 * Off: the covering interval ends the month before, or is deleted if it starts at periodoId.
 */
export async function setJuegoSucursal(
	juego: JuegoId,
	sucursal: string,
	activo: boolean,
	periodoId: string,
): Promise<void> {
	const de = and(
		eq(juegosSucursal.juego, juego),
		eq(juegosSucursal.sucursal, sucursal),
	);
	const intervalos = await db.select().from(juegosSucursal).where(de);
	const cubre = intervalos.find(
		(i) => i.desde <= periodoId && (i.hasta === null || periodoId <= i.hasta),
	);
	if (activo) {
		if (cubre) return;
		await db
			.insert(juegosSucursal)
			.values({ juego, sucursal, desde: periodoId, hasta: null })
			.onConflictDoUpdate({
				target: [
					juegosSucursal.juego,
					juegosSucursal.sucursal,
					juegosSucursal.desde,
				],
				set: { hasta: null },
			});
		return;
	}
	if (!cubre) return;
	const fila = and(de, eq(juegosSucursal.desde, cubre.desde));
	if (cubre.desde >= periodoId) await db.delete(juegosSucursal).where(fila);
	else
		await db
			.update(juegosSucursal)
			.set({ hasta: mesAnterior(periodoId) })
			.where(fila);
}

export async function upsertPremio(p: Premio): Promise<void> {
	const { id, ...rest } = p;
	await db
		.insert(premios)
		.values(p)
		.onConflictDoUpdate({ target: premios.id, set: rest });
}

export async function setAjuste(
	clave: keyof Ajustes,
	valor: number,
): Promise<void> {
	if (!Object.hasOwn(AJUSTES_DEFAULT, clave) || !Number.isFinite(valor))
		throw new Error("ajuste inválido");
	await db
		.insert(ajustes)
		.values({ clave, valor })
		.onConflictDoUpdate({ target: ajustes.clave, set: { valor } });
}

/** Real engagement: one row per (day, seller, game, evento), cantidad +1. */
export async function registrarEvento(
	vendedorId: string,
	juego: JuegoId,
	evento: EventoEngagement,
	fecha: string = hoy(),
): Promise<void> {
	await db
		.insert(engagement)
		.values({ fecha, vendedorId, juego, evento, cantidad: 1, fuente: "real" })
		.onConflictDoUpdate({
			target: [
				engagement.fecha,
				engagement.vendedorId,
				engagement.juego,
				engagement.evento,
				engagement.fuente,
			],
			set: { cantidad: sql`${engagement.cantidad} + 1` },
		});
}

export type TipoReclamo = (typeof reclamos.$inferInsert)["tipo"];

/** reclamos.ref of a figu: one per (month, metric) for a seller. */
export const refFigu = (periodoId: string, metrica: MetricaId) =>
	`${periodoId}:${metrica}`;

/**
 * Records a claim (idempotent: a repeated claim changes nothing and returns false) and, on
 * the first claim, a real engagement event "reclamo" for its game: album for a figu, the
 * prize's juego for a premio. The caller checks the claim is in reclamables() first.
 */
export async function reclamar(
	vendedorId: string,
	tipo: TipoReclamo,
	ref: string,
	periodoId: string,
): Promise<boolean> {
	let juego: JuegoId = "album";
	if (tipo === "premio") {
		const [p] = await db
			.select({ juego: premios.juego, periodoId: premios.periodoId })
			.from(premios)
			.where(eq(premios.id, ref));
		if (!p || p.periodoId !== periodoId) throw new Error("premio desconocido");
		juego = p.juego;
	} else if (!ref.startsWith(`${periodoId}:`)) throw new Error("figu inválida");
	const nuevos = await db
		.insert(reclamos)
		.values({ vendedorId, tipo, ref, periodoId })
		.onConflictDoNothing()
		.returning({ ref: reclamos.ref });
	if (nuevos.length === 0) return false;
	await registrarEvento(vendedorId, juego, "reclamo");
	return true;
}
