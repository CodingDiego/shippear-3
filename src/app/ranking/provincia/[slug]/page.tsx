import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import "../../ranking.css";
import { Figu, FiguSkeleton } from "@/components/figu/figu";
import { getScoredPeriod, getSeasonMeta } from "@/lib/data/queries";
import { PROVINCIA_BY_SLUG, PROVINCIAS, provinciaDe } from "@/lib/domain";
import { fmt1 } from "@/lib/format";
import { loadSearchParams } from "@/lib/search-params";
import { nombreProvincia } from "../../scope";

type Props = PageProps<"/ranking/provincia/[slug]">;

export function generateStaticParams() {
	return PROVINCIAS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	if (!Object.hasOwn(PROVINCIA_BY_SLUG, slug)) notFound();
	return { title: nombreProvincia(slug) };
}

export default function ProvinciaPage(props: Props) {
	return (
		<main className="wrap">
			<Suspense fallback={<Skeleton />}>
				<Body params={props.params} searchParams={props.searchParams} />
			</Suspense>
		</main>
	);
}

function Skeleton() {
	return (
		<>
			<header className="title">
				<h1 className="skeleton" style={{ width: 220, height: 34 }}>
					Provincia
				</h1>
				<p>
					<span
						className="skeleton"
						style={{ display: "block", height: 22, maxWidth: 560 }}
					/>
				</p>
			</header>
			<div className="seg" style={{ visibility: "hidden" }} aria-hidden="true">
				<span style={{ width: 44 }} />
			</div>
			<h2 className="h2">Sucursales</h2>
			<div className="rows">
				{Array.from({ length: 6 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
					<div className="row" data-loading="" key={i}>
						<b>0</b>
						<div className="who">Nombre</div>
						<div className="pts">00</div>
					</div>
				))}
			</div>
			<h2 className="h2">Vendedores</h2>
			<div className="grid-figus">
				{Array.from({ length: 12 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
					<FiguSkeleton key={i} />
				))}
			</div>
		</>
	);
}

async function Body({
	params,
	searchParams,
}: {
	params: Props["params"];
	searchParams: Props["searchParams"];
}) {
	const [{ slug }, sp, meta] = await Promise.all([
		params,
		loadSearchParams(searchParams),
		getSeasonMeta(),
	]);
	if (!Object.hasOwn(PROVINCIA_BY_SLUG, slug)) notFound();

	const periodo = meta.periodos.includes(sp.periodo) ? sp.periodo : meta.latest;
	const period = await getScoredPeriod(periodo, sp.vista);
	const ranking = period.provincias?.find((p) => p.provincia.slug === slug);
	const sucursales = period.sucursales
		.filter((s) => provinciaDe(s.sucursal.slug) === slug)
		.sort(
			(a, b) =>
				(a.puestoProvincia ?? Number.POSITIVE_INFINITY) -
				(b.puestoProvincia ?? Number.POSITIVE_INFINITY),
		);
	const plantel = period.vendedores
		.filter((v) => provinciaDe(v.vendedor.sucursal) === slug)
		.sort(
			(a, b) =>
				(a.puestoProvincia ?? Number.POSITIVE_INFINITY) -
				(b.puestoProvincia ?? Number.POSITIVE_INFINITY),
		);
	const qs = new URLSearchParams();
	if (periodo !== meta.latest) qs.set("periodo", periodo);
	if (sp.vista !== "mes") qs.set("vista", sp.vista);
	const suffix = qs.size ? `?${qs}` : "";

	return (
		<>
			<header className="title">
				<h1>{nombreProvincia(slug)}</h1>
				<p>
					<b>
						Provincia {ranking?.puesto ?? "sin puesto"} de {PROVINCIAS.length}{" "}
						con promedio {fmt1(ranking?.score ?? null)}.
					</b>{" "}
					{sucursales.length}{" "}
					{sucursales.length === 1 ? "sucursal" : "sucursales"} y{" "}
					{plantel.length} vendedores. Los puestos de acá cuentan solo a los
					vendedores de la provincia.
				</p>
			</header>
			<nav aria-label="Provincias" style={{ overflowX: "auto" }}>
				<div className="seg">
					{PROVINCIAS.map((p) => (
						<Link
							key={p.slug}
							href={`/ranking/provincia/${p.slug}${suffix}`}
							aria-current={p.slug === slug ? "page" : undefined}
							style={{ whiteSpace: "nowrap" }}
						>
							{p.nombre}
						</Link>
					))}
				</div>
			</nav>
			<h2 className="h2">
				Sucursales{" "}
				<span>{sucursales.length}, por promedio de sus vendedores</span>
			</h2>
			<div className="rk-scroll">
				<table className="table">
					<thead>
						<tr>
							<th>Puesto en la provincia</th>
							<th>Puesto en el país</th>
							<th className="l">Sucursal</th>
							<th>Promedio</th>
							<th>Vendedores con datos</th>
						</tr>
					</thead>
					<tbody>
						{sucursales.map((s) => (
							<tr key={s.sucursal.slug}>
								<td>{s.puestoProvincia ?? "—"}</td>
								<td>{s.puesto ?? "—"}</td>
								<td className="l">
									<Link href={`/ranking/sucursal/${s.sucursal.slug}${suffix}`}>
										{s.sucursal.nombre}
									</Link>
								</td>
								<td className={s.tier ? `t-${s.tier}` : undefined}>
									<b>{fmt1(s.score)}</b>
								</td>
								<td>{s.miembros}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<h2 className="h2">
				Vendedores{" "}
				<span>{plantel.length} cartas, por puntaje en la provincia</span>
			</h2>
			<div className="grid-figus">
				{plantel.map((v) => (
					<Figu key={v.vendedor.id} v={v} href={`/vendedor/${v.vendedor.id}`} />
				))}
			</div>
		</>
	);
}
