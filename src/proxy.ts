import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { env } from "@/env";
import {
	ADMIN_COOKIE,
	ADMIN_SUB,
	SESSION_COOKIE,
	verifySession,
} from "@/lib/auth";
import { KPI_DEFS, SUCURSAL_BY_SLUG } from "@/lib/domain";

// Explicit paths only, so static assets and /.well-known/workflow never reach the proxy.
export const config = {
	matcher: [
		"/ranking/sucursal/:slug",
		"/kpi/:kpi",
		"/vendedor/:id",
		"/yo/:path*",
		"/admin/:path+",
	],
};

// Pages stream from a Suspense boundary, so notFound() there keeps a 200.
// Unknown params are rejected here, before streaming, to get a real 404.
async function exists(path: string): Promise<boolean> {
	const [, seg, a, b] = path.split("/");
	if (seg === "ranking") return Object.hasOwn(SUCURSAL_BY_SLUG, b ?? "");
	if (seg === "kpi") return Object.hasOwn(KPI_DEFS, a);
	const rows = await db
		.select({ id: schema.vendedores.id })
		.from(schema.vendedores)
		.where(eq(schema.vendedores.id, a))
		.limit(1);
	return rows.length > 0;
}

// Convenience redirect only: pages, actions and routes verify the cookie again.
async function autorizado(req: NextRequest, seg: string): Promise<boolean> {
	const admin = seg === "admin";
	const s = await verifySession(
		req.cookies.get(admin ? ADMIN_COOKIE : SESSION_COOKIE)?.value,
		env.AUTH_SECRET,
	);
	return !!s && (s.sub === ADMIN_SUB) === admin;
}

export async function proxy(request: NextRequest) {
	const path = request.nextUrl.pathname;
	const seg = path.split("/")[1];
	if (seg === "yo" || seg === "admin") {
		if (await autorizado(request, seg)) return NextResponse.next();
		return NextResponse.redirect(
			new URL(seg === "admin" ? "/admin" : "/entrar", request.url),
		);
	}
	if (await exists(path)) return NextResponse.next();
	// Any unmatched path renders src/app/not-found.tsx with a 404 status.
	return NextResponse.rewrite(new URL("/_not-found", request.url), {
		status: 404,
	});
}
