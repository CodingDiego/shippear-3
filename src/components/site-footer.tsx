import Link from "next/link";

export const REPO_URL = "https://github.com/CodingDiego/shippear-3";

export function SiteFooter() {
	return (
		<footer className="foot">
			<div className="wrap top">
				<div>
					<h2>Así se usa Figu durante un mes.</h2>
					<Link className="btn" href="/como-funciona">
						Ver cómo funciona
					</Link>
				</div>
				<ul>
					<li>
						<Link href="/supuestos">Supuestos del puntaje</Link>
					</li>
					<li>
						<Link href="/supuestos#csv">Formato del CSV</Link>
					</li>
					<li>
						<a href={REPO_URL}>Código en GitHub</a>
					</li>
				</ul>
			</div>
			<div className="wrap">
				<div className="credits">
					<span>Caso La Virginia, Ranking de Vendedores.</span>
					<span>Shippe.ar Hackathon 3, Rosario, 2026.</span>
				</div>
				<div className="word" aria-hidden="true">
					FIGU
				</div>
			</div>
		</footer>
	);
}
