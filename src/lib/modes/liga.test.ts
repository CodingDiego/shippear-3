import { describe, expect, test } from "vitest";
import { dataset, mesId, series, temporada } from "./fixtures";
import { liga } from "./liga";

const n = null;
const fila = (r: ReturnType<typeof liga>, id: string) => {
	const v = r.vendedores.find((x) => x.vendedorId === id);
	if (!v) throw new Error(`missing ${id}`);
	return v;
};

describe("liga eligibility (months since alta)", () => {
	test("hire with 7 of 10 months since alta needs min(9, ceil(7.5)) = 8 -> ineligible", () => {
		const periods = temporada(
			series({
				H: [n, n, 80, 80, 80, 80, n, 80, 80, n, 80, n],
			}),
		);
		const r = liga(periods, dataset(periods, { H: mesId(2) }));
		expect(fila(r, "H")).toMatchObject({
			meses: 7,
			mesesRequeridos: 8,
			elegible: false,
			puesto: null,
		});
	});

	test("9 of 12 -> eligible; hire with 8 of 10 -> eligible too", () => {
		const periods = temporada(
			series({
				V: [70, n, 70, 70, n, 70, 70, n, 70, 70, 70, 70],
				H: [n, n, 80, 80, 80, 80, n, 80, 80, n, 80, 80],
			}),
		);
		const r = liga(periods, dataset(periods, { H: mesId(2) }));
		expect(fila(r, "V")).toMatchObject({
			meses: 9,
			mesesRequeridos: 9,
			elegible: true,
		});
		expect(fila(r, "H")).toMatchObject({
			meses: 8,
			mesesRequeridos: 8,
			elegible: true,
		});
		expect(fila(r, "H").puesto).toBe(1);
		expect(fila(r, "V").puesto).toBe(2);
	});

	test("months since alta are inclusive of the alta month and rounded up", () => {
		const full = Array.from({ length: 14 }, () => 80);
		const periods = temporada(series({ A: full, B: full, C: full, D: full }));
		const r = liga(
			periods,
			dataset(periods, {
				A: mesId(0),
				B: mesId(10),
				C: mesId(2),
				D: "2024-01",
			}),
		);
		// 14 months -> min(9, ceil(10.5)) = 9; 4 months -> ceil(3) = 3; 12 -> 9; alta before the first period counts from it.
		expect(fila(r, "A").mesesRequeridos).toBe(9);
		expect(fila(r, "B").mesesRequeridos).toBe(3);
		expect(fila(r, "C").mesesRequeridos).toBe(9);
		expect(fila(r, "D").mesesRequeridos).toBe(9);
	});

	test("ineligibles go after eligibles with puesto null, even with a higher promedio", () => {
		const periods = temporada(
			series({
				LOW: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
				TOP: [99, 99, 99, 99, 99, 99, 99, 99, n, n, n, n],
				NADA: [n, n, n, n, n, n, n, n, n, n, n, n],
			}),
		);
		const r = liga(periods, dataset(periods, { NADA: mesId(0) }));
		expect(r.vendedores.map((v) => v.vendedorId)).toEqual([
			"LOW",
			"TOP",
			"NADA",
		]);
		expect(r.vendedores.map((v) => v.puesto)).toEqual([1, null, null]);
		expect(fila(r, "NADA")).toMatchObject({
			promedio: null,
			mediana: null,
			mejorMes: null,
			meses: 0,
		});
	});
});

