// Server-side session reads (route handlers, server actions, pages). Never call these
// inside a "use cache" scope: read the session here and pass the plain id in.
import { cookies } from "next/headers";
import { env } from "@/env";
import {
	ADMIN_COOKIE,
	ADMIN_MAX_AGE,
	ADMIN_SUB,
	cookieOptions,
	SESSION_COOKIE,
	SESSION_MAX_AGE,
	signSession,
	verifySession,
} from "./index";

/** The logged-in seller's id, or null. An admin token in the seller cookie is rejected. */
export async function vendedorSesion(): Promise<string | null> {
	const token = (await cookies()).get(SESSION_COOKIE)?.value;
	const s = await verifySession(token, env.AUTH_SECRET);
	return s && s.sub !== ADMIN_SUB ? s.sub : null;
}

/** Valid admin cookie. Every admin action and admin GET route calls this. */
export async function esAdmin(): Promise<boolean> {
	const token = (await cookies()).get(ADMIN_COOKIE)?.value;
	const s = await verifySession(token, env.AUTH_SECRET);
	return s?.sub === ADMIN_SUB;
}

/** Sets the seller session cookie (server actions only). */
export async function entrarComo(vendedorId: string): Promise<void> {
	const token = await signSession(vendedorId, SESSION_MAX_AGE, env.AUTH_SECRET);
	(await cookies()).set(
		SESSION_COOKIE,
		token,
		cookieOptions(SESSION_MAX_AGE, env.APP_ENV),
	);
}

/** Sets the admin cookie (server actions only, after checkAdminPasscode). */
export async function entrarAdmin(): Promise<void> {
	const token = await signSession(ADMIN_SUB, ADMIN_MAX_AGE, env.AUTH_SECRET);
	(await cookies()).set(
		ADMIN_COOKIE,
		token,
		cookieOptions(ADMIN_MAX_AGE, env.APP_ENV),
	);
}

/** Clears one session cookie. */
export async function salir(
	cookie: typeof SESSION_COOKIE | typeof ADMIN_COOKIE,
) {
	(await cookies()).delete(cookie);
}
