// Goal tracker (SPEC-V2 "Goal tracker"). Pure: the data layer reads the window
// aggregates in SQL (src/lib/data/windows.ts) and passes them in.
import {
	ACCION_CUSTOM_DEFAULT,
	type Ajustes,
	CONSTANCIA_ID,
	efectivo,
	type MetricaDef,
	type MetricaId,
	type Sugerencia,
	type Tracker,
	type TrackerMetrica,
} from "@/lib/domain";
import { attainment, puntos } from "@/lib/scoring";
import type { VentanaMeta } from "@/lib/time";

/** One metric's numbers for the elapsed part of the window (ventana.desde..ventana.ref). */
export type AgregadoMetrica = {
	/** flujo: Σnum over the elapsed days. stock: the latest snapshot <= ref in ref's month. */
	num: number;
	/** Same rule as num. */
	den: number;
	/**
	 * Whole-window den known in advance (venta's OV plan for desde..hasta). null when not
	 * known: the tracker then scales den by diasHabiles / diasTranscurridos like any flujo metric.
	 */
	denPlan: number | null;
	/**
	 * flujo only: average daily num over the last min(14, elapsed) working days of the window
	 * (the pace). Absent = num / diasTranscurridos, the plain average so far.
	 */
	ritmo?: number;
};

export type TrackerInput = {
	vendedorId: string;
	/** Window and working-day counts, from ventanaDe(ventana, hoy()). */
	ventana: VentanaMeta;
	/** Every def; the tracker keeps activa ones (weekly: acumulacion "flujo" only). */
	defs: readonly MetricaDef[];
	ajustes: Ajustes;
	/** By MetricaId for every stored (flujo/stock) active metric; a missing id = no data. */
	agregados: Readonly<Record<MetricaId, AgregadoMetrica>>;
	/** Constancia valor at ventana.ref (monthly window only); null = no value. */
	constancia: number | null;
};

/** Kept for callers of the first v2 signature; inalcanzable and descartadas now live on Tracker. */
export type TrackerResultado = Tracker;

/** Shown by the weekly tracker when nothing can close the gap before Sunday. */
export const MENSAJE_SEMANA_INALCANZABLE =
	"Esta semana ya no alcanza para la meta; la del mes sigue abierta";

const EPS = 1e-9;
const PUNTOS_OBJETIVO = puntos(1);

type Fila = {
	def: MetricaDef;
	m: TrackerMetrica;
	/** Projected window den (effort base). */
	pDen: number;
	/** Most numerator units that can still change, today included. */
	capacidad: number;
};

function fila(def: MetricaDef, input: TrackerInput): Fila {
	const v = input.ventana;
	const base = { metrica: def.id, objetivo: def.objetivo };
	const pts = (x: number | null) =>
		x === null ? null : puntos(attainment(def, x));

	if (def.acumulacion === "derivada") {
		const valor =
			def.id === CONSTANCIA_ID && v.ventana === "mes" ? input.constancia : null;
		return {
			def,
			m: {
				...base,
				valor,
				valorProyectado: valor,
				puntos: pts(valor),
				alcanzado: valor !== null && attainment(def, valor) >= 1 - EPS,
				faltanUnidades: null,
			},
			pDen: 0,
			capacidad: 0,
		};
	}

	const a = input.agregados[def.id];
	const valor = a && a.den > 0 ? a.num / a.den : null;
	let pNum = a?.num ?? 0;
	let pDen = a?.den ?? 0;
	let capacidad = 0;
	if (a && def.acumulacion === "flujo") {
		const t = v.diasTranscurridos;
		if (t > 0) {
			// num: so far plus the recent pace over the days left; den: the plan, else elapsed share.
			const ritmo = a.ritmo ?? a.num / t;
			pNum = a.num + ritmo * (v.diasHabiles - t);
			pDen = a.denPlan ?? (a.den * v.diasHabiles) / t;
			// Still to come plus today's share: the seller checks the tracker during the day.
			capacidad =
				def.direccion === "mayor"
					? pDen - a.den + a.den / t
					: pNum - a.num + ritmo;
		} else pDen = a.denPlan ?? 0;
	} else if (a) {
		// stock: the snapshot is the projection; only clients not yet converted can move.
		capacidad = def.direccion === "mayor" ? a.den - a.num : a.num;
	}
	capacidad = Math.min(capacidad, pDen);

	const valorProyectado = a && pDen > 0 ? pNum / pDen : null;
	const alcanzado =
		valorProyectado !== null && attainment(def, valorProyectado) >= 1 - EPS;
	let faltanUnidades: number | null = null;
	if (valorProyectado !== null)
		faltanUnidades = alcanzado
			? 0
			: Math.max(
					1,
					Math.ceil(
						(def.direccion === "mayor"
							? def.objetivo * pDen - pNum
							: pNum - def.objetivo * pDen) - EPS,
					),
				);

	return {
		def,
		m: {
			...base,
			valor,
			valorProyectado,
			puntos: pts(valor),
			alcanzado,
			faltanUnidades,
		},
		pDen,
		capacidad,
	};
}

