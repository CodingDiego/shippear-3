import { NextResponse } from "next/server";
import { esAdmin } from "@/lib/auth/server";
import { getJuegosVista } from "../data";

const privado = { "Cache-Control": "private, no-store" };

export async function GET() {
	if (!(await esAdmin()))
		return NextResponse.json(
			{ error: "sesión de admin requerida" },
			{ status: 401, headers: privado },
		);
	return NextResponse.json(await getJuegosVista(), { headers: privado });
}
