import { describe, expect, it } from "vitest";
import { KPI_DEFS, PERIODOS, SUCURSALES } from "@/lib/domain";
import { rowsToDataset } from "./map";

const base = {
	sucursales: SUCURSALES.map((s) => ({ ...s })),
	periodos: PERIODOS.map((p) => ({ ...p })),
	defs: [] as never[],
	vendedores: [
		{
			id: "V001",
			nombre: "Ana",
			apellido: "Paz",
			sucursal: "caba",
			canal: "plaza",
			altaPeriodo: "2025-10",
		},
	],
	resultados: [
		{
			vendedorId: "V001",
			periodoId: "2025-10",
			kpi: "venta",
			num: 90,
			den: 100,
		},
	],
};

describe("rowsToDataset", () => {
	it("maps alta_periodo to altaPeriodo and narrows canal", () => {
		const d = rowsToDataset(base);
		expect(d.vendedores[0]).toEqual({
			id: "V001",
			nombre: "Ana",
			apellido: "Paz",
			sucursal: "caba",
			canal: "plaza",
			altaPeriodo: "2025-10",
		});
	});

	it("falls back to KPI_DEFS for any missing kpi", () => {
		const d = rowsToDataset(base);
		expect(d.defs).toEqual(KPI_DEFS);
		const d2 = rowsToDataset({
			...base,
			defs: [
				{
					kpi: "venta",
					nombre: "X",
					corto: "X",
					peso: 0.5,
					objetivo: 2,
					direccion: "mayor",
					num: "a",
					den: "b",
				},
			],
		});
		expect(d2.defs.venta.nombre).toBe("X");
		expect(d2.defs.venta.id).toBe("venta");
		expect(d2.defs.prod).toEqual(KPI_DEFS.prod);
	});

	it("returns sucursales in SUCURSALES order whatever the row order", () => {
		// db-reads orders by slug; modes (album, liga) rely on domain order
		const d = rowsToDataset({
			...base,
			sucursales: [...base.sucursales].sort((a, b) =>
				a.slug < b.slug ? -1 : 1,
			),
		});
		expect(d.sucursales.map((s) => s.slug)).toEqual(
			SUCURSALES.map((s) => s.slug),
		);
	});

	it("keeps resultados num/den as numbers", () => {
		const d = rowsToDataset(base);
		expect(d.resultados[0]).toEqual({
			vendedorId: "V001",
			periodoId: "2025-10",
			kpi: "venta",
			num: 90,
			den: 100,
		});
		expect(typeof d.resultados[0].num).toBe("number");
	});
});
