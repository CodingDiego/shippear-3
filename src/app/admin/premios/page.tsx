import { Suspense } from "react";
import { getPremios, getSeasonMeta } from "@/lib/data/queries";
import { exigirAdmin } from "../_lib/guard";
import { PremiosAdmin } from "./_components/premios-admin";

export const metadata = { title: "Premios" };

export default function PremiosPage() {
	return (
		<main className="wrap adm-main">
			<header className="title">
				<h1>Premios</h1>
				<p>
					Un premio por juego y por mes. Lo reciben las sucursales donde ese
					juego estaba prendido ese mes, y su costo entra en el cálculo de
					cuánto rinde cada juego.
				</p>
			</header>
			<Suspense fallback={<PremiosSkeleton />}>
				<Premios />
			</Suspense>
		</main>
	);
}

async function Premios() {
	await exigirAdmin();
	const [premios, meta] = await Promise.all([getPremios(), getSeasonMeta()]);
	return (
		<PremiosAdmin premios={premios} mesInicial={meta.enCurso ?? meta.latest} />
	);
}

function PremiosSkeleton() {
	return (
		<>
			<div className="adm-stats panel skeleton" aria-hidden="true">
				{["a", "b", "c", "d"].map((k) => (
					<div className="stat" key={k}>
						<b>$ 0</b>
						<span>cargando</span>
					</div>
				))}
			</div>
			<div className="panel skeleton adm-sk-block" aria-hidden="true" />
		</>
	);
}
