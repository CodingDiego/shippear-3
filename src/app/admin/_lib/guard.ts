import { redirect } from "next/navigation";
import { connection } from "next/server";
import { esAdmin } from "@/lib/auth/server";

/**
 * esAdmin for pages. verifySession reads Date.now(), which cacheComponents allows only
 * after request-time data, so connection() comes first.
 */
export async function adminSesion(): Promise<boolean> {
	await connection();
	return esAdmin();
}

/** Admin pages: back to the login when the cookie is missing or expired. */
export async function exigirAdmin(): Promise<void> {
	if (!(await adminSesion())) redirect("/admin");
}

/** Admin server actions: refuse the write without a valid admin cookie. */
export async function soloAdmin(): Promise<void> {
	if (!(await esAdmin()))
		throw new Error("Tu sesión de administración venció. Entrá de nuevo.");
}
