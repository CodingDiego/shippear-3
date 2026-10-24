import Link from "next/link";
import { Suspense } from "react";
import "./landing.css";
import { Figu, FiguSkeleton } from "@/components/figu/figu";
import type { FiguData } from "@/components/figu/figu-body";
import { HeroPlayer } from "@/components/motion/hero-player";
import {
	getAlbum,
	getDataset,
	getLiga,
	getRevelacion,
	getScoredPeriod,
	getSeasonMeta,
} from "@/lib/data/queries";
import {
	KPI_DEFS,
	KPI_IDS,
	KPI_TIE_ORDER,
	type KpiId,
	PERIODOS,
	type Vendedor,
} from "@/lib/domain";
import {
	canalNombre,
	fmt1,
	fmtScore,
	mesNombre,
	shortName,
	sucursalNombre,
} from "@/lib/format";
import { albumDe, type Medalla } from "@/lib/modes";
import { type PlayRow, WeightPlay } from "./_landing/weight-play";

const QUE_MIDE: Record<KpiId, string> = {
	venta: "Kilos vendidos en el mes contra el objetivo de venta.",
	prod: "De cada 100 visitas, cuántas terminaron en pedido.",
	no_comp:
		"Clientes de la cartera que no compraron en el mes. Cuantos menos, mejor.",
	lanz: "Clientes de la cartera que ya compraron los últimos lanzamientos.",
	no_entr: "Pedidos que el cliente no recibió. Cuantos menos, mejor.",
	cobr: "Facturas cobradas dentro del plazo de pago del cliente.",
	relev: "Encuestas de góndola hechas sobre las asignadas en el mes.",
};

export default function Home() {
	return (
		<div className="lp">
			<main>
				<section className="wrap hero">
					<Suspense fallback={<HeroSkeleton />}>
						<Hero />
					</Suspense>
				</section>

				<section className="sec field" id="pesos">
					<div className="wrap type">
						<Suspense fallback={<PlaySkeleton />}>
							<Play />
						</Suspense>
					</div>
				</section>

				<section className="sec wrap">
					<h2 className="kpis-h2">Siete KPIs, un puntaje.</h2>
					<div
						className="wbar"
						role="img"
						aria-label={`pesos de los siete KPIs: ${KPI_TIE_ORDER.map((k) => `${KPI_DEFS[k].nombre} ${Math.round(KPI_DEFS[k].peso * 100)}`).join(", ")}`}
					>
						{KPI_TIE_ORDER.map((k) => (
							<div
								key={k}
								style={
									{
										"--w": Math.max(12, KPI_DEFS[k].peso * 100),
									} as React.CSSProperties
								}
							>
								{Math.round(KPI_DEFS[k].peso * 100)}%
								<small>
									{KPI_DEFS[k].nombre}. {QUE_MIDE[k]}
								</small>
							</div>
						))}
					</div>
					<div className="legend" aria-hidden="true">
						{KPI_TIE_ORDER.map((k) => (
							<div
								key={k}
								style={
									{
										"--w": Math.max(12, KPI_DEFS[k].peso * 100),
									} as React.CSSProperties
								}
							>
								<b>{KPI_DEFS[k].nombre}</b>
								{QUE_MIDE[k]}
							</div>
						))}
					</div>
					<p className="kpis-p">
						Cada KPI se compara con su objetivo y da de 0 a 100 puntos; pasarse
						del 110 % no suma más. El puntaje de la carta es el promedio de esos
						puntos, cada uno con su peso. Pesos y objetivos se cambian desde la
						administración, sin tocar código.
					</p>
				</section>

				<section className="sec field modes" id="modos">
					<div className="wrap">
						<h2>El ranking vive todo el año.</h2>

						<article className="mode">
							<div className="txt">
								<h3>
									<Link href="/liga">Liga anual</Link>
								</h3>
								<p>
									Gana el mejor promedio de los doce meses, entre vendedores y
									entre sucursales, y hay un premio aparte para el mejor de cada
									KPI. Quien entró a mitad de año compite si tiene datos en tres
									de cada cuatro meses desde su alta.
								</p>
							</div>
							<Suspense
								fallback={
									<div
										className="ui ui-liga skeleton"
										style={{ height: 190 }}
										aria-busy="true"
									/>
								}
							>
								<LigaUi />
							</Suspense>
						</article>

						<article className="mode">
							<div className="txt">
								<h3>
									<Link href="/revelacion">Revelación del mes</Link>
								</h3>
								<p>
									Premia a quien más mejoró contra el mes anterior: más puntos
									ganados, más avance sobre lo que le faltaba para 100, más
									meses seguidos subiendo y el mayor ascenso de puesto en el
									año.
								</p>
							</div>
							<Suspense
								fallback={
									<div className="ui ui-reve skeleton" aria-busy="true" />
								}
							>
								<RevelacionUi />
							</Suspense>
						</article>

						<article className="mode">
							<div className="txt">
								<h3>
									<Link href="/album">Álbum de figuritas</Link>
								</h3>
								<p>
									Cumplir el objetivo de un KPI en el mes da su figu. Cuantos
									menos vendedores lo logran ese mes, más rara es. Cumplirlo
									tres meses seguidos la vuelve holográfica, y los tres mejores
									del país se llevan la versión dorada.
								</p>
							</div>
							<Suspense
								fallback={
									<div
										className="ui ui-album skeleton"
										style={{ height: 180 }}
										aria-busy="true"
									/>
								}
							>
								<AlbumUi />
							</Suspense>
						</article>
					</div>
				</section>
			</main>
		</div>
	);
}

