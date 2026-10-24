import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDataset, getRevelacion, getSeasonMeta } from "@/lib/data/queries";
import {
	canalNombre,
	fmtScore,
	mesNombre,
	pct,
	periodoLabel,
	shortName,
	sucursalNombre,
} from "@/lib/format";

export const metadata: Metadata = { title: "Revelación del mes" };

export default function Page() {
	return (
		<main className="wrap">
			<div className="title">
				<h1>Revelación del mes</h1>
				<Suspense
					fallback={
						<p className="skeleton">
							Un vendedor subió puntos, de uno a otro. Mes contra mes anterior.
						</p>
					}
				>
					<Lead />
				</Suspense>
			</div>
			<Suspense fallback={<BodySkeleton />}>
				<Body />
			</Suspense>
		</main>
	);
}

async function load() {
	const [r, d, meta] = await Promise.all([
		getRevelacion(),
		getDataset(),
		getSeasonMeta(),
	]);
	return { r, ids: new Map(d.vendedores.map((v) => [v.id, v])), meta };
}

type Ids = Awaited<ReturnType<typeof load>>["ids"];

async function Lead() {
	const { r, ids, meta } = await load();
	const a = r.absoluta[0];
	const v = a && ids.get(a.vendedorId);
	if (!a || !v || !r.periodoId)
		return <p>Hace falta un segundo mes con datos para comparar.</p>;
	const prev = meta.periodos[meta.periodos.indexOf(r.periodoId) - 1];
	return (
		<p>
			<b>
				{a.delta > 0
					? `${shortName(v)} subió ${fmtScore(a.delta)} puntos, de ${fmtScore(a.anterior)} a ${fmtScore(a.actual)}.`
					: `Nadie subió puntaje en ${mesNombre(r.periodoId)}.`}
			</b>{" "}
			{r.absoluta.length} vendedores tienen puntaje en {mesNombre(r.periodoId)}{" "}
			y en {prev ? mesNombre(prev) : "el mes anterior"}.
		</p>
	);
}

type Item = { id: string; value: string; extra: string };

function Section({
	title,
	hint,
	items,
	empty,
	ids,
}: {
	title: string;
	hint: string;
	items: Item[];
	empty: string;
	ids: Ids;
}) {
	return (
		<section>
			<h2 className="h2">
				{title} <span>{hint}</span>
			</h2>
			{items.length === 0 ? (
				<p className="note">{empty}</p>
			) : (
				<div className="rows">
					{items.slice(0, 5).map((it, i) => {
						const v = ids.get(it.id);
						return (
							<Link className="row" href={`/vendedor/${it.id}`} key={it.id}>
								<b>{i + 1}</b>
								<div className="who">
									{v ? shortName(v) : it.id}{" "}
									<span>
										{v
											? `${sucursalNombre(v.sucursal)}, ${canalNombre(v.canal)}, `
											: ""}
										{it.extra}
									</span>
								</div>
								<div className="pts">{it.value}</div>
							</Link>
						);
					})}
				</div>
			)}
		</section>
	);
}

async function Body() {
	const { r, ids } = await load();
	if (r.absoluta.length === 0) return null;
	return (
		<>
			<Section
				title="Suba absoluta"
				hint="puntos ganados contra el mes anterior"
				ids={ids}
				empty="Nadie sumó puntos contra el mes anterior."
				items={r.absoluta
					.filter((x) => x.delta > 0)
					.map((x) => ({
						id: x.vendedorId,
						value: `+${fmtScore(x.delta)}`,
						extra: `${fmtScore(x.anterior)} a ${fmtScore(x.actual)}`,
					}))}
			/>
			<Section
				title="Suba relativa"
				hint="parte del margen que quedaba hasta 100"
				ids={ids}
				empty="Nadie subió con margen para medir."
				items={r.relativa.map((x) => ({
					id: x.vendedorId,
					value: pct(x.relativa, true),
					extra: `${fmtScore(x.anterior)} a ${fmtScore(x.actual)}`,
				}))}
			/>
			<Section
				title="Racha"
				hint="meses seguidos subiendo"
				ids={ids}
				empty="Nadie lleva tres meses seguidos de suba."
				items={r.racha.map((x) => ({
					id: x.vendedorId,
					value: `${x.racha} meses`,
					extra: `+${fmtScore(x.ganancia)} en la racha`,
				}))}
			/>
			<Section
				title="Remontada del año"
				hint="del peor puesto al actual, con seis meses jugados"
				ids={ids}
				empty="Hacen falta seis meses de datos para medir remontadas."
				items={r.remontada.map((x) => ({
					id: x.vendedorId,
					value: `+${x.remontada}`,
					extra: `del ${x.peorPuesto} (${periodoLabel(x.peorPeriodoId)}) al ${x.puestoActual}`,
				}))}
			/>
		</>
	);
}

const SECCIONES = [
	["Suba absoluta", "puntos ganados contra el mes anterior"],
	["Suba relativa", "parte del margen que quedaba hasta 100"],
	["Racha", "meses seguidos subiendo"],
	["Remontada del año", "del peor puesto al actual, con seis meses jugados"],
];

function BodySkeleton() {
	return (
		<>
			{SECCIONES.map(([t, h]) => (
				<section key={t}>
					<h2 className="h2">
						{t} <span>{h}</span>
					</h2>
					<div className="rows">
						{Array.from({ length: 5 }, (_, i) => (
							<div className="row" key={String(i)} data-loading="">
								<b>{i + 1}</b>
								<div className="who">x</div>
								<div className="pts">0</div>
							</div>
						))}
					</div>
				</section>
			))}
		</>
	);
}
