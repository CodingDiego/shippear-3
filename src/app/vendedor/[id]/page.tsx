import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import "./vendedor.css";
import { Dorso } from "@/components/figu/dorso";
import { Figu, FiguSkeleton, type Foil } from "@/components/figu/figu";
import {
	getAlbum,
	getLiga,
	getScoredPeriod,
	getSeason,
	getSeasonMeta,
} from "@/lib/data/queries";
import {
	KPI_DEFS,
	KPI_IDS,
	type KpiId,
	PERIODOS,
	type Tier,
	tierOf,
} from "@/lib/domain";
import {
	canalNombre,
	fmt1,
	fmtScore,
	fullName,
	mesNombre,
	pct,
	shortName,
	sucursalNombre,
} from "@/lib/format";
import { albumDe, type Figu as FiguMedal, type Medalla } from "@/lib/modes";
import { CopyLink } from "./_components/copy-link";
import { FlipStage } from "./_components/flip-stage";

const FOIL: Foil[] = ["oro", "plata", "bronce"];
const MEDAL_RANK: Medalla[] = ["oro", "plata", "bronce"];
const TIER_TEXT: Record<Tier, string> = {
	verde: "text-verde",
	amarillo: "text-amarillo",
	rojo: "text-rojo",
};
const KPI_ALBUM: Record<KpiId, string> = {
	venta: "Venta",
	prod: "Productividad",
	no_comp: "No compran",
	lanz: "Lanzamientos",
	no_entr: "No entregados",
	cobr: "Cobranzas",
	relev: "Relevamientos",
};

export async function generateMetadata(
	props: PageProps<"/vendedor/[id]">,
): Promise<Metadata> {
	const { id } = await props.params;
	const { latest } = await getSeasonMeta();
	const p = await getScoredPeriod(latest, "mes");
	const v = p.vendedores.find((x) => x.vendedor.id === id);
	return { title: v ? shortName(v.vendedor) : "Vendedor" };
}