/** Σw·p / Σw over metrics with points; null when they hold under half the weight (v1 rule). */
function puntaje(
	filas: readonly Fila[],
	pesos: Record<MetricaId, number>,
	p: (f: Fila) => number | null,
): number | null {
	let total = 0;
	let avail = 0;
	let sum = 0;
	for (const f of filas) {
		const w = pesos[f.def.id] ?? 0;
		total += w;
		const x = p(f);
		if (x !== null) {
			avail += w;
			sum += w * x;
		}
	}
	return avail <= 0 || avail < total * 0.5 - EPS ? null : sum / avail;
}

/**
 * Score so far, faltan, pace projection, per-metric status and at most 3 suggestions,
 * exactly as SPEC-V2 describes (gain/effort greedy, figu phrasing when faltan = 0).
 * Weekly window with a gap and no suggestion that fits: mensaje says so plainly.
 */
export function tracker(input: TrackerInput): Tracker {
	const v = input.ventana;
	const defs = input.defs
		.filter(
			(d) => d.activa && (v.ventana === "mes" || d.acumulacion === "flujo"),
		)
		.sort((a, b) => a.orden - b.orden);
	const pesos = efectivo(defs);
	const filas = defs.map((d) => fila(d, input));

	const score = puntaje(filas, pesos, (f) => f.m.puntos);
	const proyeccion = puntaje(filas, pesos, (f) =>
		f.m.valorProyectado === null
			? null
			: puntos(attainment(f.def, f.m.valorProyectado)),
	);
	const meta = input.ajustes.meta_puntos;
	const faltan =
		score === null ? meta : Math.max(0, Math.round((meta - score) * 10) / 10);

	const abiertas = filas.filter(
		(f) => f.m.faltanUnidades !== null && f.m.faltanUnidades > 0,
	);
	const descartadas = abiertas
		.filter((f) => (f.m.faltanUnidades ?? 0) > f.capacidad + EPS)
		.map((f) => f.def.id);
	const candidatas = abiertas
		.filter((f) => !descartadas.includes(f.def.id))
		.map((f): Sugerencia => {
			const n = f.m.faltanUnidades ?? 1;
			return {
				metrica: f.def.id,
				n,
				texto: textoAccion(f.def, n),
				ganancia: Math.max(
					0,
					(pesos[f.def.id] ?? 0) * (PUNTOS_OBJETIVO - (f.m.puntos ?? 0)),
				),
				esfuerzo: n / f.pDen,
				figu: false,
			};
		});

	let sugerencias: Sugerencia[] = [];
	let inalcanzable = false;
	if (faltan > 0) {
		let suma = 0;
		for (const s of candidatas.sort(
			(a, b) => b.ganancia / b.esfuerzo - a.ganancia / a.esfuerzo,
		)) {
			if (sugerencias.length === 3 || suma >= faltan - EPS) break;
			sugerencias.push(s);
			suma += s.ganancia;
		}
		inalcanzable = suma < faltan - EPS;
	} else {
		const s = candidatas.sort((a, b) => a.esfuerzo - b.esfuerzo)[0];
		const def = s && defs.find((d) => d.id === s.metrica);
		if (s && def)
			sugerencias = [
				{
					...s,
					texto: `${s.texto} y ganá la figu de ${def.nombre}`,
					figu: true,
				},
			];
	}

	return {
		vendedorId: input.vendedorId,
		ventana: v.ventana,
		desde: v.desde,
		hasta: v.hasta,
		ref: v.ref,
		diasHabiles: v.diasHabiles,
		diasTranscurridos: v.diasTranscurridos,
		score,
		meta,
		faltan,
		proyeccion,
		metricas: filas.map((f) => f.m),
		sugerencias,
		inalcanzable,
		descartadas,
		mensaje:
			v.ventana === "semana" &&
			score !== null &&
			inalcanzable &&
			sugerencias.length === 0
				? MENSAJE_SEMANA_INALCANZABLE
				: null,
	};
}

const entero = new Intl.NumberFormat("es-AR", {
	maximumFractionDigits: 0,
	useGrouping: "always",
});

/** Plural words right after {n} (up to "más" or a word without s) to singular, for n = 1. */
function singular(plantilla: string): string {
	const i = plantilla.indexOf("{n} ");
	if (i < 0) return plantilla;
	const palabras = plantilla.slice(i + 4).split(" ");
	for (let k = 0; k < palabras.length; k++) {
		const w = palabras[k];
		if (w === "más" || w === "kg" || !w.endsWith("s")) break;
		palabras[k] = w.replace(/iones$/, "ión").replace(/s$/, "");
	}
	return `${plantilla.slice(0, i + 4)}${palabras.join(" ")}`.replace(
		/\bcompren\b/,
		"compre",
	);
}

/** def.accion (or ACCION_CUSTOM_DEFAULT with {num}) with {n} filled, es-AR thousands separator. */
export function textoAccion(def: MetricaDef, n: number): string {
	const k = Math.max(1, Math.ceil(n));
	const plantilla =
		def.accion || ACCION_CUSTOM_DEFAULT.replace("{num}", def.num);
	return (k === 1 ? singular(plantilla) : plantilla).replace(
		"{n}",
		entero.format(k),
	);
}