async function latest() {
	const meta = await getSeasonMeta();
	const period = await getScoredPeriod(meta.latest, "mes");
	const top =
		period.vendedores.find((v) => v.puesto === 1) ?? period.vendedores[0];
	return { meta, period, top };
}

async function Hero() {
	const { meta, period, top } = await latest();
	// Plain values only: the Player gets them as props, with just the fields the card draws.
	const cards: FiguData[] = period.vendedores
		.filter((v) => v.puesto !== null)
		.sort((a, b) => (a.puesto ?? 0) - (b.puesto ?? 0))
		.slice(0, 5)
		.map((v) => ({
			vendedor: v.vendedor,
			score: v.score,
			tier: v.tier,
			puesto: v.puesto,
			de: v.de,
			puestoSucursal: v.puestoSucursal,
			kpis: Object.fromEntries(
				KPI_IDS.map((k) => [k, v.kpis[k]]),
			) as FiguData["kpis"],
		}));
	return (
		<>
			<div>
				<h1 className="sentence">
					{top.vendedor.apellido} es la <em>figu</em> del mes.
				</h1>
				<div className="hero-foot">
					<p>
						Mejor puntaje de {mesNombre(meta.latest)}. Figu pasa los siete KPIs
						de cada vendedor a un puntaje de 0 a 100 y arma su carta:{" "}
						{meta.vendedores} vendedores de {meta.sucursales} sucursales, cada
						uno con su puesto en el país, en su provincia y en su sucursal.
					</p>
					<Link className="btn" href="/ranking">
						Ver el ranking
					</Link>
				</div>
			</div>
			<HeroPlayer cards={cards}>
				<Figu
					v={top}
					foil="oro"
					href={`/vendedor/${top.vendedor.id}`}
					className="hero-poster"
				/>
			</HeroPlayer>
		</>
	);
}

function HeroSkeleton() {
	return (
		<>
			<div>
				<h1 className="sentence skeleton">Alguien es la figu del mes.</h1>
				<div className="hero-foot">
					<p className="skeleton">
						Mejor puntaje del mes. Figu pasa los siete KPIs de cada vendedor a
						un puntaje de 0 a 100 y arma su carta.
					</p>
					<span className="btn skeleton">Ver el ranking</span>
				</div>
			</div>
			<div className="hero-stage">
				<FiguSkeleton className="hero-poster" />
			</div>
		</>
	);
}

const sub = (v: Vendedor) =>
	`${sucursalNombre(v.sucursal)}, ${canalNombre(v.canal)}`;

