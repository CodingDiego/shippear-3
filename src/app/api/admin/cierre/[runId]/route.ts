import type { NextRequest } from "next/server";
import { getRun } from "workflow/api";
import { esAdmin } from "@/lib/auth/server";
import { estadoCierre } from "@/lib/cierre";
import { PERIODO_BY_ID } from "@/lib/domain";
import type { CierreResponse } from "@/lib/query/admin";

const privado = { "Cache-Control": "private, no-store" };
const RUN_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Run status of a "Simular cierre de mes" workflow plus the close steps done in the DB. */
export async function GET(
	req: NextRequest,
	ctx: RouteContext<"/api/admin/cierre/[runId]">,
) {
	if (!(await esAdmin()))
		return Response.json(
			{ error: "sesión de administración requerida" },
			{ status: 401, headers: privado },
		);
	const { runId } = await ctx.params;
	const periodo = req.nextUrl.searchParams.get("periodo") ?? "";
	if (!RUN_ID.test(runId) || !Object.hasOwn(PERIODO_BY_ID, periodo))
		return Response.json(
			{ error: "runId o periodo inválido" },
			{ status: 400, headers: privado },
		);
	let status: CierreResponse["status"];
	try {
		status = await getRun(runId).status;
	} catch {
		return Response.json(
			{ error: "no existe esa corrida" },
			{ status: 404, headers: privado },
		);
	}
	const body: CierreResponse = { status, estado: await estadoCierre(periodo) };
	return Response.json(body, { headers: privado });
}
