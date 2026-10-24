// Shared domain contract. Every module (scoring, generator, csv, db, modes, UI,
// Remotion) imports from here and never redefines these shapes.
// Values: every KPI is stored as {num, den}; valor = num/den; acumulado = Σnum/Σden.

export const KPI_IDS = [
	"venta",
	"prod",
	"no_comp",
	"lanz",
	"no_entr",
	"cobr",
	"relev",
] as const;
export type KpiId = (typeof KPI_IDS)[number];

export type Direccion = "mayor" | "menor";

export type KpiDef = {
	id: KpiId;
	nombre: string;
	/** Card label, as printed on the PDF cards (VTA/OV, PROD, ...). */
	corto: string;
	/** Weight in [0,1]; all seven sum to 1. */
	peso: number;
	/** Target expressed in the same unit as valor (ratio, so 1.00 = 100%). */
	objetivo: number;
	direccion: Direccion;
	/** What num/den mean, for the "Supuestos" page and CSV docs. */
	num: string;
	den: string;
};

/** Attainment cap: 110% of target scores 100 points. */
export const TOPE = 1.1;

export const KPI_DEFS: Record<KpiId, KpiDef> = {
	venta: {
		id: "venta",
		nombre: "Venta vs objetivo",
		corto: "VTA/OV",
		peso: 0.3,
		objetivo: 1,
		direccion: "mayor",
		num: "kilos vendidos",
		den: "kilos objetivo (OV)",
	},
	prod: {
		id: "prod",
		nombre: "Productividad",
		corto: "PROD",
		peso: 0.1,
		objetivo: 0.7,
		direccion: "mayor",
		num: "pedidos levantados",
		den: "visitas realizadas",
	},
	no_comp: {
		id: "no_comp",
		nombre: "Clientes no compradores",
		corto: "NO COMP",
		peso: 0.15,
		objetivo: 0.1,
		direccion: "menor",
		num: "clientes activos que no compraron",
		den: "clientes activos",
	},
	lanz: {
		id: "lanz",
		nombre: "Últimos lanzamientos",
		corto: "LANZ",
		peso: 0.15,
		objetivo: 0.75,
		direccion: "mayor",
		num: "clientes activos que compraron lanzamientos",
		den: "clientes activos",
	},
	no_entr: {
		id: "no_entr",
		nombre: "Pedidos no entregados",
		corto: "NO ENTR",
		peso: 0.1,
		objetivo: 0.02,
		direccion: "menor",
		num: "pedidos no entregados",
		den: "pedidos",
	},
	cobr: {
		id: "cobr",
		nombre: "Cobranzas",
		corto: "COBR",
		peso: 0.15,
		objetivo: 0.9,
		direccion: "mayor",
		num: "facturas cobradas en plazo",
		den: "facturas vencidas",
	},
	relev: {
		id: "relev",
		nombre: "Relevamientos",
		corto: "RELEV",
		peso: 0.05,
		objetivo: 0.95,
		direccion: "mayor",
		num: "encuestas hechas",
		den: "encuestas asignadas",
	},
};

/** Tie-break order between KPIs: by weight desc, then PDF order. */
export const KPI_TIE_ORDER: readonly KpiId[] = [
	"venta",
	"no_comp",
	"lanz",
	"cobr",
	"prod",
	"no_entr",
	"relev",
];

export type Tier = "verde" | "amarillo" | "rojo";
/** score >= verde → verde; >= amarillo → amarillo; else rojo. */
export const TIER_MIN: Record<Exclude<Tier, "rojo">, number> = {
	verde: 80,
	amarillo: 65,
};
export const TIER_LABEL: Record<Tier, string> = {
	verde: "Arriba",
	amarillo: "En carrera",
	rojo: "Abajo",
};
export function tierOf(score: number | null): Tier | null {
	if (score === null) return null;
	if (score >= TIER_MIN.verde) return "verde";
	if (score >= TIER_MIN.amarillo) return "amarillo";
	return "rojo";
}

export type Region = "AMBA" | "Interior";
export type Canal = "plaza" | "campaña";
export const CANALES: readonly Canal[] = ["plaza", "campaña"];

export type Sucursal = {
	slug: string;
	nombre: string;
	region: Region;
	/** Derby partner (symmetric). */
	vecina: string;
	/**
	 * v2: province slug (see PROVINCIAS). Always set on SUCURSALES; optional only so
	 * hand-built test sucursales still type-check. Read it with provinciaDe(slug).
	 */
	provincia?: string;
};

