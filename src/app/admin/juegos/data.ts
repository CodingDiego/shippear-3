// Read model of the admin "Juegos" page: one cached entry with what the charts show.
import { cacheLife, cacheTag } from "next/cache";
import { readEngagementMensual } from "@/lib/data/db-reads";
import {
	getAjustes,
	getJuegosConfig,
	getJuegosMedidas,
	getSeason,
	getSeasonMeta,
} from "@/lib/data/queries";
import {
	EVENTOS_ENGAGEMENT,
	type EventoEngagement,
	type FuenteEngagement,
	JUEGOS,
	type JuegoId,
	type JuegosConfig,
	periodoDe,
} from "@/lib/domain";
import { type Celda, juegoActivo } from "@/lib/games";
import { type EfectoConIntervalo, efectoConIntervalo } from "./twfe";

export type EventosMes = {
	periodoId: string;
	enCurso: boolean;
} & Record<EventoEngagement, Record<FuenteEngagement, number>>;

export type JuegoVista = {
	juego: JuegoId;
	/** Current global switch. */
	activo: boolean;
	/** y = venta attainment (1 = met the plan). Sucursal: mean of its sellers. */
	efecto: { sucursal: EfectoConIntervalo; vendedor: EfectoConIntervalo };
	/** Extra kilos per seller-month with the game on; null when not identified. */
	kgPorVendedorMes: number | null;
	/** Last closed month: share of eligible sellers who used the game, and retention. */
	uso: {
		periodoId: string;
		tasa: number | null;
		retencion: number | null;
		eventosPorActivo: number | null;
	} | null;
	/** Closed months plus the month in progress. */
	eventos: EventosMes[];
	premios: {
		costoArs: number;
		kgExtra: number | null;
		valorArs: number | null;
		roi: number | null;
		simulado: boolean;
	};
	simulado: boolean;
};

export type JuegosVista = { valorKgArs: number; juegos: JuegoVista[] };

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export async function getJuegosVista(): Promise<JuegosVista> {
	"use cache";
	cacheLife("hours");
	cacheTag("dataset", "config", "engagement");
	const [medidas, season, config, meta, filas, ajustes] = await Promise.all([
		getJuegosMedidas(),
		getSeason(),
		getJuegosConfig(),
		getSeasonMeta(),
		readEngagementMensual(),
		getAjustes(),
	]);
	// Same rule as getJuegosMedidas: history comes from the intervals, not today's global switch.
	const historia: JuegosConfig = {
		...config,
		global: Object.fromEntries(JUEGOS.map((j) => [j, true])) as Record<
			JuegoId,
			boolean
		>,
	};
	const meses = [
		...season.map((p) => p.periodoId),
		...(meta.enCurso ? [meta.enCurso] : []),
	];

	const juegos = medidas.map((m): JuegoVista => {
		const vendedor: Celda[] = [];
		const sucursal: Celda[] = [];
		for (const p of season) {
			const porSuc = new Map<string, number[]>();
			for (const v of p.vendedores) {
				const y = v.kpis.venta?.attainment ?? null;
				if (y === null) continue;
				const suc = v.vendedor.sucursal;
				vendedor.push({
					unidad: v.vendedor.id,
					periodoId: p.periodoId,
					y,
					activo: juegoActivo(historia, m.juego, suc, p.periodoId),
				});
				porSuc.set(suc, [...(porSuc.get(suc) ?? []), y]);
			}
			for (const [suc, ys] of porSuc)
				sucursal.push({
					unidad: suc,
					periodoId: p.periodoId,
					y: media(ys),
					activo: juegoActivo(historia, m.juego, suc, p.periodoId),
				});
		}

		const propias = filas.filter((f) => f.juego === m.juego);
		const eventos = meses.map((periodoId): EventosMes => {
			const delMes = propias.filter((f) => periodoDe(f.fecha) === periodoId);
			const suma = (e: EventoEngagement, fuente: FuenteEngagement) =>
				delMes
					.filter((f) => f.evento === e && f.fuente === fuente)
					.reduce((t, f) => t + f.cantidad, 0);
			return {
				periodoId,
				enCurso: periodoId === meta.enCurso,
				...(Object.fromEntries(
					EVENTOS_ENGAGEMENT.map((e) => [
						e,
						{ real: suma(e, "real"), simulado: suma(e, "simulado") },
					]),
				) as Record<EventoEngagement, Record<FuenteEngagement, number>>),
			};
		});

		const ultimo = m.engagement.meses.findLast((x) => x.elegibles > 0);
		const kg = m.efecto.vendedor.kg;
		return {
			juego: m.juego,
			activo: m.activo,
			efecto: {
				sucursal: efectoConIntervalo(sucursal),
				vendedor: efectoConIntervalo(vendedor),
			},
			kgPorVendedorMes: kg.beta,
			uso: ultimo
				? {
						periodoId: ultimo.periodoId,
						tasa: ultimo.tasa,
						retencion: ultimo.retencion,
						eventosPorActivo: ultimo.eventosPorActivo,
					}
				: null,
			eventos,
			premios: {
				costoArs: m.premios.costoArs,
				kgExtra: kg.beta === null ? null : kg.beta * kg.tratadas,
				valorArs: m.premios.valorArs,
				roi: m.premios.roi,
				simulado: m.premios.simulado,
			},
			simulado: m.engagement.simulado || m.premios.simulado,
		};
	});
	return { valorKgArs: ajustes.valor_kg_ars, juegos };
}
