// Seller PIN attempt limit, stored in Postgres so it holds across serverless instances.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { intentosPin } from "@/db/schema";

export const MAX_FALLOS = 5;
export const BLOQUEO_MIN = 15;

/** Minutes left on the lock for this code, or 0 when it may try again. */
export async function minutosBloqueado(codigo: string): Promise<number> {
	const [row] = await db
		.select({
			min: sql<number>`ceil(extract(epoch from (${intentosPin.bloqueadoHasta} - now())) / 60)`,
		})
		.from(intentosPin)
		.where(eq(intentosPin.codigo, codigo));
	return row?.min && Number(row.min) > 0 ? Number(row.min) : 0;
}

/** Counts a miss; the fifth one locks the code and resets the count. */
export async function registrarFallo(codigo: string): Promise<void> {
	await db
		.insert(intentosPin)
		.values({ codigo, fallos: 1 })
		.onConflictDoUpdate({
			target: intentosPin.codigo,
			set: {
				fallos: sql`case when ${intentosPin.fallos} + 1 >= ${MAX_FALLOS} then 0 else ${intentosPin.fallos} + 1 end`,
				bloqueadoHasta: sql`case when ${intentosPin.fallos} + 1 >= ${MAX_FALLOS} then now() + make_interval(mins => ${BLOQUEO_MIN}) else ${intentosPin.bloqueadoHasta} end`,
			},
		});
}

export async function limpiarFallos(codigo: string): Promise<void> {
	await db.delete(intentosPin).where(eq(intentosPin.codigo, codigo));
}
