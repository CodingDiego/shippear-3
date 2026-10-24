// Output shapes of the three game modes. Every mode is a pure function of
// (periods: ScoredPeriod[] with vista "mes", ascending periodoId; dataset: Dataset).
import type { Canal, FiguV2, KpiId, MetricaId } from "@/lib/domain";

// ---------- Liga anual / Balón de Oro ----------

/** One row of the annual league. */
export type LigaVendedor = {
	vendedorId: string;
	sucursal: string;
	canal: Canal;
	/** Mean of the monthly scores the vendedor has; null when meses = 0. */
	promedio: number | null;
	/** Months with a non-null score. */
	meses: number;
	/** Median of the monthly scores (mean of the two middle ones when even); null when meses = 0. */
	mediana: number | null;
	/** Best monthly score; null when meses = 0. */
	mejorMes: number | null;
	/**
	 * Months the vendedor needs: max(9, ceil(0.75 · mesesDesdeAlta)), where
	 * mesesDesdeAlta counts the played periods from altaPeriodo (inclusive) to the
	 * last period. A vendedor whose alta is before the first period counts from it.
	 */
	mesesRequeridos: number;
	/** meses >= mesesRequeridos. */
	elegible: boolean;
	/** 1-based rank among eligibles; null when not eligible. */
	puesto: number | null;
};

/** A sucursal in the league, built only from its eligible members. */
export type LigaSucursal = {
	slug: string;
	/** Mean of the eligible members' promedios; null when it has none. */
	promedio: number | null;
	/** Eligible members. */
	miembros: number;
	/** miembros >= 3. */
	elegible: boolean;
	/** 1-based rank among eligible sucursales; null when not eligible. */
	puesto: number | null;
};

/** Best mean KPI puntos among eligible vendedores. */
export type BotinKpi = {
	vendedorId: string;
	/** Mean of the vendedor's non-null monthly puntos in that KPI. */
	promedioPuntos: number;
};

export type Liga = {
	/** Eligibles first (by puesto), then ineligibles in the same sort order. */
	vendedores: LigaVendedor[];
	/** Eligibles first (by puesto), then ineligibles. */
	sucursales: LigaSucursal[];
	/** null for a KPI when no eligible vendedor has puntos in it. */
	botin: Record<KpiId, BotinKpi | null>;
};

// ---------- Revelación del mes ----------

/** Score change between the previous and the last period. */
export type RevelacionAbsoluta = {
	vendedorId: string;
	anterior: number;
	actual: number;
	/** actual - anterior. */
	delta: number;
};

/** delta / (100 - anterior); only delta > 0 and anterior < 99.5. */
export type RevelacionRelativa = RevelacionAbsoluta & { relativa: number };

/** Streak of consecutive positive deltas ending at the last period. */
export type RevelacionRacha = {
	vendedorId: string;
	/** Number of consecutive deltas > 0 (>= 3). Needs racha + 1 scored months in a row. */
	racha: number;
	/** Score now minus score at the start of the streak. */
	ganancia: number;
	actual: number;
};

/** Climb from the worst earlier general puesto to the current one. */
export type RevelacionRemontada = {
	vendedorId: string;
	/** Worst (largest) general puesto in an earlier period. */
	peorPuesto: number;
	/** Period where peorPuesto happened (the first one on ties). */
	peorPeriodoId: string;
	puestoActual: number;
	/** peorPuesto - puestoActual (> 0). */
	remontada: number;
	/** Months with a non-null score, up to and including the last period (>= 6). */
	meses: number;
};

export type Revelacion = {
	/** The last period, or null when there are no periods. */
	periodoId: string | null;
	/** Every vendedor scored in both months, delta desc. */
	absoluta: RevelacionAbsoluta[];
	/** relativa desc. */
	relativa: RevelacionRelativa[];
	/** racha desc, then ganancia desc. */
	racha: RevelacionRacha[];
	/** remontada desc, then puestoActual asc. */
	remontada: RevelacionRemontada[];
};

// ---------- Álbum de figuritas ----------

export type Medalla = "oro" | "plata" | "bronce";
export type Ambito = "nacional" | "sucursal";
export type Rareza = "legendaria" | "epica" | "rara" | "comun";

/**
 * One sticker (v2): a metric's objetivo met in a closed month (see FiguV2). The v1 field
 * names stay: kpi = metrica (constancia and custom metrics included), ambito is always
 * "nacional" (goals are national), medalla only on the national top 3 (foil edition).
 */
export type Figu = FiguV2 & {
	kpi: MetricaId;
	ambito: Ambito;
};

export type AlbumVendedor = {
	/**
	 * grid[metrica][periodoId]: only periods where the vendedor has a figu in that metric;
	 * read missing as []. Always holds the seven KPI_IDS keys, plus any other metric with figus.
	 */
	grid: Record<MetricaId, Record<string, Figu[]>>;
	/** Of the seven KPI_IDS, those with at least one figu / 7, in [0, 1]. */
	completado: number;
	/** Metrics (constancia and custom included) with at least one figu. */
	metricasConFigu: number;
	/** Figus the vendedor owns. */
	total: number;
};
