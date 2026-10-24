import {
	type Canal,
	type Dataset,
	KPI_DEFS,
	KPI_IDS,
	type KpiId,
	type MetricaDef,
	provinciaDe,
	type Region,
	SUCURSALES,
} from "@/lib/domain";
import type * as schema from "./schema";

// Insert shapes: v2 columns with DB defaults are optional, so v1-shaped rows still map.
export type DatasetRows = {
	sucursales: (typeof schema.sucursales.$inferInsert)[];
	vendedores: (typeof schema.vendedores.$inferSelect)[];
	periodos: (typeof schema.periodos.$inferInsert)[];
	defs: (typeof schema.kpiDefiniciones.$inferInsert)[];
	resultados: (typeof schema.kpiResultados.$inferSelect)[];
};

/** Pure row -> domain mapping. Rows are trusted (written by replaceDataset), so enums are cast. */
export function rowsToDataset(r: DatasetRows): Dataset {
	const defs = { ...KPI_DEFS };
	for (const row of r.defs) {
		if (!(KPI_IDS as readonly string[]).includes(row.kpi)) continue;
		const id = row.kpi as KpiId;
		defs[id] = {
			id,
			nombre: row.nombre,
			corto: row.corto,
			peso: row.peso,
			objetivo: row.objetivo,
			direccion: row.direccion as "mayor" | "menor",
			num: row.num,
			den: row.den,
		};
	}
	// Domain order matters downstream (modes rely on it); unknown slugs last.
	const orden = (slug: string) => {
		const i = SUCURSALES.findIndex((s) => s.slug === slug);
		return i < 0 ? SUCURSALES.length : i;
	};
	return {
		sucursales: r.sucursales
			.map((s) => ({
				slug: s.slug,
				nombre: s.nombre,
				region: s.region as Region,
				vecina: s.vecina,
				provincia: s.provincia || provinciaDe(s.slug) || undefined,
			}))
			.sort(
				(a, b) => orden(a.slug) - orden(b.slug) || (a.slug < b.slug ? -1 : 1),
			),
		vendedores: r.vendedores.map((v) => ({
			id: v.id,
			nombre: v.nombre,
			apellido: v.apellido,
			sucursal: v.sucursal,
			canal: v.canal as Canal,
			altaPeriodo: v.altaPeriodo,
		})),
		periodos: r.periodos.map((p) => ({
			id: p.id,
			label: p.label,
			pesoMes: p.pesoMes,
			enCurso: p.enCurso ?? false,
		})),
		defs,
		// every stored metric, active or not; absent when the table is empty (v1 fallback)
		metricas: r.defs.length
			? r.defs
					.map(
						(row): MetricaDef => ({
							id: row.kpi,
							nombre: row.nombre,
							corto: row.corto,
							peso: row.peso,
							objetivo: row.objetivo,
							direccion: row.direccion as "mayor" | "menor",
							num: row.num,
							den: row.den,
							tipo: row.tipo ?? "base",
							activa: row.activa ?? true,
							orden: row.orden ?? 0,
							acumulacion: row.acumulacion ?? "flujo",
							accion: row.accion ?? "",
							unidad: row.unidad ?? "",
						}),
					)
					.sort((a, b) => a.orden - b.orden || (a.id < b.id ? -1 : 1))
			: undefined,
		resultados: r.resultados.map((x) => ({
			vendedorId: x.vendedorId,
			periodoId: x.periodoId,
			kpi: x.kpi,
			num: Number(x.num),
			den: Number(x.den),
		})),
	};
}
