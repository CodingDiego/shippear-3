import {
	boolean,
	date,
	doublePrecision,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { EVENTOS_ENGAGEMENT, JUEGOS } from "@/lib/domain";

export const sucursales = pgTable("sucursales", {
	slug: text("slug").primaryKey(),
	nombre: text("nombre").notNull(),
	region: text("region").notNull(),
	vecina: text("vecina").notNull(),
	// v2: province slug (PROVINCIAS); written by replaceDataset from SUCURSALES.
	provincia: text("provincia").notNull().default(""),
});

export const vendedores = pgTable("vendedores", {
	id: text("id").primaryKey(),
	nombre: text("nombre").notNull(),
	apellido: text("apellido").notNull(),
	sucursal: text("sucursal")
		.notNull()
		.references(() => sucursales.slug),
	canal: text("canal").notNull(),
	altaPeriodo: text("alta_periodo").notNull(),
});

export const periodos = pgTable("periodos", {
	id: text("id").primaryKey(),
	label: text("label").notNull(),
	pesoMes: doublePrecision("peso_mes").notNull(),
	// v2: month in progress; "Simular cierre de mes" sets it to false.
	enCurso: boolean("en_curso").notNull().default(false),
});

export const kpiDefiniciones = pgTable("kpi_definiciones", {
	kpi: text("kpi").primaryKey(),
	nombre: text("nombre").notNull(),
	corto: text("corto").notNull(),
	peso: doublePrecision("peso").notNull(),
	objetivo: doublePrecision("objetivo").notNull(),
	direccion: text("direccion").notNull(),
	num: text("num").notNull(),
	den: text("den").notNull(),
	// v2 (defaults so drizzle-kit push needs no prompt on existing rows)
	tipo: text("tipo", { enum: ["base", "derivada", "custom"] })
		.notNull()
		.default("base"),
	activa: boolean("activa").notNull().default(true),
	orden: integer("orden").notNull().default(0),
	acumulacion: text("acumulacion", { enum: ["flujo", "stock", "derivada"] })
		.notNull()
		.default("flujo"),
	accion: text("accion").notNull().default(""),
	unidad: text("unidad").notNull().default(""),
});

export const kpiResultados = pgTable(
	"kpi_resultados",
	{
		vendedorId: text("vendedor_id")
			.notNull()
			.references(() => vendedores.id, { onDelete: "cascade" }),
		periodoId: text("periodo_id")
			.notNull()
			.references(() => periodos.id),
		kpi: text("kpi").notNull(),
		num: doublePrecision("num").notNull(),
		den: doublePrecision("den").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.vendedorId, t.periodoId, t.kpi] }),
		index("kpi_resultados_periodo_idx").on(t.periodoId),
		index("kpi_resultados_vendedor_idx").on(t.vendedorId),
	],
);

export const datasetMeta = pgTable("dataset_meta", {
	id: text("id").primaryKey().default("singleton"),
	seed: integer("seed"),
	source: text("source", { enum: ["generator", "csv"] }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// ---------- v2 ----------

/** Daily rows. flujo: that day's amounts; stock: month-to-date snapshot. Sundays have no rows. */
export const kpiDiarios = pgTable(
	"kpi_diarios",
	{
		vendedorId: text("vendedor_id")
			.notNull()
			.references(() => vendedores.id, { onDelete: "cascade" }),
		fecha: date("fecha", { mode: "string" }).notNull(),
		kpi: text("kpi").notNull(),
		num: doublePrecision("num").notNull(),
		den: doublePrecision("den").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.vendedorId, t.fecha, t.kpi] }),
		index("kpi_diarios_fecha_idx").on(t.fecha),
		index("kpi_diarios_vendedor_kpi_fecha_idx").on(
			t.vendedorId,
			t.kpi,
			t.fecha,
		),
	],
);

/** Global switch per game (JUEGOS). */
export const juegos = pgTable("juegos", {
	id: text("id", {
		enum: JUEGOS,
	}).primaryKey(),
	nombre: text("nombre").notNull(),
	activo: boolean("activo").notNull().default(true),
});

