import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { vendedorSesion } from "@/lib/auth/server";
import { getDataset, getTracker } from "@/lib/data/queries";

const schema = z.object({ ventana: z.enum(["mes", "semana"]).default("mes") });

const privado = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest) {
	const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
	if (!parsed.success)
		return NextResponse.json(
			{ error: z.prettifyError(parsed.error) },
			{ status: 400, headers: privado },
		);
	// Session read outside any cache scope; only the plain id goes into getTracker.
	const id = await vendedorSesion();
	if (!id)
		return NextResponse.json(
			{ error: "sesión requerida" },
			{ status: 401, headers: privado },
		);
	const { vendedores } = await getDataset();
	if (!vendedores.some((v) => v.id === id))
		return NextResponse.json(
			{ error: "vendedor desconocido" },
			{ status: 401, headers: privado },
		);
	return NextResponse.json(await getTracker(id, parsed.data.ventana), {
		headers: privado,
	});
}
