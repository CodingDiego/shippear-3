"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
	["/ranking", "Ranking"],
	["/liga", "Liga"],
	["/revelacion", "Revelación"],
	["/album", "Álbum"],
	["/como-funciona", "Cómo funciona"],
	// The proxy sends a logged-out seller from /yo to /entrar.
	["/yo", "Mi mes"],
	["/admin", "Administración"],
] as const;

export function NavLinks() {
	return <NavList pathname={usePathname()} />;
}

/** Same list without a current link: the Suspense fallback while the pathname is unknown. */
export function NavList({ pathname = "" }: { pathname?: string }) {
	return (
		<ul>
			{NAV.map(([href, label]) => {
				const current = pathname === href || pathname.startsWith(`${href}/`);
				return (
					<li key={href}>
						<Link href={href} aria-current={current ? "page" : undefined}>
							{label}
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
