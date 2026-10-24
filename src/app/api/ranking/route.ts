import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSeasonMeta } from "@/lib/data/queries";
import {
	PERIODO_BY_ID,
	PROVINCIA_BY_SLUG,
	SUCURSAL_BY_SLUG,
} from "@/lib/domain";
import { loadRanking } from "@/lib/query/ranking";

const slugDe = (map: Record<string, unknown>, msg: string) =>
	z
		.string()
		.refine((s) => s === "" || Object.hasOwn(map, s), msg)
		.default("");

// Scope: nacional (no filter), provincia (?provincia=), sucursal (?sucursal=).
const schema = z.object({
	periodo: slugDe(PERIODO_BY_ID, "periodo desconocido"),
	vista: z.enum(["mes", "acum", "mix"]).default("mes"),
	sucursal: slugDe(SUCURSAL_BY_SLUG, "sucursal desconocida"),
	provincia: slugDe(PROVINCIA_BY_SLUG, "provincia desconocida"),
	canal: z.enum(["plaza", "campaña", ""]).default(""),
});

export async function GET(req: NextRequest) {
	const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: z.prettifyError(parsed.error) },
			{ status: 400 },
		);
	}
	const { periodo, vista, sucursal, provincia, canal } = parsed.data;
	const meta = await getSeasonMeta();
	if (periodo && !meta.periodos.includes(periodo))
		return NextResponse.json(
			{ error: "periodo sin datos o en curso" },
			{ status: 400 },
		);
	const body = await loadRanking({
		periodo: periodo || meta.latest,
		vista,
		sucursal,
		provincia,
		canal: canal || null,
	});
	return NextResponse.json(body, {
		headers: { "Cache-Control": "public, max-age=60, s-maxage=3600" },
	});
}
