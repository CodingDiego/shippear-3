import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./liga.css";
import { getDataset, getLiga } from "@/lib/data/queries";
import {
	KPI_DEFS,
	KPI_IDS,
	PROVINCIA_BY_SLUG,
	PROVINCIAS,
	provinciaDe,
	SUCURSALES,
} from "@/lib/domain";
import { canalNombre, fmt1, shortName, sucursalNombre } from "@/lib/format";
import { LIGA_MIN_MESES, LIGA_MIN_MIEMBROS } from "@/lib/modes/liga";
import type { LigaSucursal, LigaVendedor } from "@/lib/modes/types";
import { loadLigaParams, type Modo } from "./params";

export const metadata: Metadata = { title: "Liga anual" };

const CHIP = ["bg-oro", "bg-plata", "bg-bronce"];
const MEDALLA = ["Oro", "Plata", "Bronce"];
// Same starting province as the ranking: Rosario's.
const PROVINCIA_INICIAL = "santa-fe";

type SP = PageProps<"/liga">["searchParams"];

export default function Page(props: PageProps<"/liga">) {
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
					<Lead searchParams={props.searchParams} />
				</Suspense>
			</div>
			<Suspense fallback={<BodySkeleton />}>
				<Body searchParams={props.searchParams} />
			</Suspense>
		</main>
	);
}

async function load(searchParams: SP) {
	const [sp, liga, d] = await Promise.all([
		loadLigaParams(searchParams),
		getLiga(),
		getDataset(),
	]);
	const modo: Modo = sp.modo;
	const provincia = Object.hasOwn(PROVINCIA_BY_SLUG, sp.provincia)
		? sp.provincia
		: PROVINCIA_INICIAL;
	// Nacional keeps everyone; por provincia keeps the chosen province's sellers and sucursales.
	const enAlcance = (sucursal: string) =>
		modo === "nacional" || provinciaDe(sucursal) === provincia;
	const nacional = liga.vendedores.filter((v) => v.elegible);
	return {
		liga,
		modo,
		provincia,
		ids: new Map(d.vendedores.map((v) => [v.id, v])),
		// Eligibles come first and keep the national order, so the index is the puesto.
		paisDe: new Map(nacional.map((v, i) => [v.vendedorId, i + 1])),
		vendedores: liga.vendedores.filter((v) => enAlcance(v.sucursal)),
		sucursales: liga.sucursales.filter((s) => enAlcance(s.slug)),
		total: liga.vendedores.length,
	};
}

async function Lead({ searchParams }: { searchParams: SP }) {
	const { ids, modo, provincia, vendedores } = await load(searchParams);
	const eleg = vendedores.filter((v) => v.elegible);
	const top = eleg[0];
	const topV = top && ids.get(top.vendedorId);
	const donde =
		modo === "provincia" ? PROVINCIA_BY_SLUG[provincia].nombre : "el país";
	return (
		<p>
			{topV ? (
				<b>
					{shortName(topV)} lidera la liga en {donde} con {fmt1(top.promedio)}{" "}
					puntos de promedio.
				</b>
			) : (
				<b>Todavía no hay vendedores en la tabla de {donde}.</b>
			)}{" "}
			{eleg.length} de {vendedores.length} vendedores entran en la tabla. Para
			entrar hacen falta {LIGA_MIN_MESES} meses jugados; quien empezó más tarde
			necesita tres de cada cuatro de los meses que pudo jugar.
		</p>
	);
}

function Modos({ modo, provincia }: { modo: Modo; provincia: string }) {
	return (
		<>
			<nav aria-label="Alcance de la liga">
				<div className="tabs">
					<Link
						href="/liga"
						aria-current={modo === "nacional" ? "page" : undefined}
					>
						Nacional
					</Link>
					<Link
						href={`/liga?modo=provincia&provincia=${provincia}`}
						aria-current={modo === "provincia" ? "page" : undefined}
					>
						Por provincia
					</Link>
				</div>
			</nav>
			{modo === "provincia" && (
				<nav aria-label="Provincias" className="liga-prov">
					<div className="seg">
						{PROVINCIAS.map((p) => (
							<Link
								key={p.slug}
								href={`/liga?modo=provincia&provincia=${p.slug}`}
								aria-current={p.slug === provincia ? "page" : undefined}
								style={{ whiteSpace: "nowrap" }}
							>
								{p.nombre}
							</Link>
						))}
					</div>
				</nav>
			)}
		</>
	);
}

function Nombre({
	id,
	ids,
}: {
	id: string;
	ids: Map<string, { nombre: string; apellido: string }>;
}) {
	const v = ids.get(id);
	return <Link href={`/vendedor/${id}`}>{v ? shortName(v) : id}</Link>;
}

const Suc = ({ slug }: { slug: string }) => (
	<Link href={`/ranking/sucursal/${slug}`}>{sucursalNombre(slug)}</Link>
);

