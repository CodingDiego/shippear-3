import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./album.css";
import {
	getAlbum,
	getDataset,
	getMetricas,
	getSeasonMeta,
} from "@/lib/data/queries";
import { KPI_IDS, METRICAS_DEFAULT, type Rareza } from "@/lib/domain";
import { mesNombre, shortName, sucursalNombre } from "@/lib/format";
import { albumDe } from "@/lib/modes";

export const metadata: Metadata = { title: "Álbum de figuritas" };

const TOP = 30;

const REGLAS: [Rareza, string, string][] = [
	[
		"legendaria",
		"Legendaria",
		"El 5 % más difícil de la temporada: de todas las combinaciones de mes y KPI, las que menos vendedores cumplieron.",
	],
	["epica", "Épica", "El siguiente 20 % más difícil."],
	["rara", "Rara", "El siguiente 35 %."],
	["comun", "Común", "El resto: lo cumplió una buena parte del equipo."],
];

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

			<Suspense fallback={<DoradasSkeleton />}>
				<Doradas />
			</Suspense>

			<Suspense fallback={<ColeccionistasSkeleton />}>
				<Coleccionistas />
			</Suspense>

			<h2 className="h2">Cómo se gana una figu</h2>
			<p className="note">
				Un vendedor gana la figu de un KPI cuando cumple su objetivo en un mes
				cerrado. Solo cuentan las sucursales donde el álbum está activo ese mes.
			</p>
			<Suspense fallback={<ReglasSkeleton />}>
				<Reglas />
			</Suspense>
			<p className="note mt-3">
				Holográfica: cumplir el mismo KPI tres meses seguidos. Edición dorada,
				plateada o de bronce: los tres mejores del país en ese KPI y mes.
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
	if (!top || figus.length === 0)
		return (
			<p>Todavía no hay figus: el álbum no está activo en ninguna sucursal.</p>
		);
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

async function Doradas() {
	const [figus, d, meta, metricas] = await Promise.all([
		getAlbum(),
		getDataset(),
		getSeasonMeta(),
		getMetricas(),
	]);
	const mes = mesNombre(meta.latest);
	const vendedores = new Map(d.vendedores.map((v) => [v.id, v]));
	return (
		<>
			<h2 className="h2">
				Edición dorada de {mes} <span>el mejor del país en cada KPI</span>
			</h2>
			<div className="rows legendarias">
				{metricas
					.filter((m) => m.activa)
					.sort((a, b) => a.orden - b.orden)
					.map((m) => {
						const f = figus.find(
							(x) =>
								x.periodoId === meta.latest &&
								x.kpi === m.id &&
								x.medalla === "oro",
						);
						const v = f && vendedores.get(f.vendedorId);
						return (
							<div className="row" key={m.id}>
								<b>{m.nombre}</b>
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

function DoradasSkeleton() {
	return (
		<>
			<h2 className="h2 skeleton">Edición dorada de septiembre</h2>
			<div className="rows legendarias">
				{METRICAS_DEFAULT.filter((m) => m.activa).map((m) => (
					<div className="row" key={m.id} data-loading="">
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

function ReglasTabla({ filas }: { filas: [Rareza, string, string, number][] }) {
	return (
		<div className="overflow-x-auto">
			<table className="table">
				<thead>
					<tr>
						<th className="text-left!">Rareza</th>
						<th className="text-left!">Qué es</th>
						<th>Figus</th>
					</tr>
				</thead>
				<tbody>
					{filas.map(([id, nombre, texto, n]) => (
						<tr key={id}>
							<td className="text-left!">
								<b>{nombre}</b>
							</td>
							<td className="text-left!">{texto}</td>
							<td>{n}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

async function Reglas() {
	const figus = await getAlbum();
	return (
		<ReglasTabla
			filas={REGLAS.map(([id, nombre, texto]) => [
				id,
				nombre,
				texto,
				figus.filter((f) => f.rareza === id).length,
			])}
		/>
	);
}

function ReglasSkeleton() {
	return (
		<div className="skeleton">
			<ReglasTabla filas={REGLAS.map((r) => [...r, 0])} />
		</div>
	);
}
