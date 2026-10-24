import { describe, expect, test } from "vitest";
import {
	AJUSTES_DEFAULT,
	METRICAS_DEFAULT,
	type MetricaDef,
	TOPE,
} from "@/lib/domain";
import type { VentanaMeta } from "@/lib/time";
import {
	type AgregadoMetrica,
	type TrackerInput,
	textoAccion,
	tracker,
} from ".";

const def = (id: string, extra: Partial<MetricaDef> = {}): MetricaDef => {
	const d = METRICAS_DEFAULT.find((m) => m.id === id);
	if (!d) throw new Error(id);
	return { ...d, activa: true, ...extra };
};

// October 2026: 27 working days; ref 2026-10-08 = 7 elapsed, 2026-10-24 = 21.
const mes = (ref: string, t: number): VentanaMeta => ({
	ventana: "mes",
	desde: "2026-10-01",
	hasta: "2026-10-31",
	ref,
	diasHabiles: 27,
	diasTranscurridos: t,
});
const TEMPRANO = mes("2026-10-08", 7);
const SEMANA: VentanaMeta = {
	ventana: "semana",
	desde: "2026-10-19",
	hasta: "2026-10-25",
	ref: "2026-10-24",
	diasHabiles: 6,
	diasTranscurridos: 6,
};

/** Agregado whose valor scores `p` points for d (mayor direction). */
const conPuntos = (d: MetricaDef, p: number, den = 70): AgregadoMetrica => ({
	num: ((p * TOPE) / 100) * d.objetivo * den,
	den,
	denPlan: null,
});

const input = (
	defs: MetricaDef[],
	agregados: TrackerInput["agregados"],
	extra: Partial<TrackerInput> = {},
): TrackerInput => ({
	vendedorId: "v1",
	ventana: TEMPRANO,
	defs,
	ajustes: AJUSTES_DEFAULT,
	agregados,
	constancia: null,
	...extra,
});

