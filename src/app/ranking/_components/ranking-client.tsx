"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { type ReactNode, Suspense, useDeferredValue } from "react";
import { ErrorBoundary, QueryErrorFallback } from "@/components/error-boundary";
import { Figu } from "@/components/figu/figu";
import {
	KPI_DEFS,
	KPI_IDS,
	PROVINCIAS,
	provinciaDe,
	SUCURSALES,
	type Vista,
} from "@/lib/domain";
import {
	canalNombre,
	fmt1,
	fmtScore,
	fullName,
	kpiBad,
	pct,
	periodoLabel,
	sucursalNombre,
} from "@/lib/format";
import {
	type RankingParams,
	type RankingResponse,
	rankingOptions,
} from "@/lib/query/options";
import {
	alcance,
	ambito,
	consulta,
	ENTIDAD_LABEL,
	type Entidad,
	nombreProvincia,
	SCOPE_LABEL,
	SCOPES,
	type Scope,
	scopeParsers,
} from "../scope";
import { GridSkeleton } from "./skeletons";

const VISTAS: { id: Vista; label: string }[] = [
	{ id: "mes", label: "Mes" },
	{ id: "acum", label: "Acumulado" },
	{ id: "mix", label: "Combinada" },
];
const FOILS = ["oro", "plata", "bronce"] as const;

const de = (puesto: number | null | undefined, total: number | undefined) =>
	puesto == null ? "—" : `${puesto} de ${total ?? "—"}`;

export function RankingClient({
	periodos,
	latest,
	resort,
}: {
	periodos: string[];
	latest: string;
	/** Server-rendered top 5 animation; shown only for vendedores of the whole country. */
	resort: ReactNode;
}) {
	const [sp, setSp] = useQueryStates(scopeParsers);
	const a = alcance(sp);
	const params = consulta(sp, periodos, latest);
	// Keep the previous results on screen while the next query loads.
	const deferred = useDeferredValue(params);
	const entidad = useDeferredValue(a.entidad);
	// periodo and vista also change the server-rendered pieces, so they re-render the page.
	const server = { shallow: false } as const;

	const elegirScope = (scope: Scope) =>
		setSp({
			scope,
			// A leftover ?sucursal= would turn "País" back into one sucursal.
			sucursal: scope === "sucursal" ? a.sucursal : "",
			provincia: scope === "provincia" ? a.provincia : "",
		});

	return (
		<>
			<div className="rk-controls">
				{/* biome-ignore lint/a11y/useSemanticElements: .tabs is styled as a div */}
				<div className="tabs" role="group" aria-label="Alcance del ranking">
					{SCOPES.map((s) => (
						<button
							key={s}
							type="button"
							aria-pressed={a.scope === s}
							onClick={() => elegirScope(s)}
						>
							{SCOPE_LABEL[s]}
						</button>
					))}
				</div>
				{a.scope === "provincia" && (
					<select
						className="select"
						aria-label="Provincia"
						value={a.provincia}
						onChange={(e) => setSp({ provincia: e.target.value })}
					>
						{PROVINCIAS.map((p) => (
							<option key={p.slug} value={p.slug}>
								{p.nombre}
							</option>
						))}
					</select>
				)}
				{a.scope === "sucursal" && (
					<select
						className="select"
						aria-label="Sucursal"
						value={a.sucursal}
						onChange={(e) => setSp({ sucursal: e.target.value })}
					>
						{SUCURSALES.map((s) => (
							<option key={s.slug} value={s.slug}>
								{s.nombre}
							</option>
						))}
					</select>
				)}
			</div>
			<div className="rk-controls">
				{a.entidades.length > 1 && (
					// biome-ignore lint/a11y/useSemanticElements: .seg is styled as a div
					<div className="seg" role="group" aria-label="Qué se ordena">
						{a.entidades.map((e) => (
							<button
								key={e}
								type="button"
								aria-pressed={a.entidad === e}
								onClick={() => setSp({ entidad: e })}
							>
								{ENTIDAD_LABEL[e]}
							</button>
						))}
					</div>
				)}
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
				{a.entidad === "vendedores" && (
					<>
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
					</>
				)}
			</div>
			<ErrorBoundary fallback={(reset) => <QueryErrorFallback reset={reset} />}>
				<Suspense
					fallback={
						<GridSkeleton
							view={sp.view}
							entidad={a.entidad}
							resort={a.scope === "pais" && !sp.canal}
						/>
					}
				>
					<RankingResults
						params={deferred}
						entidad={entidad}
						view={sp.view}
						ambito={ambito(sp)}
						resort={a.scope === "pais" && !sp.canal ? resort : null}
					/>
				</Suspense>
			</ErrorBoundary>
		</>
	);
}