async function Play() {
	const { period } = await latest();
	const rows: PlayRow[] = period.vendedores
		.filter((v) => v.puesto !== null)
		.sort((a, b) => (a.puesto ?? 0) - (b.puesto ?? 0))
		.slice(0, 10)
		.map((v) => ({
			id: v.vendedor.id,
			nombre: shortName(v.vendedor),
			sub: sub(v.vendedor),
			puntos: Object.fromEntries(
				KPI_IDS.map((k) => [k, v.kpis[k].puntos]),
			) as Record<KpiId, number | null>,
		}));
	return <WeightPlay rows={rows} />;
}

function PlaySkeleton() {
	return (
		<>
			<h2>
				<span>Si venta pesa</span> <span>30</span> <span>%</span>
			</h2>
			<div className="answer rows">
				{Array.from({ length: 10 }, (_, i) => (
					<div className="row" key={String(i)} data-loading="">
						<b>{i + 1}</b>
						<div className="who">x</div>
						<div className="pts">0</div>
					</div>
				))}
			</div>
		</>
	);
}

async function byId() {
	const d = await getDataset();
	return new Map(d.vendedores.map((v) => [v.id, v]));
}

async function LigaUi() {
	const [l, ids] = await Promise.all([getLiga(), byId()]);
	const top = l.vendedores.filter((r) => r.elegible).slice(0, 4);
	return (
		<Link className="ui ui-liga" href="/liga">
			<table>
				<thead>
					<tr>
						<th>Liga</th>
						<th>Prom.</th>
					</tr>
				</thead>
				<tbody>
					{top.map((r) => {
						const v = ids.get(r.vendedorId);
						return (
							<tr key={r.vendedorId}>
								<td>{v ? shortName(v) : r.vendedorId}</td>
								<td>{fmt1(r.promedio)}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</Link>
	);
}

async function RevelacionUi() {
	const [r, ids] = await Promise.all([getRevelacion(), byId()]);
	const a = r.absoluta[0];
	if (!a) return null;
	const v = ids.get(a.vendedorId);
	const rel = r.relativa.find((x) => x.vendedorId === a.vendedorId);
	const racha = r.racha.find((x) => x.vendedorId === a.vendedorId);
	return (
		<Link className="ui ui-reve" href="/revelacion">
			<div className="who">
				{v ? shortName(v) : a.vendedorId} <span>{v ? sub(v) : ""}</span>
			</div>
			<div className="big">
				+{fmtScore(a.delta)}
				<small>
					{fmtScore(a.anterior)} a {fmtScore(a.actual)}
				</small>
			</div>
			<ol>
				<li>
					Relativa <b>{rel ? `${Math.round(rel.relativa * 100)} %` : "—"}</b>
				</li>
				<li>
					Racha <b>{racha ? `${racha.racha} meses` : "sin racha"}</b>
				</li>
			</ol>
		</Link>
	);
}

const ORDEN: Record<Medalla, number> = { oro: 3, plata: 2, bronce: 1 };

async function AlbumUi() {
	const [figus, { top }] = await Promise.all([getAlbum(), latest()]);
	const a = albumDe(figus, top.vendedor.id);
	return (
		<Link
			className="ui ui-album"
			href="/album"
			aria-label={`álbum de ${shortName(top.vendedor)}: ${a.total} figuritas`}
		>
			{PERIODOS.map((p) =>
				KPI_IDS.map((k) => {
					const cell = a.grid[k][p.id] ?? [];
					const best = [...cell].sort(
						(x, y) =>
							(y.medalla ? ORDEN[y.medalla] : 0) -
							(x.medalla ? ORDEN[x.medalla] : 0),
					)[0];
					return (
						<i
							key={`${p.id}-${k}`}
							className="sticker"
							data-m={best?.medalla}
							data-holo={cell.some((f) => f.holografica) ? "" : undefined}
						/>
					);
				}),
			)}
			<span className="cap">
				{a.total} figus de {shortName(top.vendedor)}.{" "}
				{Math.round(a.completado * 7)} de 7 KPIs.
			</span>
		</Link>
	);
}