describe("tracker", () => {
	test("above meta: faltan 0 and one suggestion phrased as the next figu", () => {
		const venta = def("venta", { peso: 0.5 });
		const cobr = def("cobr", { peso: 0.5 });
		const t = tracker(
			input([venta, cobr], {
				venta: conPuntos(venta, 100),
				cobr: conPuntos(cobr, 70),
			}),
		);
		expect(t.score).toBeCloseTo(85, 6);
		expect(t.faltan).toBe(0);
		expect(t.inalcanzable).toBe(false);
		expect(t.sugerencias).toHaveLength(1);
		const [s] = t.sugerencias;
		expect(s.figu).toBe(true);
		expect(s.metrica).toBe("cobr");
		// pDen = 70·27/7 = 270; num at pace = 0.7·1.1·0.9·270 = 187.11; 0.9·270 − 187.11 → 56.
		expect(s.n).toBe(56);
		expect(s.texto).toBe(
			"Cobrá 56 facturas vencidas y ganá la figu de Cobranzas",
		);
	});

	test("12 points short, one metric closes it", () => {
		const venta = def("venta", { peso: 0.5 });
		const cobr = def("cobr", { peso: 0.5 });
		const t = tracker(
			input([venta, cobr], {
				venta: conPuntos(venta, 100),
				cobr: conPuntos(cobr, 36),
			}),
		);
		expect(t.score).toBeCloseTo(68, 6);
		expect(t.faltan).toBe(12);
		expect(t.meta).toBe(80);
		expect(t.sugerencias).toHaveLength(1);
		const [s] = t.sugerencias;
		expect(s.metrica).toBe("cobr");
		expect(s.figu).toBe(false);
		// 0.9·270 − 0.396·0.9·270 = 146.77 → 147.
		expect(s.n).toBe(147);
		expect(s.esfuerzo).toBeCloseTo(147 / 270, 9);
		expect(s.ganancia).toBeCloseTo(0.5 * (100 / TOPE - 36), 9);
		expect(t.inalcanzable).toBe(false);
		const m = t.metricas.find((x) => x.metrica === "cobr");
		expect(m?.alcanzado).toBe(false);
		expect(m?.faltanUnidades).toBe(147);
		expect(t.metricas.find((x) => x.metrica === "venta")?.faltanUnidades).toBe(
			0,
		);
	});

	test("drops a metric whose n does not fit in the remaining days", () => {
		const venta = def("venta", { peso: 0.5 });
		const cobr = def("cobr", { peso: 0.5 });
		// Same gap on 2026-10-24: 6 days left, cobr needs 147 of at most 70 + 10.
		const t = tracker(
			input(
				[venta, cobr],
				{ venta: conPuntos(venta, 100, 210), cobr: conPuntos(cobr, 36, 210) },
				{ ventana: mes("2026-10-24", 21) },
			),
		);
		expect(t.faltan).toBe(12);
		expect(t.descartadas).toEqual(["cobr"]);
		expect(t.sugerencias).toEqual([]);
		expect(t.inalcanzable).toBe(true);
	});

	test("needs three metrics, ordered by gain per effort", () => {
		const ids = ["venta", "prod", "cobr", "relev"];
		const defs = ids.map((id) => def(id, { peso: 0.25 }));
		const t = tracker(
			input(defs, {
				venta: conPuntos(defs[0], 100),
				prod: conPuntos(defs[1], 30),
				cobr: conPuntos(defs[2], 30),
				relev: conPuntos(defs[3], 30),
			}),
		);
		expect(t.faltan).toBe(32.5);
		expect(t.sugerencias.map((s) => s.metrica)).toEqual([
			"prod",
			"cobr",
			"relev",
		]);
		const suma = t.sugerencias.reduce((a, s) => a + s.ganancia, 0);
		expect(suma).toBeGreaterThanOrEqual(t.faltan);
		expect(t.inalcanzable).toBe(false);
	});

	test("unreachable gap: best three anyway, flagged", () => {
		const ids = ["venta", "prod", "cobr", "relev"];
		const defs = ids.map((id) => def(id, { peso: 0.25 }));
		const agregados = Object.fromEntries(
			defs.map((d) => [d.id, conPuntos(d, 50)]),
		);
		const t = tracker(
			input(defs, agregados, {
				ajustes: { ...AJUSTES_DEFAULT, meta_puntos: 100 },
			}),
		);
		expect(t.faltan).toBe(50);
		expect(t.sugerencias).toHaveLength(3);
		expect(t.inalcanzable).toBe(true);
	});

	test("stock metrics: snapshot is the projection, n on clients", () => {
		const noComp = def("no_comp", { peso: 0.5 });
		const lanz = def("lanz", { peso: 0.5 });
		const t = tracker(
			input([noComp, lanz], {
				no_comp: { num: 50, den: 200, denPlan: null },
				lanz: { num: 100, den: 200, denPlan: null },
			}),
		);
		const nc = t.metricas.find((m) => m.metrica === "no_comp");
		expect(nc?.valorProyectado).toBe(0.25);
		expect(nc?.faltanUnidades).toBe(30); // 50 − 0.1·200
		const l = t.metricas.find((m) => m.metrica === "lanz");
		expect(l?.faltanUnidades).toBe(50); // 0.75·200 − 100
		const textos = t.sugerencias.map((s) => s.texto);
		expect(textos).toContain("Conseguí que 30 clientes más compren");
		expect(textos).toContain("Vendé lanzamientos a 50 clientes más");
		expect(t.sugerencias.find((s) => s.metrica === "no_comp")?.esfuerzo).toBe(
			0.15,
		);
	});

	test("venta uses the plan den when known", () => {
		const venta = def("venta", { peso: 1 });
		const t = tracker(
			input([venta], { venta: { num: 700, den: 700, denPlan: 3000 } }),
		);
		// pace: 700·27/7 = 2700 kg of 3000 planned.
		const m = t.metricas[0];
		expect(m.valor).toBe(1);
		expect(m.valorProyectado).toBeCloseTo(0.9, 9);
		expect(m.faltanUnidades).toBe(300);
	});

	test("recent pace above or below the month average moves proyeccion that way", () => {
		const venta = def("venta", { peso: 1 });
		// 21 of 27 days: 2100 kg of a 2100 den so far (100 kg a day), 6 days left.
		const conRitmo = (ritmo?: number) =>
			tracker(
				input(
					[venta],
					{ venta: { num: 2100, den: 2100, denPlan: null, ritmo } },
					{ ventana: mes("2026-10-24", 21) },
				),
			);
		const plano = conRitmo();
		expect(plano.proyeccion).toBeCloseTo(plano.score ?? Number.NaN, 9);
		expect(conRitmo(100).proyeccion).toBeCloseTo(plano.proyeccion ?? 0, 9);
		const arriba = conRitmo(80); // 2100 + 6·80 = 2580 of 2700
		const abajo = conRitmo(60); // 2100 + 6·60 = 2460 of 2700
		expect(arriba.metricas[0].valorProyectado).toBeCloseTo(2580 / 2700, 9);
		expect(abajo.metricas[0].valorProyectado).toBeCloseTo(2460 / 2700, 9);
		expect(abajo.proyeccion ?? 0).toBeLessThan(arriba.proyeccion ?? 0);
		expect(arriba.proyeccion ?? 0).toBeLessThan(plano.proyeccion ?? 0);
		// Faster than the month so far lifts the projection above the score.
		const rapido = tracker(
			input(
				[venta],
				{ venta: { num: 1800, den: 2100, denPlan: null, ritmo: 120 } },
				{ ventana: mes("2026-10-24", 21) },
			),
		);
		expect(rapido.proyeccion ?? 0).toBeGreaterThan(rapido.score ?? 0);
		expect(rapido.metricas[0].valorProyectado).toBeCloseTo(2520 / 2700, 9);
		expect(abajo.score).toBeCloseTo(plano.score ?? 0, 9);
	});

	test("venta projects pace against the monthly plan", () => {
		const venta = def("venta", { peso: 1 });
		const t = tracker(
			input(
				[venta],
				{ venta: { num: 2000, den: 2100, denPlan: 3000, ritmo: 90 } },
				{ ventana: mes("2026-10-24", 21) },
			),
		);
		const m = t.metricas[0];
		// 2000 + 6·90 = 2540 kg of the 3000 planned, not the 2100·27/21 the den so far implies.
		expect(m.valorProyectado).toBeCloseTo(2540 / 3000, 9);
		expect(m.faltanUnidades).toBe(
			Math.ceil(venta.objetivo * 3000 - 2540 - 1e-9),
		);
	});

	test("weekly window with nothing reachable says so", () => {
		const prod = def("prod", { peso: 0.5 });
		const cobr = def("cobr", { peso: 0.5 });
		const t = tracker(
			input(
				[prod, cobr],
				{ prod: conPuntos(prod, 20, 60), cobr: conPuntos(cobr, 20, 60) },
				{ ventana: SEMANA },
			),
		);
		expect(t.faltan).toBeGreaterThan(0);
		expect(t.sugerencias).toEqual([]);
		expect(t.inalcanzable).toBe(true);
		expect(t.mensaje).toBe(
			"Esta semana ya no alcanza para la meta; la del mes sigue abierta",
		);
		// Monthly window or a reachable week: no message.
		const mesT = tracker(
			input([prod, cobr], {
				prod: conPuntos(prod, 70),
				cobr: conPuntos(cobr, 70),
			}),
		);
		expect(mesT.mensaje).toBeNull();
	});

	test("weekly window: flujo metrics only, no stock and no derivada", () => {
		const t = tracker(
			input(
				METRICAS_DEFAULT.filter((d) => d.activa),
				{},
				{ ventana: SEMANA, constancia: 0.9 },
			),
		);
		expect(t.metricas.map((m) => m.metrica)).toEqual([
			"venta",
			"prod",
			"no_entr",
			"cobr",
			"relev",
		]);
		expect(t.score).toBeNull();
		expect(t.faltan).toBe(80);
	});

	test("monthly window keeps stock and constancia", () => {
		const t = tracker(
			input(METRICAS_DEFAULT.slice(), {}, { constancia: 0.88 }),
		);
		expect(t.metricas.map((m) => m.metrica)).toContain("no_comp");
		const c = t.metricas.find((m) => m.metrica === "constancia");
		expect(c?.valor).toBe(0.88);
		expect(c?.alcanzado).toBe(true);
		expect(c?.faltanUnidades).toBeNull();
		expect(t.metricas.map((m) => m.metrica)).not.toContain("degus");
	});
});

