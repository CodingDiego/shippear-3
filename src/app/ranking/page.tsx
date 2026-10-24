import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { connection } from "next/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import "./ranking.css";
import { getScoredPeriod, getSeasonMeta } from "@/lib/data/queries";
import {
	fmtScore,
	mesNombre,
	periodoLargo,
	shortName,
	sucursalNombre,
} from "@/lib/format";
import { getQueryClient } from "@/lib/query/client";
import { rankingOptions } from "@/lib/query/options";
import { byPuesto, loadRanking } from "@/lib/query/ranking";
import { RankingClient } from "./_components/ranking-client";
import { Resort } from "./_components/resort";
import { ResortSkeleton } from "./_components/resort-skeleton";
import { ControlsSkeleton, GridSkeleton } from "./_components/skeletons";
import { consulta, loadScopeParams } from "./scope";

export const metadata = { title: "Ranking" };

type SP = PageProps<"/ranking">["searchParams"];

export default function RankingPage(props: PageProps<"/ranking">) {
	return (
		<main className="wrap">
			<header className="title rk-title">
				<div>
					<h1>Ranking de vendedores</h1>
					<Suspense
						fallback={
							<p>
								<span
									className="skeleton"
									style={{
										display: "block",
										height: 22,
										width: 520,
										maxWidth: "100%",
									}}
								/>
							</p>
						}
					>
						<Lead searchParams={props.searchParams} />
					</Suspense>
				</div>
				<Suspense
					fallback={
						<span
							className="skeleton stamp"
							style={{ display: "block", height: 18, width: 220 }}
						/>
					}
				>
					<Stamp searchParams={props.searchParams} />
				</Suspense>
			</header>
			<Suspense
				fallback={
					<>
						<ControlsSkeleton />
						<GridSkeleton view="cartas" />
					</>
				}
			>
				<RankingBody searchParams={props.searchParams} />
			</Suspense>
		</main>
	);
}

async function resolve(searchParams: SP) {
	const [sp, meta] = await Promise.all([
		loadScopeParams(searchParams),
		getSeasonMeta(),
	]);
	// Unknown or empty periodo falls back to the latest period with data.
	const periodo = meta.periodos.includes(sp.periodo) ? sp.periodo : meta.latest;
	return { sp, meta, periodo };
}

async function Lead({ searchParams }: { searchParams: SP }) {
	const { sp, periodo } = await resolve(searchParams);
	const { vendedores } = await getScoredPeriod(periodo, sp.vista);
	const scored = vendedores.filter((v) => v.score !== null);
	const top = [...scored].sort(byPuesto)[0];
	if (!top) return <p>Sin vendedores con datos en {mesNombre(periodo)}.</p>;
	const n = (tier: string) => scored.filter((v) => v.tier === tier).length;
	return (
		<p>
			<b>
				{shortName(top.vendedor)}, de {sucursalNombre(top.vendedor.sucursal)},
				es el número 1 del país con {fmtScore(top.score)} puntos.
			</b>{" "}
			{scored.length} vendedores con datos en {mesNombre(periodo)}: {n("verde")}{" "}
			arriba, {n("amarillo")} en carrera y {n("rojo")} abajo.
		</p>
	);
}

async function Stamp({ searchParams }: { searchParams: SP }) {
	const { periodo } = await resolve(searchParams);
	return (
		<span className="stamp">
			Datos al último día de {periodoLargo(periodo)}
		</span>
	);
}

async function RankingBody({ searchParams }: { searchParams: SP }) {
	// react-query reads Date.now(), which cacheComponents only allows after request-time data.
	await connection();
	const { sp, meta, periodo } = await resolve(searchParams);
	const queryClient = getQueryClient();
	const params = consulta(sp, meta.periodos, meta.latest);
	// The browser queryFn fetches /api/ranking; on the server call the same loader.
	await queryClient.prefetchQuery({
		...rankingOptions(params),
		queryFn: () => loadRanking(params),
	});
	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<NuqsAdapter>
				<RankingClient
					periodos={meta.periodos}
					latest={meta.latest}
					resort={
						<Suspense fallback={<ResortSkeleton />}>
							<Resort
								periodo={periodo}
								periodos={meta.periodos}
								vista={sp.vista}
							/>
						</Suspense>
					}
				/>
			</NuqsAdapter>
		</HydrationBoundary>
	);
}
