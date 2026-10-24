import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./liga.css";
import { getDataset, getLiga } from "@/lib/data/queries";
import { KPI_DEFS, KPI_IDS, SUCURSALES } from "@/lib/domain";
import { canalNombre, fmt1, shortName, sucursalNombre } from "@/lib/format";
import { LIGA_MIN_MESES, LIGA_MIN_MIEMBROS } from "@/lib/modes/liga";

export const metadata: Metadata = { title: "Liga anual" };

const CHIP = ["bg-oro", "bg-plata", "bg-bronce"];
const MEDALLA = ["Oro", "Plata", "Bronce"];

export default function Page() {
	return (
		<main className="wrap liga">
			<div className="title">
				<h1>Liga anual</h1>
				<Suspense
					fallback={
						<p className="skeleton">
							Un vendedor lidera la liga con un promedio. Elegibles sobre el
							total de vendedores.
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
	const [liga, d] = await Promise.all([getLiga(), getDataset()]);
	return { liga, ids: new Map(d.vendedores.map((v) => [v.id, v])) };
}

async function Lead() {
	const { liga, ids } = await load();
	const eleg = liga.vendedores.filter((v) => v.elegible);
	const top = eleg[0];
	const topV = top && ids.get(top.vendedorId);
	return (
		<p>
			{topV ? (
				<b>
					{shortName(topV)} lidera la liga con {fmt1(top.promedio)} de promedio.
				</b>
			) : (
				<b>Todavía no hay vendedores elegibles.</b>
			)}{" "}
			{eleg.length} vendedores elegibles de {liga.vendedores.length}: hacen
			falta {LIGA_MIN_MESES} meses jugados, o tres de cada cuatro desde el alta
			si son menos.
		</p>
	);
}

async function Body() {
	const { liga, ids } = await load();
	const eleg = liga.vendedores.filter((v) => v.elegible);
	const faltan = liga.vendedores.filter((v) => !v.elegible);
	const name = (id: string) => {
		const v = ids.get(id);
		return <Link href={`/vendedor/${id}`}>{v ? shortName(v) : id}</Link>;
	};
	const suc = (slug: string) => (
		<Link href={`/ranking/sucursal/${slug}`}>{sucursalNombre(slug)}</Link>
	);
	return (
		<>
			<h2 className="h2">
				Balón de Oro <span>promedio de los meses jugados</span>
			</h2>
			<div className="tscroll">
				<table className="table">
					<thead>
						<tr>
							<th>#</th>
							<th className="l">Vendedor</th>
							<th className="l">Sucursal</th>
							<th className="l">Zona</th>
							<th>Prom.</th>
							<th>Meses</th>
							<th>Mediana</th>
							<th>Mejor mes</th>
						</tr>
					</thead>
					<tbody>
						{eleg.map((r, i) => (
							<tr key={r.vendedorId}>
								<td>
									{i + 1}
									{i < 3 && (
										<span
											className={`${CHIP[i]} text-ink rounded-full px-2 text-xs font-semibold ml-2`}
										>
											{MEDALLA[i]}
										</span>
									)}
								</td>
								<td className="l">{name(r.vendedorId)}</td>
								<td className="l">{suc(r.sucursal)}</td>
								<td className="l capitalize">{canalNombre(r.canal)}</td>
								<td>
									<b>{fmt1(r.promedio)}</b>
								</td>
								<td>{r.meses}</td>
								<td>{fmt1(r.mediana)}</td>
								<td>{fmt1(r.mejorMes)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<h2 className="h2">
				Todavía no elegibles <span>{faltan.length}</span>
			</h2>
			{faltan.length === 0 ? (
				<p className="note">Todos los vendedores con datos son elegibles.</p>
			) : (
				<div className="tscroll">
					<table className="table">
						<thead>
							<tr>
								<th>Vendedor</th>
								<th className="l">Sucursal</th>
								<th>Meses</th>
								<th>Le faltan</th>
							</tr>
						</thead>
						<tbody>
							{faltan.map((r) => {
								const n = r.mesesRequeridos - r.meses;
								return (
									<tr key={r.vendedorId}>
										<td>{name(r.vendedorId)}</td>
										<td className="l">{suc(r.sucursal)}</td>
										<td>{r.meses}</td>
										<td>
											{n} {n === 1 ? "mes" : "meses"}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			<h2 className="h2">
				Sucursales{" "}
				<span>promedio de sus elegibles, al menos {LIGA_MIN_MIEMBROS}</span>
			</h2>
			<div className="tscroll">
				<table className="table">
					<thead>
						<tr>
							<th>#</th>
							<th className="l">Sucursal</th>
							<th>Prom.</th>
							<th>Elegibles</th>
						</tr>
					</thead>
					<tbody>
						{liga.sucursales.map((s) => (
							<tr key={s.slug}>
								<td>{s.puesto ?? "—"}</td>
								<td className="l">{suc(s.slug)}</td>
								<td>
									{s.elegible ? (
										<b>{fmt1(s.promedio)}</b>
									) : (
										<span className="text-ink-3">
											menos de {LIGA_MIN_MIEMBROS} elegibles
										</span>
									)}
								</td>
								<td>{s.miembros}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<h2 className="h2">
				Botín por KPI <span>mejor promedio de puntos en cada KPI</span>
			</h2>
			<div className="tscroll">
				<table className="table">
					<thead>
						<tr>
							<th>KPI</th>
							<th className="l">Vendedor</th>
							<th className="l">Sucursal</th>
							<th>Puntos</th>
						</tr>
					</thead>
					<tbody>
						{KPI_IDS.map((k) => {
							const b = liga.botin[k];
							const v = b && ids.get(b.vendedorId);
							return (
								<tr key={k}>
									<td>
										<Link href={`/kpi/${k}`}>{KPI_DEFS[k].nombre}</Link>
									</td>
									{b ? (
										<>
											<td className="l">{name(b.vendedorId)}</td>
											<td className="l">{v ? suc(v.sucursal) : "—"}</td>
											<td>{fmt1(b.promedioPuntos)}</td>
										</>
									) : (
										<>
											<td className="l text-ink-3">sin elegibles</td>
											<td className="l" />
											<td />
										</>
									)}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</>
	);
}

function Loading({ n }: { n: number }) {
	return (
		<div className="rows">
			{Array.from({ length: n }, (_, i) => (
				<div className="row" key={String(i)} data-loading="">
					<b>{i + 1}</b>
					<div className="who">x</div>
					<div className="pts">0</div>
				</div>
			))}
		</div>
	);
}

function BodySkeleton() {
	return (
		<>
			<h2 className="h2">
				Balón de Oro <span>promedio de los meses jugados</span>
			</h2>
			<Loading n={10} />
			<h2 className="h2">Todavía no elegibles</h2>
			<Loading n={10} />
			<h2 className="h2">
				Sucursales{" "}
				<span>promedio de sus elegibles, al menos {LIGA_MIN_MIEMBROS}</span>
			</h2>
			<Loading n={SUCURSALES.length} />
			<h2 className="h2">
				Botín por KPI <span>mejor promedio de puntos en cada KPI</span>
			</h2>
			<Loading n={KPI_IDS.length} />
		</>
	);
}
