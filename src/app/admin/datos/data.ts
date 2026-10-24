import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { periodos } from "@/db/schema";
import { readMeta } from "@/lib/data/db-reads";

/**
 * Uncached: the month the close would act on, straight from the DB, so a close that just
 * ran is never shown as still open. Also the seed the dataset was generated with.
 */
export async function mesAbierto(): Promise<{
	periodoId: string | null;
	seed: number;
}> {
	const [[p], meta] = await Promise.all([
		db
			.select({ id: periodos.id })
			.from(periodos)
			.where(eq(periodos.enCurso, true))
			.orderBy(periodos.id)
			.limit(1),
		readMeta(),
	]);
	return { periodoId: p?.id ?? null, seed: meta?.seed ?? DEMO_SEED };
}

export const DEMO_SEED = 42;