export default function Page(props: PageProps<"/vendedor/[id]">) {
	return (
		<main className="wrap">
			<Suspense fallback={<PageSkeleton />}>
				<Content params={props.params} />
			</Suspense>
		</main>
	);
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const meta = await getSeasonMeta();
	const [period, season, liga, figus] = await Promise.all([
		getScoredPeriod(meta.latest, "mes"),
		getSeason(),
		getLiga(),
		getAlbum(),
	]);
	const v = period.vendedores.find((x) => x.vendedor.id === id);
	if (!v) notFound();

	const album = albumDe(figus, id);
	const figusMes = figus.filter(
		(f) => f.vendedorId === id && f.periodoId === meta.latest,
	);
	const row = liga.vendedores.find((x) => x.vendedorId === id);
	const byPeriodo = new Map(
		season.map((p) => [
			p.periodoId,
			p.vendedores.find((x) => x.vendedor.id === id),
		]),
	);
	const last3 = season.slice(-3);
	const podio3 =
		last3.length === 3 &&
		last3.every((p) => {
			const puesto = byPeriodo.get(p.periodoId)?.puesto;
			return puesto != null && puesto <= 3;
		});
	const foil =
		v.puesto != null && v.puesto <= 3 ? FOIL[v.puesto - 1] : undefined;
	const holo = Object.values(album.grid)
		.flatMap((m) => Object.values(m).flat())
		.filter((f) => f.holografica).length;
	const conFigu = Math.round(album.completado * KPI_IDS.length);

	return (
		<>
			<div className="title">
				<h1>{fullName(v.vendedor)}</h1>
				<p>
					{sucursalNombre(v.vendedor.sucursal)}, {canalNombre(v.vendedor.canal)}
					.{" "}
					<b>
						{v.puesto
							? `Puesto ${v.puesto} de ${v.de} en ${mesNombre(meta.latest)}`
							: `Sin puesto en ${mesNombre(meta.latest)}`}
					</b>
					{v.puestoSucursal
						? ` y ${v.puestoSucursal} de ${v.deSucursal} en su sucursal.`
						: "."}
					{podio3 ? " Tres meses seguidos en el podio." : ""}
				</p>
			</div>
			<div className="vend-layout">
				<div className="vend-left">
					<FlipStage
						front={<Figu v={v} foil={foil} />}
						back={<Dorso v={v} figusMes={figusMes} />}
					/>
					<div className="actions">
						<CopyLink />
					</div>
					<p className="note">
						El clip para el grupo de la sucursal llega con el cierre de mes.
					</p>
				</div>
				<div className="vend-right">
					<section className="panel">
						<h2 className="h2" style={{ marginTop: 0 }}>
							Cómo se arma el {fmtScore(v.score)}
						</h2>
						<div className="vend-scroll">
							<table className="table">
								<thead>
									<tr>
										<th>KPI</th>
										<th>Valor</th>
										<th>Objetivo</th>
										<th>Cumpl.</th>
										<th>Puntos</th>
										<th>Peso</th>
										<th>Puesto</th>
									</tr>
								</thead>
								<tbody>
									{KPI_IDS.map((k) => {
										const s = v.kpis[k];
										const t = tierOf(s.puntos);
										return (
											<tr key={k}>
												<td>{KPI_DEFS[k].nombre}</td>
												<td>{pct(s.valor, true)}</td>
												<td>{pct(KPI_DEFS[k].objetivo, true)}</td>
												<td>{pct(s.attainment, true)}</td>
												<td>
													<b className={t ? `t-${t}` : undefined}>
														{fmt1(s.puntos)}
													</b>
												</td>
												<td>{Math.round(KPI_DEFS[k].peso * 100)} %</td>
												<td>{s.puesto ?? "–"}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<p className="note">
							Cumplimiento con tope en 110 %; 110 % vale 100 puntos y el
							objetivo justo vale 90,9. El puntaje es la suma ponderada de los
							siete.
						</p>
					</section>

					<section className="panel">
						<h2 className="h2" style={{ marginTop: 0 }}>
							Mes a mes
						</h2>
						<div className="vend-meses">
							{PERIODOS.map((p) => {
								const s = byPeriodo.get(p.id);
								const t = tierOf(s?.score ?? null);
								return (
									<div key={p.id} data-t={t ?? undefined}>
										<b className={t ? TIER_TEXT[t] : undefined}>
											{fmtScore(s?.score ?? null)}
										</b>
										{p.label.split(" ")[0]}
										<small>{s ? `#${s.puesto ?? "–"}` : "sin datos"}</small>
									</div>
								);
							})}
						</div>
						<p className="note">
							{row?.elegible
								? `Promedio de liga ${fmt1(row.promedio)}, puesto ${row.puesto} de ${liga.vendedores.filter((x) => x.elegible).length}.`
								: `Todavía no es elegible para la liga: ${row?.meses ?? 0} de ${row?.mesesRequeridos ?? 9} meses.`}
						</p>
					</section>

					<section className="panel">
						<h2 className="h2" style={{ marginTop: 0 }}>
							Álbum
						</h2>
						<div className="vend-album">
							{KPI_IDS.map((k) => (
								<AlbumRow key={k} kpi={k} grid={album.grid[k]} />
							))}
						</div>
						<p className="note">
							{album.total} figus, {conFigu} de 7 KPIs con al menos una.
							{holo > 0
								? ` ${holo} ${holo === 1 ? "holográfica" : "holográficas"}.`
								: ""}
						</p>
					</section>
				</div>
			</div>
		</>
	);
}

function AlbumRow({
	kpi,
	grid,
}: {
	kpi: KpiId;
	grid: Record<string, FiguMedal[]>;
}) {
	return (
		<>
			<span>{KPI_ALBUM[kpi]}</span>
			{PERIODOS.map((p) => {
				const fs = grid[p.id] ?? [];
				const best = MEDAL_RANK.find((m) => fs.some((f) => f.medalla === m));
				return (
					<i
						key={p.id}
						className="sticker"
						data-m={best}
						data-holo={fs.some((f) => f.holografica) ? "" : undefined}
					/>
				);
			})}
		</>
	);
}

function PageSkeleton() {
	return (
		<>
			<div className="title">
				<h1 className="skeleton">Cargando la carta</h1>
				<p className="skeleton">Cargando</p>
			</div>
			<div className="vend-layout">
				<div className="vend-left">
					<FiguSkeleton />
					<button type="button" className="btn btn-ghost skeleton" disabled>
						Ver el dorso
					</button>
				</div>
				<div className="vend-right">
					{[320, 120, 200].map((h) => (
						<div key={h} className="panel skeleton" style={{ height: h }} />
					))}
				</div>
			</div>
		</>
	);
}
