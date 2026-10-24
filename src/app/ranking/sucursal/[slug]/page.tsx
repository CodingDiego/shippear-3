import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Figu, FiguSkeleton } from "@/components/figu/figu";
import { getScoredPeriod, getSeasonMeta } from "@/lib/data/queries";
import {
	PROVINCIA_BY_SLUG,
	provinciaDe,
	SUCURSAL_BY_SLUG,
	SUCURSALES,
} from "@/lib/domain";
import { fmt1, sucursalNombre } from "@/lib/format";
import { loadSearchParams } from "@/lib/search-params";

type Props = PageProps<"/ranking/sucursal/[slug]">;

export function generateStaticParams() {
	return SUCURSALES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	if (!Object.hasOwn(SUCURSAL_BY_SLUG, slug)) notFound();
	return { title: sucursalNombre(slug) };
}

export default function SucursalPage(props: Props) {
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
					Sucursal
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
			<h2 className="h2">Vendedores</h2>
			<div className="grid-figus">
				{Array.from({ length: 24 }, (_, i) => (
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
	const suc = Object.hasOwn(SUCURSAL_BY_SLUG, slug)
		? SUCURSAL_BY_SLUG[slug]
		: undefined;
	if (!suc) notFound();

	const periodo = meta.periodos.includes(sp.periodo) ? sp.periodo : meta.latest;
	const period = await getScoredPeriod(periodo, sp.vista);
	const scored = period.vendedores.filter((v) => v.score !== null);
	const empresa = scored.length
		? scored.reduce((a, v) => a + (v.score ?? 0), 0) / scored.length
		: null;
	const ranking = period.sucursales.find((s) => s.sucursal.slug === slug);
	const plantel = period.vendedores
		.filter((v) => v.vendedor.sucursal === slug)
		.sort(
			(a, b) =>
				(a.puestoSucursal ?? Number.POSITIVE_INFINITY) -
				(b.puestoSucursal ?? Number.POSITIVE_INFINITY),
		);
	const provSlug = provinciaDe(slug);
	const provincia = provSlug ? PROVINCIA_BY_SLUG[provSlug] : undefined;
	const qs = new URLSearchParams();
	if (periodo !== meta.latest) qs.set("periodo", periodo);
	if (sp.vista !== "mes") qs.set("vista", sp.vista);
	const suffix = qs.size ? `?${qs}` : "";

	return (
		<>
			<header className="title">
				<h1>{suc.nombre}</h1>
				<p>
					<b>
						{ranking?.puesto
							? `Es la sucursal número ${ranking.puesto} de ${SUCURSALES.length}`
							: "Todavía no tiene puesto"}{" "}
						con un promedio de {fmt1(ranking?.score ?? null)} puntos.
					</b>{" "}
					{plantel.length} vendedores; toda la empresa promedia {fmt1(empresa)}.
					{provincia && (
						<>
							{" "}
							Está en{" "}
							<Link href={`/ranking/provincia/${provincia.slug}${suffix}`}>
								{provincia.nombre}
							</Link>
							, donde ocupa el puesto {ranking?.puestoProvincia ?? "—"} entre
							sus sucursales.
						</>
					)}
				</p>
			</header>
			<nav aria-label="Sucursales" style={{ overflowX: "auto" }}>
				<div className="seg">
					{SUCURSALES.map((s) => (
						<Link
							key={s.slug}
							href={`/ranking/sucursal/${s.slug}${suffix}`}
							aria-current={s.slug === slug ? "page" : undefined}
							style={{ whiteSpace: "nowrap" }}
						>
							{s.nombre}
						</Link>
					))}
				</div>
			</nav>
			<h2 className="h2">
				Vendedores{" "}
				<span>{plantel.length} cartas, por puntaje en la sucursal</span>
			</h2>
			<div className="grid-figus">
				{plantel.map((v) => (
					<Figu key={v.vendedor.id} v={v} href={`/vendedor/${v.vendedor.id}`} />
				))}
			</div>
		</>
	);
}