describe("liga tie-breaks", () => {
	test("promedio -> meses -> mediana -> mejorMes -> id", () => {
		const periods = temporada(
			series({
				// all promedio 80
				A: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, n, n], // 10 months
				E: [60, 60, 60, 90, 90, 90, 90, 90, 90, n, n, n], // median 90
				C: [60, 80, 80, 80, 80, 80, 80, 80, 100, n, n, n], // median 80, best 100
				D: [70, 70, 70, 70, 90, 90, 90, 90, 80, n, n, n], // median 80, best 90
				V06: [80, 80, 80, 80, 80, 80, 80, 80, 80, n, n, n],
				V05: [80, 80, 80, 80, 80, 80, 80, 80, 80, n, n, n],
				TOP: [81, 81, 81, 81, 81, 81, 81, 81, 81, n, n, n],
			}),
		);
		const r = liga(periods, dataset(periods));
		expect(r.vendedores.map((v) => v.vendedorId)).toEqual([
			"TOP",
			"A",
			"E",
			"C",
			"D",
			"V05",
			"V06",
		]);
		expect(r.vendedores.map((v) => v.puesto)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(fila(r, "E")).toMatchObject({
			promedio: 80,
			mediana: 90,
			mejorMes: 90,
		});
		expect(fila(r, "C")).toMatchObject({ mediana: 80, mejorMes: 100 });
	});

	test("median of an even count is the mean of the two middle months", () => {
		const periods = temporada(
			series({ A: [70, 90, 80, 100, 60, 70, 80, 90, 100, 60, n, n] }),
		);
		expect(fila(liga(periods, dataset(periods)), "A").mediana).toBe(80);
	});
});

describe("liga sucursales", () => {
	const full = (s: number) => Array.from({ length: 12 }, () => s);
	const periods = temporada(
		series(
			{
				C1: full(90),
				C2: full(80),
				C3: full(70),
				M1: full(95),
				M2: full(95),
				M3: [99, 99, 99, n, n, n, n, n, n, n, n, n],
			},
			{
				C1: { sucursal: "caba" },
				C2: { sucursal: "caba" },
				C3: { sucursal: "caba" },
				M1: { sucursal: "moron" },
				M2: { sucursal: "moron" },
				M3: { sucursal: "moron" },
			},
		),
	);
	const r = liga(periods, dataset(periods));

	test("needs 3 eligible members; mean of eligible promedios", () => {
		const caba = r.sucursales.find((s) => s.slug === "caba");
		const moron = r.sucursales.find((s) => s.slug === "moron");
		expect(caba).toMatchObject({
			promedio: 80,
			miembros: 3,
			elegible: true,
			puesto: 1,
		});
		expect(moron).toMatchObject({
			promedio: 95,
			miembros: 2,
			elegible: false,
			puesto: null,
		});
		expect(r.sucursales[0].slug).toBe("caba");
	});

	test("lists every sucursal of the dataset; empty ones have promedio null", () => {
		expect(r.sucursales).toHaveLength(16);
		expect(r.sucursales.find((s) => s.slug === "salta")).toMatchObject({
			promedio: null,
			miembros: 0,
			elegible: false,
		});
	});
});

describe("liga botín", () => {
	test("best mean KPI puntos among eligibles only", () => {
		const meses = Array.from({ length: 12 }, (_, i) => [
			{ id: "A", score: 80, puntos: { venta: 90, cobr: 50 } },
			{ id: "B", score: 80, puntos: { venta: 85, cobr: i < 6 ? 100 : null } },
			// ineligible (8 months) with the best venta
			...(i < 8 ? [{ id: "X", score: 99, puntos: { venta: 100 } }] : []),
		]);
		const periods = temporada(meses);
		const r = liga(periods, dataset(periods));
		expect(r.botin.venta).toEqual({ vendedorId: "A", promedioPuntos: 90 });
		// B's cobr nulls are skipped: mean 100 over the 6 months it has
		expect(r.botin.cobr).toEqual({ vendedorId: "B", promedioPuntos: 100 });
		expect(r.botin.prod).toEqual({ vendedorId: "A", promedioPuntos: 80 });
	});

	test("null when nobody is eligible", () => {
		// 1 of 4 months since alta, needs ceil(3) = 3
		const periods = temporada(series({ A: [80, n, n, n] }));
		expect(liga(periods, dataset(periods)).botin.venta).toBeNull();
	});
});
