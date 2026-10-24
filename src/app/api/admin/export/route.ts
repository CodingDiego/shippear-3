import { esAdmin } from "@/lib/auth/server";
import { toCsv } from "@/lib/csv";
import { getDataset } from "@/lib/data/queries";
import { hoy } from "@/lib/domain";

const privado = { "Cache-Control": "private, no-store" };

export async function GET() {
	if (!(await esAdmin()))
		return Response.json(
			{ error: "sesión de administración requerida" },
			{ status: 401, headers: privado },
		);
	return new Response(toCsv(await getDataset()), {
		headers: {
			...privado,
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="figu-${hoy()}.csv"`,
		},
	});
}