/** Activation intervals by month ("YYYY-MM", hasta inclusive, null = running). */
export const juegosSucursal = pgTable(
	"juegos_sucursal",
	{
		juego: text("juego", { enum: JUEGOS })
			.notNull()
			.references(() => juegos.id, { onDelete: "cascade" }),
		sucursal: text("sucursal")
			.notNull()
			.references(() => sucursales.slug, { onDelete: "cascade" }),
		desde: text("desde").notNull(),
		hasta: text("hasta"),
	},
	(t) => [
		primaryKey({ columns: [t.juego, t.sucursal, t.desde] }),
		index("juegos_sucursal_sucursal_idx").on(t.sucursal),
	],
);

/** Real: daily upsert, cantidad +1. Simulado: weekly totals, fecha = Monday. */
export const engagement = pgTable(
	"engagement",
	{
		fecha: date("fecha", { mode: "string" }).notNull(),
		vendedorId: text("vendedor_id")
			.notNull()
			.references(() => vendedores.id, { onDelete: "cascade" }),
		juego: text("juego", {
			enum: JUEGOS,
		}).notNull(),
		evento: text("evento", { enum: EVENTOS_ENGAGEMENT }).notNull(),
		cantidad: integer("cantidad").notNull().default(0),
		fuente: text("fuente", { enum: ["real", "simulado"] }).notNull(),
	},
	(t) => [
		primaryKey({
			columns: [t.fecha, t.vendedorId, t.juego, t.evento, t.fuente],
		}),
		index("engagement_juego_fecha_idx").on(t.juego, t.fecha),
	],
);

/** No FK to periodos, so replaceDataset can rewrite periodos without touching prizes. */
export const premios = pgTable(
	"premios",
	{
		id: text("id").primaryKey(),
		juego: text("juego", {
			enum: JUEGOS,
		}).notNull(),
		periodoId: text("periodo_id").notNull(),
		descripcion: text("descripcion").notNull(),
		costoArs: doublePrecision("costo_ars").notNull(),
		simulado: boolean("simulado").notNull().default(false),
	},
	(t) => [index("premios_juego_idx").on(t.juego, t.periodoId)],
);

/** Settings: meta_puntos (80), valor_kg_ars (1800). */
export const ajustes = pgTable("ajustes", {
	clave: text("clave").primaryKey(),
	valor: doublePrecision("valor").notNull(),
});

/** Full-month plan den (venta: the OV), so the tracker knows the whole window's plan. */
export const planes = pgTable(
	"planes",
	{
		vendedorId: text("vendedor_id")
			.notNull()
			.references(() => vendedores.id, { onDelete: "cascade" }),
		periodoId: text("periodo_id").notNull(),
		kpi: text("kpi").notNull(),
		den: doublePrecision("den").notNull(),
	},
	(t) => [primaryKey({ columns: [t.vendedorId, t.periodoId, t.kpi] })],
);

/** Constancia materialised when data is written (seed, CSV import, cierre); null = too few points. */
export const constancias = pgTable(
	"constancias",
	{
		vendedorId: text("vendedor_id")
			.notNull()
			.references(() => vendedores.id, { onDelete: "cascade" }),
		periodoId: text("periodo_id").notNull(),
		/** Reference date (month end when closed, last day with data in progress). */
		fecha: date("fecha", { mode: "string" }),
		valor: doublePrecision("valor"),
	},
	(t) => [
		primaryKey({ columns: [t.vendedorId, t.periodoId] }),
		index("constancias_periodo_idx").on(t.periodoId),
	],
);

/** A seller's claim of a figu (ref "periodoId:metrica") or a prize (ref = premios.id). */
export const reclamos = pgTable(
	"reclamos",
	{
		vendedorId: text("vendedor_id")
			.notNull()
			.references(() => vendedores.id, { onDelete: "cascade" }),
		tipo: text("tipo", { enum: ["figu", "premio"] }).notNull(),
		ref: text("ref").notNull(),
		periodoId: text("periodo_id").notNull(),
		reclamadoAt: timestamp("reclamado_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.vendedorId, t.tipo, t.ref] })],
);

// Failed seller PIN attempts per code; a code locks for 15 minutes after 5 misses.
export const intentosPin = pgTable("intentos_pin", {
	codigo: text("codigo").primaryKey(),
	fallos: integer("fallos").notNull().default(0),
	bloqueadoHasta: timestamp("bloqueado_hasta", { withTimezone: true }),
});
