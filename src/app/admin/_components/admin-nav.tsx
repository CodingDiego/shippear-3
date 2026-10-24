"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { salirAdmin } from "../actions";

const SECCIONES = [
	["/admin", "Resumen"],
	["/admin/metricas", "Métricas"],
	["/admin/juegos", "Juegos"],
	["/admin/premios", "Premios"],
	["/admin/datos", "Datos"],
] as const;

export function AdminNav() {
	return <AdminNavList pathname={usePathname()} />;
}

/** Same nav without a current link: the Suspense fallback. */
export function AdminNavList({ pathname = "" }: { pathname?: string }) {
	return (
		<nav className="adm-nav" aria-label="Administración">
			<div className="tabs">
				{SECCIONES.map(([href, label]) => {
					const actual =
						href === "/admin"
							? pathname === href
							: pathname === href || pathname.startsWith(`${href}/`);
					return (
						<Link
							key={href}
							href={href}
							aria-current={actual ? "page" : undefined}
						>
							{label}
						</Link>
					);
				})}
			</div>
			<form action={salirAdmin}>
				<button type="submit" className="btn btn-ghost">
					Salir
				</button>
			</form>
		</nav>
	);
}