function RankingResults({
	params,
	entidad,
	view,
	ambito,
	resort,
}: {
	params: RankingParams;
	entidad: Entidad;
	view: "cartas" | "tabla";
	ambito: string;
	resort: ReactNode;
}) {
	const { data } = useSuspenseQuery(rankingOptions(params));
	if (entidad === "sucursales") return <Sucursales data={data} />;
	if (entidad === "provincias") return <Provincias data={data} />;
	return <Vendedores data={data} view={view} ambito={ambito} resort={resort} />;
}

function Vendedores({
	data,
	view,
	ambito,
	resort,
}: {
	data: RankingResponse;
	view: "cartas" | "tabla";
	ambito: string;
	resort: ReactNode;
}) {
	const { vendedores } = data;

	if (vendedores.length === 0) {
		return (
			<div className="panel" style={{ marginTop: 32 }}>
				Sin vendedores con datos para ese filtro. Cambiá la zona o el alcance.
			</div>
		);
	}

	return (
		<>
			{resort}
			<h2 className="h2">
				Podio <span>{ambito}: oro, plata y bronce</span>
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
				{view === "tabla" ? "Todos los vendedores" : "Todas las cartas"}{" "}
				<span>{vendedores.length}, por puntaje</span>
			</h2>
			{view === "tabla" ? (
				<div className="rk-scroll">
					<table className="table">
						<thead>
							<tr>
								<th className="l">Vendedor</th>
								<th className="l">Sucursal</th>
								<th className="l">Zona</th>
								<th>Puesto en el país</th>
								<th>Puesto en la provincia</th>
								<th>Puesto en la sucursal</th>
								<th>Puntaje</th>
								{KPI_IDS.map((k) => (
									<th key={k}>{KPI_DEFS[k].corto}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{vendedores.map((v) => (
								<tr key={v.vendedor.id}>
									<td className="l">
										<Link href={`/vendedor/${v.vendedor.id}`}>
											{fullName(v.vendedor)}
										</Link>
									</td>
									<td className="l">{sucursalNombre(v.vendedor.sucursal)}</td>
									<td className="l capitalize">
										{canalNombre(v.vendedor.canal)}
									</td>
									<td>{de(v.puesto, v.de)}</td>
									<td>{de(v.puestoProvincia, v.deProvincia)}</td>
									<td>{de(v.puestoSucursal, v.deSucursal)}</td>
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

function Sucursales({ data }: { data: RankingResponse }) {
	const { sucursales } = data;
	if (sucursales.length === 0)
		return (
			<div className="panel" style={{ marginTop: 32 }}>
				Todavía no hay sucursales con datos en ese mes.
			</div>
		);
	return (
		<>
			<h2 className="h2">
				Sucursales{" "}
				<span>{sucursales.length}, por promedio de sus vendedores</span>
			</h2>
			<div className="rk-scroll">
				<table className="table">
					<thead>
						<tr>
							<th>Puesto en el país</th>
							<th>Puesto en la provincia</th>
							<th className="l">Sucursal</th>
							<th className="l">Provincia</th>
							<th>Promedio</th>
							<th>Vendedores con datos</th>
						</tr>
					</thead>
					<tbody>
						{sucursales.map((s) => {
							const prov = provinciaDe(s.sucursal.slug);
							return (
								<tr key={s.sucursal.slug}>
									<td>{s.puesto ?? "—"}</td>
									<td>{s.puestoProvincia ?? "—"}</td>
									<td className="l">
										<Link href={`/ranking/sucursal/${s.sucursal.slug}`}>
											{s.sucursal.nombre}
										</Link>
									</td>
									<td className="l">
										{prov ? (
											<Link href={`/ranking/provincia/${prov}`}>
												{nombreProvincia(prov)}
											</Link>
										) : (
											"—"
										)}
									</td>
									<td className={s.tier ? `t-${s.tier}` : undefined}>
										<b>{fmt1(s.score)}</b>
									</td>
									<td>{s.miembros}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</>
	);
}

function Provincias({ data }: { data: RankingResponse }) {
	const { provincias } = data;
	return (
		<>
			<h2 className="h2">
				Provincias{" "}
				<span>{provincias.length}, por promedio de sus vendedores</span>
			</h2>
			<div className="rk-scroll">
				<table className="table">
					<thead>
						<tr>
							<th>Puesto</th>
							<th className="l">Provincia</th>
							<th>Promedio</th>
							<th>Vendedores con datos</th>
							<th>Sucursales</th>
						</tr>
					</thead>
					<tbody>
						{provincias.map((p) => (
							<tr key={p.provincia.slug}>
								<td>{p.puesto ?? "—"}</td>
								<td className="l">
									<Link href={`/ranking/provincia/${p.provincia.slug}`}>
										{p.provincia.nombre}
									</Link>
								</td>
								<td className={p.tier ? `t-${p.tier}` : undefined}>
									<b>{fmt1(p.score)}</b>
								</td>
								<td>{p.miembros}</td>
								<td>{p.sucursales}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
