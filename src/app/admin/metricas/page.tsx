import { Suspense } from "react";
import {
	getAjustes,
	getConstancias,
	getMetricas,
	getScoredPeriod,
	getSeasonMeta,
} from "@/lib/data/queries";
import { provinciaDe } from "@/lib/domain";
import { fullName, mesNombre } from "@/lib/format";
import { exigirAdmin } from "../_lib/guard";
import { AjustesForm, NuevaMetricaForm } from "./_components/forms";
import { MetricasForm } from "./_components/metricas-form";
import {
	type FilaVendedor,
	VendedoresTabla,
} from "./_components/vendedores-tabla";

export const metadata = { title: "Métricas" };

export default function MetricasPage() {
	return (
		<main className="wrap adm-main">
			<header className="title">
				<h1>Métricas</h1>
				<p>
					Prendé o apagá cada métrica y ajustá su peso. El puntaje de la carta
					reparte el 100 % entre las métricas activas, en proporción a su peso.
				</p>
			</header>
			<Suspense fallback={<MetricasSkeleton />}>
				<Metricas />
			</Suspense>
		</main>
	);
}

async function Metricas() {
	await exigirAdmin();
	const [metricas, ajustes, meta] = await Promise.all([
		getMetricas(),
		getAjustes(),
		getSeasonMeta(),
	]);
	const periodo = meta.enCurso ?? meta.latest;
	const [scored, constancias] = await Promise.all([
		getScoredPeriod(periodo, "mes"),
		getConstancias(periodo),
	]);
	const filas: FilaVendedor[] = scored.vendedores
		.map((v) => ({
			id: v.vendedor.id,
			nombre: fullName(v.vendedor),
			sucursal: v.vendedor.sucursal,
			provincia: provinciaDe(v.vendedor.sucursal) ?? "",
			score: v.score,
			constancia: constancias[v.vendedor.id] ?? null,
		}))
		.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
	const mes = `${mesNombre(periodo)}${meta.enCurso ? ", en curso" : ""}`;
	return (
		<>
			<MetricasForm
				metricas={[...metricas].sort((a, b) => a.orden - b.orden)}
			/>

			<h2 className="h2">Meta y margen</h2>
			<AjustesForm ajustes={ajustes} />

			<h2 className="h2">Agregar una métrica propia</h2>
			<NuevaMetricaForm />

			<h2 className="h2">
				Cómo van los vendedores <span>{mes}</span>
			</h2>
			<VendedoresTabla filas={filas} meta={ajustes.meta_puntos} mes={mes} />
		</>
	);
}

function MetricasSkeleton() {
	return (
		<div className="panel adm-met skeleton" aria-hidden="true">
			<ul className="adm-met-list">
				{Array.from({ length: 9 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
					<li key={i} className="adm-met-row">
						<span>Métrica</span>
					</li>
				))}
			</ul>
		</div>
	);
}
