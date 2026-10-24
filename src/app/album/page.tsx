import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./album.css";
import { getAlbum, getDataset, getSeasonMeta } from "@/lib/data/queries";
import { KPI_DEFS, KPI_IDS } from "@/lib/domain";
import { mesNombre, shortName, sucursalNombre } from "@/lib/format";
import { albumDe } from "@/lib/modes";

export const metadata: Metadata = { title: "Álbum de figuritas" };

const TOP = 30;

export default function Page() {
	return (
		<main className="wrap">
			<div className="title">
				<h1>Álbum de figuritas</h1>
				<Suspense
					fallback={<p className="skeleton">Alguien tiene muchas figus.</p>}
				>
					<Lead />
				</Suspense>
			</div>

			<Suspense fallback={<LegendariasSkeleton />}>
				<Legendarias />
			</Suspense>

			<Suspense fallback={<ColeccionistasSkeleton />}>
				<Coleccionistas />
			</Suspense>

			<h2 className="h2">Rarezas</h2>
			<p className="note">Legendaria: oro nacional.</p>
			<p className="note">Épica: plata o bronce nacional.</p>
			<p className="note">Rara: oro de sucursal.</p>
			<p className="note">Común: plata o bronce de sucursal.</p>
			<p className="note">
				Holográfica: oro nacional en el mismo KPI tres meses seguidos.
			</p>
		</main>
	);
}

async function coleccion() {
	const [figus, d, meta] = await Promise.all([
		getAlbum(),
		getDataset(),
		getSeasonMeta(),
	]);
	const filas = d.vendedores
		.map((v) => {
			const a = albumDe(figus, v.id);
			const propias = figus.filter((f) => f.vendedorId === v.id);
			return {
				v,
				total: a.total,
				kpis: Math.round(a.completado * KPI_IDS.length),
				holo: propias.filter((f) => f.holografica).length,
				legendarias: propias.filter((f) => f.rareza === "legendaria").length,
			};
		})
		.sort(
			(a, b) =>
				b.total - a.total || b.holo - a.holo || a.v.id.localeCompare(b.v.id),
		);
	return { figus, d, meta, filas };
}

async function Lead() {
	const { figus, meta, filas } = await coleccion();
	const top = filas[0];
	if (!top) return <p>Todavía no hay figus en el álbum.</p>;
	return (
		<p>
			<b>
				{shortName(top.v)} tiene {top.total} figus, con al menos una en{" "}
				{top.kpis} de {KPI_IDS.length} KPIs.
			</b>{" "}
			{figus.length} figus repartidas en {meta.periodos.length} meses;{" "}
			{figus.filter((f) => f.holografica).length} holográficas.
		</p>
	);
}

async function Legendarias() {
	const { figus, d, meta } = await coleccion();
	const mes = mesNombre(meta.latest);
	const vendedores = new Map(d.vendedores.map((v) => [v.id, v]));
	return (
		<>
			<h2 className="h2">
				Legendarias de {mes} <span>oro nacional en cada KPI</span>
			</h2>
			<div className="rows legendarias">
				{KPI_IDS.map((k) => {
					const f = figus.find(
						(x) =>
							x.periodoId === meta.latest &&
							x.kpi === k &&
							x.rareza === "legendaria",
					);
					const v = f && vendedores.get(f.vendedorId);
					return (
						<div className="row" key={k}>
							<b>{KPI_DEFS[k].corto}</b>
							<div className="who">
								{v ? (
									<>
										{shortName(v)}, <span>{sucursalNombre(v.sucursal)}</span>
									</>
								) : (
									<span>sin figu</span>
								)}
							</div>
							<div className="pts">
								{f && (
									<i
										className="sticker"
										data-m="oro"
										data-holo={f.holografica ? "" : undefined}
										role="img"
										aria-label={
											f.holografica ? "figu holográfica" : "figu de oro"
										}
									/>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}

function LegendariasSkeleton() {
	return (
		<>
			<h2 className="h2 skeleton">Legendarias de septiembre</h2>
			<div className="rows legendarias">
				{KPI_IDS.map((k) => (
					<div className="row" key={k} data-loading="">
						<b>x</b>
						<div className="who">x</div>
						<div className="pts">x</div>
					</div>
				))}
			</div>
		</>
	);
}

// .table right-aligns every column after the first; names stay left.
const LEFT = new Set(["Vendedor", "Sucursal"]);
const HEAD = [
	"#",
	"Vendedor",
	"Sucursal",
	"Figus",
	"KPIs",
	"Holográficas",
	"Legendarias",
];

async function Coleccionistas() {
	const { filas } = await coleccion();
	return (
		<>
			<h2 className="h2">
				Coleccionistas <span>{filas.length} vendedores, por figus</span>
			</h2>
			<div className="overflow-x-auto">
				<table className="table">
					<thead>
						<tr>
							{HEAD.map((h) => (
								<th key={h} className={LEFT.has(h) ? "text-left!" : undefined}>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{filas.slice(0, TOP).map((r, i) => (
							<tr key={r.v.id}>
								<td>{i + 1}</td>
								<td className="text-left!">
									<Link href={`/vendedor/${r.v.id}`}>{shortName(r.v)}</Link>
								</td>
								<td className="text-left!">{sucursalNombre(r.v.sucursal)}</td>
								<td>
									<b>{r.total}</b>
								</td>
								<td>
									{r.kpis} de {KPI_IDS.length}
								</td>
								<td>{r.holo}</td>
								<td>{r.legendarias}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{filas.length > TOP && (
				<p className="note mt-3">
					Y {filas.length - TOP} vendedores más; cada carta tiene su álbum
					completo.
				</p>
			)}
		</>
	);
}

function ColeccionistasSkeleton() {
	return (
		<>
			<h2 className="h2 skeleton">Coleccionistas</h2>
			<div className="overflow-x-auto">
				<table className="table">
					<thead>
						<tr>
							{HEAD.map((h) => (
								<th key={h} className={LEFT.has(h) ? "text-left!" : undefined}>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{Array.from({ length: TOP }, (_, i) => (
							<tr key={String(i)} className="skeleton">
								{HEAD.map((h) => (
									<td key={h}>
										<b>0</b>
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