async function Body({ searchParams }: { searchParams: SP }) {
	const { liga, modo, provincia, ids, paisDe, vendedores, sucursales } =
		await load(searchParams);
	const eleg = vendedores.filter((v) => v.elegible);
	const faltan = vendedores.filter((v) => !v.elegible);
	const donde = modo === "provincia" ? PROVINCIA_BY_SLUG[provincia].nombre : "";
	// Rank among the eligible sucursales in scope; they come ordered by puesto.
	const puestoSuc = new Map<string, number>();
	for (const s of sucursales.filter((x) => x.elegible))
		puestoSuc.set(s.slug, puestoSuc.size + 1);

	return (
		<>
			<Modos modo={modo} provincia={provincia} />
			<h2 className="h2">
				Balón de Oro{" "}
				<span>
					promedio de puntos de los meses jugados{donde && `, ${donde}`}
				</span>
			</h2>
			<TablaVendedores
				filas={eleg}
				ids={ids}
				paisDe={paisDe}
				conPais={modo === "provincia"}
			/>

			<h2 className="h2">
				Todavía no entran en la tabla <span>{faltan.length}</span>
			</h2>
			{faltan.length === 0 ? (
				<p className="note">
					Todos los vendedores con datos entran en la tabla.
				</p>
			) : (
				<div className="tscroll">
					<table className="table">
						<thead>
							<tr>
								<th>Vendedor</th>
								<th className="l">Sucursal</th>
								<th>Meses jugados</th>
								<th>Le faltan</th>
							</tr>
						</thead>
						<tbody>
							{faltan.map((r) => {
								const n = r.mesesRequeridos - r.meses;
								return (
									<tr key={r.vendedorId}>
										<td>
											<Nombre id={r.vendedorId} ids={ids} />
										</td>
										<td className="l">
											<Suc slug={r.sucursal} />
										</td>
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
				<span>
					promedio de sus vendedores en la tabla, con al menos{" "}
					{LIGA_MIN_MIEMBROS}
				</span>
			</h2>
			<TablaSucursales
				filas={sucursales}
				puestos={puestoSuc}
				conPais={modo === "provincia"}
			/>

			{modo === "nacional" && (
				<>
					<h2 className="h2">
						Mejor de cada indicador{" "}
						<span>
							mejor promedio de puntos entre los vendedores en la tabla
						</span>
					</h2>
					<div className="tscroll">
						<table className="table">
							<thead>
								<tr>
									<th>Indicador</th>
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
													<td className="l">
														<Nombre id={b.vendedorId} ids={ids} />
													</td>
													<td className="l">
														{v ? <Suc slug={v.sucursal} /> : "—"}
													</td>
													<td>{fmt1(b.promedioPuntos)}</td>
												</>
											) : (
												<>
													<td className="l text-ink-3">nadie en la tabla</td>
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
			)}
		</>
	);
}

function TablaVendedores({
	filas,
	ids,
	paisDe,
	conPais,
}: {
	filas: LigaVendedor[];
	ids: Map<string, { nombre: string; apellido: string }>;
	paisDe: Map<string, number>;
	/** In a province the national puesto is a second column. */
	conPais: boolean;
}) {
	if (filas.length === 0)
		return <p className="note">Todavía no hay vendedores en la tabla.</p>;
	return (
		<div className="tscroll">
			<table className="table">
				<thead>
					<tr>
						<th>{conPais ? "Puesto en la provincia" : "Puesto"}</th>
						{conPais && <th>Puesto en el país</th>}
						<th className="l">Vendedor</th>
						<th className="l">Sucursal</th>
						<th className="l">Zona</th>
						<th>Promedio</th>
						<th>Meses jugados</th>
						<th>Mes típico</th>
						<th>Mejor mes</th>
					</tr>
				</thead>
				<tbody>
					{filas.map((r, i) => (
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
							{conPais && <td>{paisDe.get(r.vendedorId) ?? "—"}</td>}
							<td className="l">
								<Nombre id={r.vendedorId} ids={ids} />
							</td>
							<td className="l">
								<Suc slug={r.sucursal} />
							</td>
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
	);
}

function TablaSucursales({
	filas,
	puestos,
	conPais,
}: {
	filas: LigaSucursal[];
	puestos: Map<string, number>;
	conPais: boolean;
}) {
	return (
		<div className="tscroll">
			<table className="table">
				<thead>
					<tr>
						<th>{conPais ? "Puesto en la provincia" : "Puesto"}</th>
						{conPais && <th>Puesto en el país</th>}
						<th className="l">Sucursal</th>
						<th>Promedio</th>
						<th>Vendedores en la tabla</th>
					</tr>
				</thead>
				<tbody>
					{filas.map((s) => (
						<tr key={s.slug}>
							<td>{puestos.get(s.slug) ?? "—"}</td>
							{conPais && <td>{s.puesto ?? "—"}</td>}
							<td className="l">
								<Suc slug={s.slug} />
							</td>
							<td>
								{s.elegible ? (
									<b>{fmt1(s.promedio)}</b>
								) : (
									<span className="text-ink-3">
										menos de {LIGA_MIN_MIEMBROS} en la tabla
									</span>
								)}
							</td>
							<td>{s.miembros}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
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
			<div className="tabs skeleton" style={{ width: 230, height: 44 }} />
			<h2 className="h2">
				Balón de Oro <span>promedio de puntos de los meses jugados</span>
			</h2>
			<Loading n={10} />
			<h2 className="h2">Todavía no entran en la tabla</h2>
			<Loading n={10} />
			<h2 className="h2">
				Sucursales{" "}
				<span>
					promedio de sus vendedores en la tabla, con al menos{" "}
					{LIGA_MIN_MIEMBROS}
				</span>
			</h2>
			<Loading n={SUCURSALES.length} />
			<h2 className="h2">
				Mejor de cada indicador{" "}
				<span>mejor promedio de puntos entre los vendedores en la tabla</span>
			</h2>
			<Loading n={KPI_IDS.length} />
		</>
	);
}
