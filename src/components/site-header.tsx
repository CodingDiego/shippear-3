import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, NavList } from "./nav-links";

export function SiteHeader() {
	return (
		<header className="bar-band">
			<div className="wrap bar">
				<Link className="mark" href="/">
					<i aria-hidden="true" />
					Figu
				</Link>
				<nav aria-label="Secciones">
					<Suspense fallback={<NavList />}>
						<NavLinks />
					</Suspense>
				</nav>
			</div>
		</header>
	);
}