describe("textoAccion", () => {
	const casos: [string, number, string][] = [
		["venta", 1250, "Vendé 1.250 kg más"],
		["venta", 1250000, "Vendé 1.250.000 kg más"],
		["venta", 1, "Vendé 1 kg más"],
		["prod", 1, "Cerrá 1 pedido más en tus visitas"],
		["prod", 4, "Cerrá 4 pedidos más en tus visitas"],
		["no_comp", 1, "Conseguí que 1 cliente más compre"],
		["no_comp", 3, "Conseguí que 3 clientes más compren"],
		["lanz", 1, "Vendé lanzamientos a 1 cliente más"],
		["no_entr", 1, "Evitá 1 pedido sin entregar"],
		["cobr", 1, "Cobrá 1 factura vencida"],
		["cobr", 2, "Cobrá 2 facturas vencidas"],
		["relev", 1, "Completá 1 encuesta"],
		["degus", 1, "Hacé 1 degustación más"],
		["degus", 12, "Hacé 12 degustaciones más"],
	];
	test.each(casos)("%s n=%d", (id, n, texto) => {
		expect(textoAccion(def(id), n)).toBe(texto);
	});

	test("custom default template uses num", () => {
		const custom = def("degus", { accion: "" });
		expect(textoAccion(custom, 2)).toBe("Sumá 2 degustaciones hechas");
		expect(textoAccion(custom, 1)).toBe("Sumá 1 degustación hecha");
	});

	test("n is a whole number of at least 1", () => {
		expect(textoAccion(def("venta"), 0)).toBe("Vendé 1 kg más");
		expect(textoAccion(def("venta"), -5)).toBe("Vendé 1 kg más");
		expect(textoAccion(def("venta"), 2.3)).toBe("Vendé 3 kg más");
	});
});