// ---------- v2: geography ----------

export type Provincia = { slug: string; nombre: string };

export const PROVINCIAS: readonly Provincia[] = [
	{ slug: "caba", nombre: "Ciudad de Buenos Aires" },
	{ slug: "buenos-aires", nombre: "Buenos Aires" },
	{ slug: "santa-fe", nombre: "Santa Fe" },
	{ slug: "entre-rios", nombre: "Entre Ríos" },
	{ slug: "corrientes", nombre: "Corrientes" },
	{ slug: "cordoba", nombre: "Córdoba" },
	{ slug: "mendoza", nombre: "Mendoza" },
	{ slug: "tucuman", nombre: "Tucumán" },
	{ slug: "salta", nombre: "Salta" },
	{ slug: "neuquen", nombre: "Neuquén" },
];
export const PROVINCIA_BY_SLUG: Record<string, Provincia> = Object.fromEntries(
	PROVINCIAS.map((p) => [p.slug, p]),
);

/** sucursal slug -> provincia slug. */
export const PROVINCIA_DE_SUCURSAL: Record<string, string> = {
	caba: "caba",
	"san-martin": "buenos-aires",
	moron: "buenos-aires",
	quilmes: "buenos-aires",
	junin: "buenos-aires",
	"bahia-blanca": "buenos-aires",
	"mar-del-plata": "buenos-aires",
	rosario: "santa-fe",
	"santa-fe": "santa-fe",
	parana: "entre-rios",
	corrientes: "corrientes",
	cordoba: "cordoba",
	mendoza: "mendoza",
	tucuman: "tucuman",
	salta: "salta",
	neuquen: "neuquen",
};

/** Province slug of a sucursal; null for an unknown slug. */
export function provinciaDe(sucursalSlug: string): string | null {
	return PROVINCIA_DE_SUCURSAL[sucursalSlug] ?? null;
}

export const SUCURSALES: readonly Sucursal[] = (
	[
		{ slug: "caba", nombre: "CABA", region: "AMBA", vecina: "san-martin" },
		{
			slug: "san-martin",
			nombre: "San Martín",
			region: "AMBA",
			vecina: "caba",
		},
		{ slug: "moron", nombre: "Morón", region: "AMBA", vecina: "quilmes" },
		{ slug: "quilmes", nombre: "Quilmes", region: "AMBA", vecina: "moron" },
		{
			slug: "rosario",
			nombre: "Rosario",
			region: "Interior",
			vecina: "santa-fe",
		},
		{
			slug: "santa-fe",
			nombre: "Santa Fe",
			region: "Interior",
			vecina: "rosario",
		},
		{
			slug: "parana",
			nombre: "Paraná",
			region: "Interior",
			vecina: "corrientes",
		},
		{
			slug: "corrientes",
			nombre: "Corrientes",
			region: "Interior",
			vecina: "parana",
		},
		{
			slug: "cordoba",
			nombre: "Córdoba",
			region: "Interior",
			vecina: "mendoza",
		},
		{
			slug: "mendoza",
			nombre: "Mendoza",
			region: "Interior",
			vecina: "cordoba",
		},
		{ slug: "tucuman", nombre: "Tucumán", region: "Interior", vecina: "salta" },
		{ slug: "salta", nombre: "Salta", region: "Interior", vecina: "tucuman" },
		{
			slug: "neuquen",
			nombre: "Neuquén",
			region: "Interior",
			vecina: "bahia-blanca",
		},
		{
			slug: "bahia-blanca",
			nombre: "Bahía Blanca",
			region: "Interior",
			vecina: "neuquen",
		},
		{
			slug: "mar-del-plata",
			nombre: "Mar del Plata",
			region: "Interior",
			vecina: "junin",
		},
		{
			slug: "junin",
			nombre: "Junín",
			region: "Interior",
			vecina: "mar-del-plata",
		},
	] satisfies Sucursal[]
).map((s) => ({ ...s, provincia: PROVINCIA_DE_SUCURSAL[s.slug] }));
export const SUCURSAL_BY_SLUG: Record<string, Sucursal> = Object.fromEntries(
	SUCURSALES.map((s) => [s.slug, s]),
);

// ---------- v2: time ----------

/**
 * Demo "today" (a Saturday). Pure constant, safe on client and server. Code that
 * decides "today" never calls new Date(); server code calls hoy() instead.
 */
