import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import "./juegos.css";
import { getDataset, getJuegosConfig, getSeasonMeta } from "@/lib/data/queries";
import { JUEGOS } from "@/lib/domain";
import { getQueryClient } from "@/lib/query/client";
import { juegosMedidasOptions } from "@/lib/query/juegos";
import { exigirAdmin } from "../_lib/guard";
import { Detalle, Resumen } from "./_components/medidas";
import { ConReintento } from "./_components/reintentar";
import { Switches } from "./_components/switches";
import { getJuegosVista } from "./data";

export const metadata = { title: "Juegos" };

export default function JuegosPage() {
	return (
		<main className="wrap jg">
			<header className="title">
				<h1>Juegos</h1>
				<p>
					Prendé o apagá la Liga, la Revelación y el Álbum en todo el país o en
					cada sucursal, y mirá cuál hace vender más y por qué.
				</p>
			</header>
			<p className="jg-simulado" role="note">
				Parte de esta historia es simulada: qué sucursal tuvo cada juego desde
				octubre de 2025, las vistas e interacciones de esos meses y los premios
				cargados los generó la demo. Lo que hagan los vendedores en esta app se
				suma como uso real.
			</p>
			<Suspense
				fallback={
					<>
						<ResumenSkeleton />
						<SwitchesSkeleton />
						<DetalleSkeleton />
					</>
				}
			>
				<SoloAdmin>
					<h2 className="h2">Cuál funciona mejor</h2>
					<Suspense fallback={<ResumenSkeleton />}>
						<Medidas>
							<Resumen />
						</Medidas>
					</Suspense>
					<h2 className="h2">Dónde está prendido cada juego</h2>
					<Suspense fallback={<SwitchesSkeleton />}>
						<SwitchesSection />
					</Suspense>
					<Suspense fallback={<DetalleSkeleton />}>
						<Medidas>
							<Detalle />
						</Medidas>
					</Suspense>
				</SoloAdmin>
			</Suspense>
		</main>
	);
}

// proxy.ts only redirects; the page checks the admin cookie again.
async function SoloAdmin({ children }: { children: ReactNode }) {
	await exigirAdmin();
	return children;
}

async function Medidas({ children }: { children: ReactNode }) {
	// react-query reads Date.now(), which cacheComponents only allows after request-time data.
	await connection();
	const queryClient = getQueryClient();
	await queryClient.prefetchQuery({
		...juegosMedidasOptions(),
		queryFn: () => getJuegosVista(),
	});
	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ConReintento>{children}</ConReintento>
		</HydrationBoundary>
	);
}

async function SwitchesSection() {
	const [config, meta, d] = await Promise.all([
		getJuegosConfig(),
		getSeasonMeta(),
		getDataset(),
	]);
	const meses = d.periodos
		.map((p) => p.id)
		.filter((id) => id === meta.enCurso || meta.periodos.includes(id))
		.reverse();
	return (
		<Switches
			global={config.global}
			intervalos={config.intervalos}
			sucursales={d.sucursales.map((s) => ({ slug: s.slug, nombre: s.nombre }))}
			meses={meses}
			enCurso={meta.enCurso}
		/>
	);
}

function ResumenSkeleton() {
	return (
		<ol className="jg-resumen" aria-hidden>
			{JUEGOS.map((j) => (
				<li key={j} className="panel skeleton jg-sk-resumen" />
			))}
		</ol>
	);
}

function SwitchesSkeleton() {
	return (
		<div className="jg-switches" aria-hidden>
			<div className="panel skeleton jg-sk-global" />
			<div className="panel skeleton jg-sk-grid" />
		</div>
	);
}

function DetalleSkeleton() {
	return (
		<div aria-hidden>
			{["efecto", "uso", "premios"].map((k) => (
				<div key={k}>
					<div className="h2">
						<span className="skeleton jg-sk-h2" />
					</div>
					<div className="panel skeleton jg-sk-chart" />
				</div>
			))}
		</div>
	);
}
