"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { Suspense, useDeferredValue } from "react";
import { ErrorBoundary, QueryErrorFallback } from "@/components/error-boundary";
import { Figu } from "@/components/figu/figu";
import { KPI_DEFS, KPI_IDS, SUCURSALES, type Vista } from "@/lib/domain";
import {
	canalNombre,
	fmtScore,
	fullName,
	kpiBad,
	pct,
	periodoLabel,
	sucursalNombre,
} from "@/lib/format";
import { type RankingParams, rankingOptions } from "@/lib/query/options";
import { rankingParsers } from "@/lib/search-params";
import { GridSkeleton } from "./skeletons";

const VISTAS: { id: Vista; label: string }[] = [
	{ id: "mes", label: "Mes" },
	{ id: "acum", label: "Acumulado" },
	{ id: "mix", label: "Combinada" },
];
const FOILS = ["oro", "plata", "bronce"] as const;

export function RankingClient({
	periodos,
	latest,
}: {
	periodos: string[];
	latest: string;
}) {
	const [sp, setSp] = useQueryStates(rankingParsers);
	const params: RankingParams = {
		periodo: periodos.includes(sp.periodo) ? sp.periodo : latest,
		vista: sp.vista,
		sucursal: sp.sucursal,
		canal: sp.canal,
	};
	// Keep the previous results on screen while the next query loads.
	const deferred = useDeferredValue(params);
	// periodo and vista also change the server-rendered lead, so they re-render the page.
	const server = { shallow: false } as const;

	return (
		<>
			<div className="rk-controls">
				<select
					className="select"
					aria-label="Período"
					value={params.periodo}
					onChange={(e) =>
						setSp(
							{ periodo: e.target.value === latest ? "" : e.target.value },
							server,
						)
					}
				>
					{[...periodos].reverse().map((id) => (
						<option key={id} value={id}>
							{periodoLabel(id)}
						</option>
					))}
				</select>
				{/* biome-ignore lint/a11y/useSemanticElements: .seg is styled as a div */}
				<div className="seg" role="group" aria-label="Vista">
					{VISTAS.map((v) => (
						<button
							key={v.id}
							type="button"
							aria-pressed={sp.vista === v.id}
							onClick={() => setSp({ vista: v.id }, server)}
						>
							{v.label}
						</button>
					))}
				</div>
				<select
					className="select"
					aria-label="Sucursal"
					value={sp.sucursal}
					onChange={(e) => setSp({ sucursal: e.target.value })}
				>
					<option value="">Todas las sucursales</option>
					{SUCURSALES.map((s) => (
						<option key={s.slug} value={s.slug}>
							{s.nombre}
						</option>
					))}
				</select>
				<select
					className="select"
					aria-label="Zona"
					value={sp.canal ?? ""}
					onChange={(e) =>
						setSp({ canal: (e.target.value || null) as typeof sp.canal })
					}
				>
					<option value="">Ciudad y rural</option>
					<option value="plaza">Ciudad</option>
					<option value="campaña">Rural</option>
				</select>
				{/* biome-ignore lint/a11y/useSemanticElements: .seg is styled as a div */}
				<div className="seg rk-end" role="group" aria-label="Formato">
					<button
						type="button"
						aria-pressed={sp.view === "cartas"}
						onClick={() => setSp({ view: "cartas" })}
					>
						Cartas
					</button>
					<button
						type="button"
						aria-pressed={sp.view === "tabla"}
						onClick={() => setSp({ view: "tabla" })}
					>
						Tabla
					</button>
				</div>
			</div>
			<ErrorBoundary fallback={(reset) => <QueryErrorFallback reset={reset} />}>
				<Suspense fallback={<GridSkeleton view={sp.view} />}>
					<RankingResults params={deferred} view={sp.view} />
				</Suspense>
			</ErrorBoundary>
		</>
	);
}

function RankingResults({
	params,
	view,
}: {
	params: RankingParams;
	view: "cartas" | "tabla";
}) {
	const { data } = useSuspenseQuery(rankingOptions(params));
	const { vendedores } = data;

	if (vendedores.length === 0) {
		return (
			<div className="panel" style={{ marginTop: 32 }}>
				Sin vendedores con datos para ese filtro. Cambiá la sucursal o la zona.
			</div>
		);
	}

	return (
		<>
			<h2 className="h2">
				Podio <span>oro, plata y bronce</span>
			</h2>
			<div className="podium">
				{vendedores.slice(0, 3).map((v, i) => (
					<Figu
						key={v.vendedor.id}
						v={v}
						foil={FOILS[i]}
						href={`/vendedor/${v.vendedor.id}`}
					/>
				))}
			</div>
			<h2 className="h2">
				Todas las cartas <span>{vendedores.length}, por puntaje</span>
			</h2>
			{view === "tabla" ? (
				<div className="rk-scroll">
					<table className="table">
						<thead>
							<tr>
								<th>#</th>
								<th className="l">Vendedor</th>
								<th className="l">Sucursal</th>
								<th className="l">Zona</th>
								<th>Puntaje</th>
								{KPI_IDS.map((k) => (
									<th key={k}>{KPI_DEFS[k].corto}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{vendedores.map((v) => (
								<tr key={v.vendedor.id}>
									<td>{v.puesto ?? "—"}</td>
									<td className="l">
										<Link href={`/vendedor/${v.vendedor.id}`}>
											{fullName(v.vendedor)}
										</Link>
									</td>
									<td className="l">{sucursalNombre(v.vendedor.sucursal)}</td>
									<td className="l capitalize">
										{canalNombre(v.vendedor.canal)}
									</td>
									<td className={v.tier ? `t-${v.tier}` : undefined}>
										<b>{fmtScore(v.score)}</b>
									</td>
									{KPI_IDS.map((k) => (
										<td
											key={k}
											className={
												kpiBad(KPI_DEFS[k], v.kpis[k].valor) ? "bad" : undefined
											}
										>
											{pct(v.kpis[k].valor)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="grid-figus">
					{vendedores.slice(3).map((v) => (
						<Figu
							key={v.vendedor.id}
							v={v}
							href={`/vendedor/${v.vendedor.id}`}
						/>
					))}
				</div>
			)}
		</>
	);
}