export const HOY = "2026-10-24";
/** First day with daily data. */
export const FECHA_INICIO = "2025-10-01";

/**
 * Server only: DEMO_HOY (YYYY-MM-DD) overrides HOY. In the browser process.env.DEMO_HOY
 * is not inlined (no NEXT_PUBLIC_ prefix), so the client always gets HOY.
 */
export function hoy(): string {
	const o = typeof process === "undefined" ? undefined : process.env.DEMO_HOY;
	return o && /^\d{4}-\d{2}-\d{2}$/.test(o) ? o : HOY;
}

/** "YYYY-MM" of a "YYYY-MM-DD" date. */
export const periodoDe = (fecha: string): string => fecha.slice(0, 7);

/** Season: "YYYY-MM" ids, 2025-10 … 2026-10. Sorting the ids sorts the season. */
export type Periodo = {
	id: string;
	/** "Oct 25" */
	label: string;
	/** Weight of the month in the mes/acum blend; acum gets 1 - pesoMes. */
	pesoMes: number;
	/**
	 * v2: the month in progress (true for periodoDe(HOY) in PERIODOS). Closed months
	 * have false or undefined. The DB column periodos.en_curso is the live value
	 * ("Simular cierre de mes" sets it to false).
	 */
	enCurso?: boolean;
};
export const SEASON_START = "2025-10";
const MESES = [
	"Ene",
	"Feb",
	"Mar",
	"Abr",
	"May",
	"Jun",
	"Jul",
	"Ago",
	"Sep",
	"Oct",
	"Nov",
	"Dic",
];
export const PERIODOS: readonly Periodo[] = Array.from(
	{ length: 13 },
	(_, i) => {
		const d = new Date(Date.UTC(2025, 9 + i, 1));
		const id = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
		const label = `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
		return { id, label, pesoMes: 0.5, enCurso: id === periodoDe(HOY) };
	},
);

/** Closed periods (enCurso not true), ascending. Rankings and games read only these. */
export function periodosCerrados(
	periodos: readonly Periodo[] = PERIODOS,
): Periodo[] {
	return periodos.filter((p) => !p.enCurso);
}

/** Latest closed period id (default view of rankings and games); null when none. */
export function ultimoPeriodoCerrado(
	periodos: readonly Periodo[] = PERIODOS,
): string | null {
	return periodosCerrados(periodos).at(-1)?.id ?? null;
}

/** The month in progress, or null when every period is closed. */
export function periodoEnCurso(
	periodos: readonly Periodo[] = PERIODOS,
): Periodo | null {
	return periodos.find((p) => p.enCurso) ?? null;
}
export const PERIODO_BY_ID: Record<string, Periodo> = Object.fromEntries(
	PERIODOS.map((p) => [p.id, p]),
);

export type Vendedor = {
	/** "V001" … stable across reseeds. */
	id: string;
	nombre: string;
	apellido: string;
	sucursal: string;
	canal: Canal;
	/** First period with data ("YYYY-MM"). Mid-season hires have a later alta. */
	altaPeriodo: string;
};

export type KpiResultado = {
	vendedorId: string;
	periodoId: string;
	/** v2: any MetricaId (custom metrics included). v1 rows only carry the seven KPI_IDS. */
	kpi: MetricaId;
	num: number;
	den: number;
};

export type Dataset = {
	sucursales: readonly Sucursal[];
	vendedores: Vendedor[];
	periodos: readonly Periodo[];
	defs: Record<KpiId, KpiDef>;
	resultados: KpiResultado[];
	/**
	 * v2: every metric definition (base, derivada, custom), active or not, by orden.
	 * When absent, consumers use metricasDe(defs). defs stays in sync for the seven base KPIs.
	 */
	metricas?: readonly MetricaDef[];
};

export type Vista = "mes" | "acum" | "mix";
export const VISTAS: readonly Vista[] = ["mes", "acum", "mix"];

/** Output of scoring. Consumed by UI, Remotion and the game modes. */
export type KpiScore = {
	/** v2: MetricaId; v1 scoring only emits the seven KPI_IDS. */
	kpi: MetricaId;
	/** num/den for the chosen vista; null when den <= 0 or no data. */
	valor: number | null;
	/** Clamped to [0, TOPE]; null when valor is null. */
	attainment: number | null;
	/** 0..100; null when valor is null. */
	puntos: number | null;
	/** 1-based rank among vendedores with a non-null valor in this period; null if valor null. */
	puesto: number | null;
	/** How many vendedores had a value (the "/ N" of the rank). */
	de: number;
};

export type ScoredVendedor = {
	vendedor: Vendedor;
	periodoId: string;
	vista: Vista;
	/** Weighted card score 0..100, renormalised over non-null KPIs; null if < 50% of weight available. */
	score: number | null;
	tier: Tier | null;
	puesto: number | null;
	de: number;
	puestoSucursal: number | null;
	deSucursal: number;
	/** v2: rank inside the seller's province. Always set by the v2 scorer; optional for v1 fixtures. */
	puestoProvincia?: number | null;
	deProvincia?: number;
	/**
	 * Keyed by MetricaId. Always holds the seven KPI_IDS (an inactive base metric has null
	 * valor/puntos/puesto), so v1 UI that loops KPI_IDS keeps working. Active custom
	 * metrics and constancia are extra keys.
	 */
	kpis: Record<MetricaId, KpiScore>;
};

export type ScoredSucursal = {
	sucursal: Sucursal;
	/** Mean of member scores (non-null members only); null if no members scored. */
	score: number | null;
	tier: Tier | null;
	puesto: number | null;
	miembros: number;
	/** v2: rank among sucursales of the same province. Always set by the v2 scorer. */
	puestoProvincia?: number | null;
};

/** v2: a province ranked nationally; score = mean of member seller scores. */
export type ScoredProvincia = {
	provincia: Provincia;
	/** Mean of member seller scores (non-null only); null when none scored. */
	score: number | null;
	tier: Tier | null;
	/** National rank among provinces with a score (cmpSucursal tie rules on slug). */
	puesto: number | null;
	/** Scored sellers. */
	miembros: number;
	/** Sucursales in the province. */
	sucursales: number;
};

export type ScoredPeriod = {
	periodoId: string;
	vista: Vista;
	vendedores: ScoredVendedor[];
	sucursales: ScoredSucursal[];
	/** v2: always set by the v2 scorer. */
	provincias?: ScoredProvincia[];
};

/** CSV import/export: long format, one row per vendedor × periodo × kpi. */
export const CSV_COLUMNS = [
	"vendedor",
	"nombre",
	"apellido",
	"sucursal",
	"canal",
	"alta",
	"periodo",
	"kpi",
	"num",
	"den",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

// ---------- v2: metrics (was: KPIs) ----------

/** v2 metric key. The seven KPI_IDS keep their ids; custom metrics add more. */
export type MetricaId = string;
export type TipoMetrica = "base" | "derivada" | "custom";
/**
 * flujo: daily rows are that day's amounts, a window sums num and den.
 * stock: daily rows are month-to-date snapshots, a month is its last day's row, no weekly value.
 * derivada: computed, never stored.
 */
export type Acumulacion = "flujo" | "stock" | "derivada";

export type MetricaDef = Omit<KpiDef, "id"> & {
	id: MetricaId;
	tipo: TipoMetrica;
	/** Inactive metrics score nothing and show only in admin. */
	activa: boolean;
	/** Display order, ascending. */
	orden: number;
	acumulacion: Acumulacion;
	/** Suggestion template with {n}, es-AR voseo; "" when not actionable (derivada). */
	accion: string;
	/** Short unit of the numerator for display ("kg", "clientes"); "" when none. */
	unidad: string;
};

export const CONSTANCIA_ID: MetricaId = "constancia";
/** Template for custom metrics without their own accion; {num} is the def's num text. */
export const ACCION_CUSTOM_DEFAULT = "Sumá {n} {num}";

const BASE_EXTRA: Record<
	KpiId,
	Pick<MetricaDef, "acumulacion" | "accion" | "unidad">
> = {
	venta: { acumulacion: "flujo", accion: "Vendé {n} kg más", unidad: "kg" },
	prod: {
		acumulacion: "flujo",
		accion: "Cerrá {n} pedidos más en tus visitas",
		unidad: "pedidos",
	},
	no_comp: {
		acumulacion: "stock",
		accion: "Conseguí que {n} clientes más compren",
		unidad: "clientes",
	},
	lanz: {
		acumulacion: "stock",
		accion: "Vendé lanzamientos a {n} clientes más",
		unidad: "clientes",
	},
	no_entr: {
		acumulacion: "flujo",
		accion: "Evitá {n} pedidos sin entregar",
		unidad: "pedidos",
	},
	cobr: {
		acumulacion: "flujo",
		accion: "Cobrá {n} facturas vencidas",
		unidad: "facturas",
	},
	relev: {
		acumulacion: "flujo",
		accion: "Completá {n} encuestas",
		unidad: "encuestas",
	},
};

/** The seven base metrics built from v1 KpiDefs (v1 compat: no constancia, no custom). */
export function metricasDe(defs: Record<KpiId, KpiDef>): MetricaDef[] {
	return KPI_IDS.map((k, orden) => ({
		...defs[k],
		tipo: "base",
		activa: true,
		orden,
		...BASE_EXTRA[k],
	}));
}

/** Seed defaults: 7 base (PDF weights, sum 1.00) + constancia (active) + degus (custom, inactive). */
export const METRICAS_DEFAULT: readonly MetricaDef[] = [
	...metricasDe(KPI_DEFS),
	{
		id: CONSTANCIA_ID,
		nombre: "Constancia",
		corto: "CONST",
		peso: 0.1,
		objetivo: 0.8,
		direccion: "mayor",
		num: "1 - min(1, cv / 0,5) de la venta en ventanas móviles de 30 días",
		den: "sin denominador, se calcula",
		tipo: "derivada",
		activa: true,
		orden: 7,
		acumulacion: "derivada",
		accion: "",
		unidad: "",
	},
	{
		id: "degus",
		nombre: "Degustaciones",
		corto: "DEGUS",
		peso: 0.05,
		objetivo: 0.9,
		direccion: "mayor",
		num: "degustaciones hechas",
		den: "degustaciones programadas",
		tipo: "custom",
		activa: false,
		orden: 8,
		acumulacion: "flujo",
		accion: "Hacé {n} degustaciones más",
		unidad: "degustaciones",
	},
];

/** Effective weight per active metric: peso / Σ peso of active metrics. Inactive ids are absent; {} when Σ <= 0. */
export function efectivo(
	defs: readonly MetricaDef[],
): Record<MetricaId, number> {
	const activas = defs.filter((d) => d.activa && d.peso > 0);
	const total = activas.reduce((t, d) => t + d.peso, 0);
	return total > 0
		? Object.fromEntries(activas.map((d) => [d.id, d.peso / total]))
		: {};
}

/** One daily row (table kpi_diarios). fecha "YYYY-MM-DD", working days only. */
export type KpiDiario = {
	vendedorId: string;
	fecha: string;
	kpi: MetricaId;
	num: number;
	den: number;
};

/** Row of planes: the full-month plan den of a metric (venta: the OV), known before the month ends. */
export type Plan = {
	vendedorId: string;
	periodoId: string;
	kpi: MetricaId;
	den: number;
};

/** Row of constancias: Constancia at the period's reference date (null with too few points). */
export type ConstanciaFila = {
	vendedorId: string;
	periodoId: string;
	/** Reference date it was computed at; null for a month in progress without data. */
	fecha: string | null;
	valor: number | null;
};

// ---------- v2: games ----------

export const JUEGOS = ["liga", "revelacion", "album"] as const;
export type JuegoId = (typeof JUEGOS)[number];
export const JUEGO_LABEL: Record<JuegoId, string> = {
	liga: "Liga anual",
	revelacion: "Revelación del mes",
	album: "Álbum de figuritas",
};

/** Row of juegos_sucursal: the game runs in the sucursal from desde to hasta (months, inclusive). */
export type JuegoIntervalo = {
	juego: JuegoId;
	sucursal: string;
	/** "YYYY-MM" */
	desde: string;
	/** "YYYY-MM", inclusive; null = still running. */
	hasta: string | null;
};

export type JuegosConfig = {
	/** Global switch (table juegos.activo). */
	global: Record<JuegoId, boolean>;
	intervalos: JuegoIntervalo[];
};

/** Table ajustes (clave -> valor). Keys match the DB clave column. */
export type Ajustes = {
	/** Goal score of the tracker ("Arriba" tier). */
	meta_puntos: number;
	/** Gross margin per kg in ARS, for prize value. */
	valor_kg_ars: number;
};
export const AJUSTES_DEFAULT: Ajustes = { meta_puntos: 80, valor_kg_ars: 1800 };

export type FuenteEngagement = "real" | "simulado";
/** vista: opened the game screen; interaccion: any action inside it; reclamo: claimed a figu or prize. */
export const EVENTOS_ENGAGEMENT = ["vista", "interaccion", "reclamo"] as const;
export type EventoEngagement = (typeof EVENTOS_ENGAGEMENT)[number];

/** Row of engagement. Real: one row per day (upsert, cantidad +1). Simulado: weekly totals, fecha = Monday. */
export type EngagementRow = {
	fecha: string;
	vendedorId: string;
	juego: JuegoId;
	evento: EventoEngagement;
	cantidad: number;
	fuente: FuenteEngagement;
};

/** Row of premios. */
export type Premio = {
	id: string;
	juego: JuegoId;
	periodoId: string;
	descripcion: string;
	costoArs: number;
	/** Seeded demo prize; the UI labels it. */
	simulado: boolean;
};

/** Everything the v2 generator produces; replaceDataset v2 writes all of it. */
export type GeneratedV2 = {
	dataset: Dataset & { metricas: readonly MetricaDef[] };
	/** Daily rows; dataset.resultados (kpi_resultados) is their monthly aggregate. */
	diarios: KpiDiario[];
	/** venta's full-month OV for every month with data (the month in progress included). */
	planes: Plan[];
	juegos: JuegosConfig;
	engagement: EngagementRow[];
	premios: Premio[];
	ajustes: Ajustes;
};

// ---------- v2: goal tracker ----------

export type Ventana = "mes" | "semana";

export type TrackerMetrica = {
	metrica: MetricaId;
	/** Current num/den over the elapsed days (stock: current snapshot); null without den. */
	valor: number | null;
	/** valor at the current pace at window end (SPEC-V2 pace projection). */
	valorProyectado: number | null;
	/** Points of the current valor. */
	puntos: number | null;
	objetivo: number;
	/** Attainment of the projected valor >= 1. */
	alcanzado: boolean;
	/** Whole numerator units still needed on the projected window; 0 when alcanzado; null when not actionable. */
	faltanUnidades: number | null;
};

export type Sugerencia = {
	metrica: MetricaId;
	/** Units of numerator change (the {n} of accion). */
	n: number;
	/** accion with {n} filled, es-AR thousands separator. */
	texto: string;
	/** Effective weight × (points at objetivo − current points). */
	ganancia: number;
	/** n / den. */
	esfuerzo: number;
	/** true when faltan = 0 and the suggestion is phrased as a figu to win. */
	figu: boolean;
};

export type Tracker = {
	vendedorId: string;
	ventana: Ventana;
	/** Window, inclusive "YYYY-MM-DD". */
	desde: string;
	hasta: string;
	/** Reference date (hoy() for the window in progress). */
	ref: string;
	diasHabiles: number;
	diasTranscurridos: number;
	/** Card score over the elapsed days; null with too little data. */
	score: number | null;
	/** ajustes.meta_puntos */
	meta: number;
	/** max(0, meta − score), one decimal; meta when score is null. */
	faltan: number;
	/**
	 * Score at window end. flujo num = so far + pace of the last 14 working days (or all
	 * elapsed) x days left; den = the stored plan (planes), else scaled by elapsed share.
	 */
	proyeccion: number | null;
	/** Active metrics of the window (weekly: flujo only), by orden. */
	metricas: TrackerMetrica[];
	/** At most 3. */
	sugerencias: Sugerencia[];
	/** faltan > 0 and the suggestions (the best three anyway) do not close it. */
	inalcanzable: boolean;
	/** Below objetivo, but the needed n does not fit in the remaining working days: never suggested. */
	descartadas: MetricaId[];
	/** Plain note for the UI when the weekly gap cannot be closed (no suggestion fits); else null. */
	mensaje: string | null;
};

// ---------- v2: figus from goals ----------

/** Same unions as src/lib/modes/types.ts (v1 Figu). */
export type Rareza = "legendaria" | "epica" | "rara" | "comun";
export type Medalla = "oro" | "plata" | "bronce";

/** A metric met in a closed month: (seller, month, active metric incl. constancia) with attainment >= 1. */
export type FiguV2 = {
	vendedorId: string;
	periodoId: string;
	metrica: MetricaId;
	valor: number;
	attainment: number;
	puntos: number;
	/** Share of sellers with data that month who met the metric. */
	p: number;
	/** Quantile of p over all season cells: hardest 5 % legendaria, next 20 % epica, next 35 % rara, rest comun. */
	rareza: Rareza;
	/** Met the same metric this month and the two closed months before it. */
	holografica: boolean;
	/** Foil edition: national top 3 by points among those who met it (v1 tie rules). */
	medalla?: Medalla;
};
