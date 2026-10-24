import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import "./kpi.css";
import {
	getMetricas,
	getScoredPeriod,
	getSeasonMeta,
} from "@/lib/data/queries";
import { efectivo, KPI_DEFS, KPI_IDS, type KpiId } from "@/lib/domain";
import {
	fmt1,
	fullName,
	pct,
	periodoLargo,
	sucursalNombre,
} from "@/lib/format";

type Props = PageProps<"/kpi/[kpi]">;

const isKpi = (k: string): k is KpiId => Object.hasOwn(KPI_DEFS, k);
const CHIP = ["bg-oro", "bg-plata", "bg-bronce"];

export function generateStaticParams() {
	return KPI_IDS.map((kpi) => ({ kpi }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { kpi } = await params;
	if (!isKpi(kpi)) notFound();
	return { title: KPI_DEFS[kpi].nombre };
}

export default function KpiPage(props: Props) {
	return (
		<main className="wrap">
			<Suspense fallback={<Skeleton />}>
				<Body params={props.params} />
			</Suspense>
		</main>
	);
}

function Skeleton() {
	return (
		<>
			<header className="title">
				<h1 className="skeleton" style={{ width: 280, height: 34 }}>
					Indicador
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
			<h2 className="h2">Ranking</h2>
			<div className="rows">
				{Array.from({ length: 24 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
					<div className="row" data-loading="" key={i}>
						<b>0</b>
						<div className="who">Nombre</div>
						<div className="pts">00</div>
					</div>
				))}
			</div>
		</>
	);
}

async function Body({ params }: { params: Props["params"] }) {
	const { kpi } = await params;
	if (!isKpi(kpi)) notFound();
	const def = KPI_DEFS[kpi];
	const [{ latest }, metricas] = await Promise.all([
		getSeasonMeta(),
		getMetricas(),
	]);
	const period = await getScoredPeriod(latest, "mes");
	// The live weight: what is left of 100 % after the admin's active metrics are normalised.
	const peso = efectivo(metricas)[kpi] ?? def.peso;
	const rows = period.vendedores
		.filter((v) => v.kpis[kpi].puesto !== null)
		.sort((a, b) => (a.kpis[kpi].puesto ?? 0) - (b.kpis[kpi].puesto ?? 0));

	return (
		<>
			<header className="title">
				<h1>{def.nombre}</h1>
				<p>
					<b>
						Pesa {Math.round(peso * 100)} % del puntaje; el objetivo es{" "}
						{pct(def.objetivo, true)}.
					</b>{" "}
					Compara {def.num} con {def.den}.{" "}
					{def.direccion === "menor"
						? "Cuanto más bajo, mejor."
						: "Cuanto más alto, mejor."}
				</p>
			</header>
			<nav aria-label="Indicadores" style={{ overflowX: "auto" }}>
				<div className="seg">
					{KPI_IDS.map((k) => (
						<Link
							key={k}
							href={`/kpi/${k}`}
							aria-current={k === kpi ? "page" : undefined}
							style={{ whiteSpace: "nowrap" }}
						>
							{KPI_DEFS[k].nombre}
						</Link>
					))}
				</div>
			</nav>
			<h2 className="h2">
				Ranking de {def.nombre.toLowerCase()}{" "}
				<span>
					{periodoLargo(latest)}, {rows.length} vendedores
				</span>
			</h2>
			<div style={{ overflowX: "auto" }}>
				<table className="table kpi-table">
					<thead>
						<tr>
							<th>Puesto</th>
							<th>Vendedor</th>
							<th>Sucursal</th>
							<th>Resultado</th>
							<th>Puntos</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((v) => {
							const k = v.kpis[kpi];
							const top =
								(k.puesto ?? 99) <= 3 ? CHIP[(k.puesto ?? 1) - 1] : null;
							return (
								<tr key={v.vendedor.id}>
									<td>
										{k.puesto}
										{top && (
											<span
												className={`${top} ml-2 rounded-full px-2 text-xs font-semibold text-ink`}
											>
												{["Oro", "Plata", "Bronce"][(k.puesto ?? 1) - 1]}
											</span>
										)}
									</td>
									<td>
										<Link href={`/vendedor/${v.vendedor.id}`}>
											{fullName(v.vendedor)}
										</Link>
									</td>
									<td>{sucursalNombre(v.vendedor.sucursal)}</td>
									<td>{pct(k.valor)}</td>
									<td>
										<b>{fmt1(k.puntos)}</b>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</>
	);
}
