// v2 metric-driven scorer. Same formulas as v1 (attainment, TOPE, puntos, vista blend,
// 50% weight rule, tie rules), but over a MetricaDef[] instead of the fixed seven KPIs.
import {
	CONSTANCIA_ID,
	type Dataset,
	efectivo,
	KPI_IDS,
	type KpiScore,
	type MetricaDef,
	type MetricaId,
	PERIODO_BY_ID,
	type ScoredPeriod,
	type ScoredVendedor,
	SEASON_START,
	TOPE,
	type Vista,
} from "../domain";
import { attainment, kpiValue, puntos } from "./kpi";
import { rankProvincias } from "./provincia";
import { cmpKpi, rank } from "./rank";
import { blendVista, finalize } from "./score";

export type ScoreV2Opts = {
	/** Every metric def; only activa ones score. Weights are renormalised with efectivo(defs). */
	defs: readonly MetricaDef[];
	/**
	 * Constancia valor per vendedorId at the period's reference date (fechaReferencia).
	 * Missing or null = no value. Same value for every vista. Ignored when constancia is inactive.
	 */
	constancia?: Readonly<Record<string, number | null>>;
};

type Acc = {
	hasMes: boolean;
	mesNum: number;
	mesDen: number;
	acumNum: number;
	acumDen: number;
};

const vacio = (kpi: MetricaId): KpiScore => ({
	kpi,
	valor: null,
	attainment: null,
	puntos: null,
	puesto: null,
	de: 0,
});

/**
 * Scores one period over opts.defs. Monthly num/den come from dataset.resultados
 * (stock metrics: the month's last snapshot, so acum = Σ monthly snapshots as in v1).
 * kpis always holds the seven KPI_IDS (inactive ones with null valor/puntos/puesto) plus
 * every active custom metric and constancia. Fills puestoProvincia/deProvincia,
 * sucursal puestoProvincia and provincias (via rankProvincias).
 * Compat: v1 scorePeriod(d, p, v) is
 * scorePeriodV2(d, p, v, { defs: d.metricas ?? metricasDe(d.defs) }).
 */
export function scorePeriodV2(
	dataset: Dataset,
	periodoId: string,
	vista: Vista,
	opts: ScoreV2Opts,
): ScoredPeriod {
	const activas = opts.defs.filter((m) => m.activa);
	const guardadas = activas.filter((m) => m.acumulacion !== "derivada");
	const constanciaDef = activas.find((m) => m.id === CONSTANCIA_ID);
	const ids = new Set(guardadas.map((m) => m.id));
	const pesoMes = PERIODO_BY_ID[periodoId]?.pesoMes ?? 0.5;

	// One pass over the rows, Map keyed by vendedorId|kpi.
	const acc = new Map<string, Acc>();
	for (const r of dataset.resultados) {
		if (r.periodoId < SEASON_START || r.periodoId > periodoId) continue;
		if (!ids.has(r.kpi)) continue;
		const key = `${r.vendedorId}|${r.kpi}`;
		let a = acc.get(key);
		if (!a) {
			a = { hasMes: false, mesNum: 0, mesDen: 0, acumNum: 0, acumDen: 0 };
			acc.set(key, a);
		}
		a.acumNum += r.num;
		a.acumDen += r.den;
		if (r.periodoId === periodoId) {
			a.hasMes = true;
			a.mesNum += r.num;
			a.mesDen += r.den;
		}
	}

	// den used for the per-metric tie-break, same key as acc
	const dens = new Map<string, number>();
	const rows = dataset.vendedores
		.filter((v) => v.altaPeriodo <= periodoId)
		.map((vendedor) => {
			const kpis: Record<MetricaId, KpiScore> = {};
			for (const k of KPI_IDS) kpis[k] = vacio(k);
			for (const def of guardadas) {
				const a = acc.get(`${vendedor.id}|${def.id}`);
				const mes = a?.hasMes
					? kpiValue({ num: a.mesNum, den: a.mesDen })
					: null;
				const acum = a ? kpiValue({ num: a.acumNum, den: a.acumDen }) : null;
				const pts = (v: number | null) =>
					v === null ? null : puntos(attainment(def, v));

				let valor: number | null;
				let p: number | null;
				let den: number;
				if (vista === "mes") {
					valor = mes;
					p = pts(mes);
					den = a?.mesDen ?? 0;
				} else if (vista === "acum") {
					valor = acum;
					p = pts(acum);
					den = a?.acumDen ?? 0;
				} else {
					p = blendVista(pts(mes), pts(acum), pesoMes);
					valor = mes ?? acum; // keeps "puntos null when valor null"
					den = mes !== null ? (a?.mesDen ?? 0) : (a?.acumDen ?? 0);
				}
				dens.set(`${vendedor.id}|${def.id}`, den);
				kpis[def.id] = {
					kpi: def.id,
					valor,
					// mix: the attainment equivalent to the blended puntos
					attainment:
						valor === null || p === null
							? null
							: vista === "mix"
								? (p * TOPE) / 100
								: attainment(def, valor),
					puntos: p,
					puesto: null,
					de: 0,
				};
			}
			if (constanciaDef) {
				const valor = opts.constancia?.[vendedor.id] ?? null;
				const att = valor === null ? null : attainment(constanciaDef, valor);
				kpis[CONSTANCIA_ID] = {
					...vacio(CONSTANCIA_ID),
					valor,
					attainment: att,
					puntos: att === null ? null : puntos(att),
				};
			}
			return { vendedor, kpis };
		});

	for (const def of constanciaDef ? [...guardadas, constanciaDef] : guardadas) {
		const k = def.id;
		const entries = rows.flatMap((r) => {
			const valor = r.kpis[k].valor;
			return valor === null
				? []
				: [
						{
							id: r.vendedor.id,
							valor,
							den: dens.get(`${r.vendedor.id}|${k}`) ?? 0,
							kpi: r.kpis[k],
						},
					];
		});
		for (const r of rank(entries, cmpKpi(def.direccion)))
			r.item.kpi.puesto = r.puesto;
		for (const r of rows) r.kpis[k].de = entries.length;
	}

	const base: ScoredVendedor[] = rows.map(({ vendedor, kpis }) => ({
		vendedor,
		periodoId,
		vista,
		score: null,
		tier: null,
		puesto: null,
		de: 0,
		puestoSucursal: null,
		deSucursal: 0,
		kpis,
	}));
	return {
		periodoId,
		vista,
		...rankProvincias(finalize(base, dataset.sucursales, efectivo(opts.defs))),
	};
}
