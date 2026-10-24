import {
	AJUSTES_DEFAULT,
	type Dataset,
	type EngagementRow,
	FECHA_INICIO,
	type GeneratedV2,
	HOY,
	JUEGOS,
	type JuegoId,
	type JuegoIntervalo,
	KPI_DEFS,
	KPI_IDS,
	type KpiDiario,
	type KpiId,
	type KpiResultado,
	METRICAS_DEFAULT,
	PERIODOS,
	type Plan,
	type Premio,
	SEASON_START,
	SUCURSALES,
	type Vendedor,
} from "@/lib/domain";
import { diaSemana, habilesEntre, sumarDias, ventanaMes } from "@/lib/time";
import { APELLIDOS, NOMBRES } from "./names";
import { fnv1a, gaussian, mulberry32 } from "./random";

const rngOf = (...parts: (string | number)[]) =>
	mulberry32(fnv1a(parts.join(":")));
const pick = <T>(arr: readonly T[], rng: () => number): T =>
	arr[Math.floor(rng() * arr.length)];
const between = (rng: () => number, lo: number, hi: number) =>
	Math.round(lo + rng() * (hi - lo));
const clamp = (x: number, lo: number, hi: number) =>
	Math.min(hi, Math.max(lo, x));
/** Unbiased stochastic rounding, so daily counts sum to the monthly expectation. */
const sround = (x: number, rng: () => number) => Math.floor(x + rng());

// ---------- ground truth (the games analytics must recover these, roughly) ----------

/**
 * Attainment added while a game is active for the seller's sucursal that month, times
 * ENGAGEMENT_MULT of the seller's tier. Attainment is valor/objetivo, so +0.04 lanz is
 * +0.03 valor at objetivo 0.75. revelacion only applies to sellers in the bottom half of
 * the previous month (national rank of the generator's weighted pre-effect attainment).
 */
export const EFECTOS = {
	liga: { venta: 0.03 },
	album: { lanz: 0.04, venta: 0.02 },
	revelacion: { venta: 0.05 },
} as const satisfies Partial<Record<JuegoId, Partial<Record<KpiId, number>>>>;
type JuegoSeed = keyof typeof EFECTOS;
/** Games the generator seeds (clásicos is gone in v2). */
export const JUEGOS_SEED = JUEGOS.filter((j): j is JuegoSeed => j in EFECTOS);

export type TierEngagement = "alto" | "medio" | "bajo";
/** Effect multiplier by engagement third (top 1.5x, bottom 0.5x); the mean is 1. */
export const ENGAGEMENT_MULT: Record<TierEngagement, number> = {
	alto: 1.5,
	medio: 1,
	bajo: 0.5,
};

/** Rollout cohorts: sucursales sorted by hash, 4 per cohort; "never" is the control. */
export const ROLLOUT = ["2025-10", "2026-02", "2026-06", null] as const;

// ---------- monthly model (v1 character) ----------

/** Metrics with generated data: the seven KPIs plus the seeded custom degus. */
const GEN_IDS = [...KPI_IDS, "degus"] as const;
type GenId = (typeof GEN_IDS)[number];
const GEN_DEF = Object.fromEntries(
	METRICAS_DEFAULT.map((m) => [m.id, m]),
) as Record<GenId, (typeof METRICAS_DEFAULT)[number]>;
const STOCK = new Set<GenId>(["no_comp", "lanz"]);

const BOUNDS: Record<GenId, [number, number]> = {
	venta: [0.4, 1.6],
	prod: [0.01, 0.99],
	no_comp: [0.01, 0.6],
	lanz: [0.01, 0.99],
	no_entr: [0, 0.2],
	cobr: [0.01, 0.99],
	relev: [0.01, 0.99],
	degus: [0.01, 0.99],
};

// Mean attainment per metric. On target (1.0) is already 90.9 points, so centring below
// it gives card scores a median near 80, like the PDF cards (91/74/61). venta stays
// >= 0.9 so its mean valor matches a sales force that roughly meets its OV.
const CENTER: Record<GenId, number> = {
	venta: 0.95,
	prod: 0.82,
	no_comp: 0.82,
	lanz: 0.82,
	no_entr: 0.82,
	cobr: 0.82,
	relev: 0.82,
	degus: 0.85,
};
const SKILL_SD = 0.13; // persistent per-vendedor level
const KPI_SKILL_SD = 0.1; // persistent per-vendedor strength in each KPI
const AR_PHI = 0.6;
const AR_SD = 0.06;
const SUC_MES_SD = 0.02; // one shock per sucursal per month (small: games are switched per sucursal)
const CANAL_MES_SD = 0.03; // one shock per canal per month
const HIRES = 10;
const HIRE_FIRST = 3; // PERIODOS index of 2026-01
const HIRE_SPAN = 6; // 2026-01 .. 2026-06

// ---------- volatilidad (drives Constancia) ----------

// Each seller has volatilidad u in [0,1). venta's monthly shocks scale by
// VOL_SHOCK_MIN + u * VOL_SHOCK_GAIN, it swings by N(0, u * VOL_SWING) per month, and a
// share u * VOL_LUMP of its daily volume arrives as big orders on ~VOL_SPIKE_P of days.
const VOL_SHOCK_MIN = 0.1;
const VOL_SHOCK_GAIN = 1.2;
const VOL_SWING = 0.22;
const VOL_LUMP = 0.6;
const VOL_SPIKE_P = 0.1;
const DAY_SD = 0.1; // ordinary day-to-day noise of venta

// ---------- engagement and prizes (simulated) ----------

const ENG_SEMANA: Record<TierEngagement, { p: number; vistas: number }> = {
	alto: { p: 0.9, vistas: 10 },
	medio: { p: 0.6, vistas: 5 },
	bajo: { p: 0.25, vistas: 2 },
};
/** Chance a seller claims what the game gave them in a closed month (figus, prizes). */
const RECLAMO_P: Record<TierEngagement, number> = {
	alto: 0.7,
	medio: 0.4,
	bajo: 0.1,
};
const PREMIO: Record<JuegoSeed, { costo: number; descripcion: string }> = {
	liga: {
		costo: 350_000,
		descripcion: "Orden de compra para el líder de la Liga de cada sucursal",
	},
	revelacion: {
		costo: 250_000,
		descripcion: "Cena para dos para la Revelación del mes de cada sucursal",
	},
	album: {
		costo: 500_000,
		descripcion: "Álbum impreso y sobres de figus para cada sucursal",
	},
};

type Mes = { att: Record<GenId, number>; indice: number } | null;

/**
 * v2 generator: daily rows (Mon-Sat) from FECHA_INICIO through `hasta`, their monthly
 * aggregates, game rollout, simulated engagement and prizes. Every day draws from the
 * stream of its whole month, so a later `hasta` (Simular cierre de mes) only appends days.
 */
export function generateV2(seed = 42, hasta: string = HOY): GeneratedV2 {
	const sucEffect = new Map(
		SUCURSALES.map((s) => [
			s.slug,
			gaussian(rngOf(seed, "suc", s.slug), 0, 0.04),
		]),
	);

	const vendedores: Vendedor[] = [];
	for (const s of SUCURSALES) {
		const n = between(rngOf(seed, "count", s.slug), 8, 10);
		for (let i = 0; i < n; i++) {
			const id = `V${String(vendedores.length + 1).padStart(3, "0")}`;
			const rng = rngOf(seed, id, "meta");
			vendedores.push({
				id,
				nombre: pick(NOMBRES, rng),
				apellido: pick(APELLIDOS, rng),
				sucursal: s.slug,
				canal: rng() < 0.5 ? "plaza" : "campaña",
				altaPeriodo: SEASON_START,
			});
		}
	}

	// Mid-season hires: one vendedor in each of the 10 sucursales ranked first by hash.
	const hireSucs = [...SUCURSALES]
		.sort(
			(a, b) =>
				fnv1a(`${seed}:hire:${a.slug}`) - fnv1a(`${seed}:hire:${b.slug}`),
		)
		.slice(0, HIRES);
	for (const s of hireSucs) {
		const members = vendedores.filter((v) => v.sucursal === s.slug);
		const rng = rngOf(seed, "hire", s.slug, "who");
		const v = pick(members, rng);
		v.altaPeriodo = PERIODOS[HIRE_FIRST + Math.floor(rng() * HIRE_SPAN)].id;
	}

	// Rollout per game: sucursales sorted by hash, 4 per cohort, so every game has
	// treated and control cells.
	const intervalos: JuegoIntervalo[] = [];
	const desdeDe = new Map<string, string>(); // `${juego}|${sucursal}` -> desde
	for (const juego of JUEGOS_SEED) {
		const orden = [...SUCURSALES].sort(
			(a, b) =>
				fnv1a(`${seed}:rollout:${juego}:${a.slug}`) -
				fnv1a(`${seed}:rollout:${juego}:${b.slug}`),
		);
		orden.forEach((s, i) => {
			const desde = ROLLOUT[Math.floor((i * ROLLOUT.length) / orden.length)];
			if (desde === null) return;
			intervalos.push({ juego, sucursal: s.slug, desde, hasta: null });
			desdeDe.set(`${juego}|${s.slug}`, desde);
		});
	}
	const activo = (juego: JuegoSeed, sucursal: string, periodoId: string) => {
		const desde = desdeDe.get(`${juego}|${sucursal}`);
		return desde !== undefined && periodoId >= desde;
	};

	// Engagement thirds by a persistent propensity.
	const propension = vendedores.map((v) => rngOf(seed, v.id, "engagement")());
	const porPropension = vendedores
		.map((_, i) => i)
		.sort((a, b) => propension[a] - propension[b]);
	const tier = new Map<string, TierEngagement>();
	porPropension.forEach((idx, rank) => {
		const t = (rank * 3) / vendedores.length;
		tier.set(vendedores[idx].id, t < 1 ? "bajo" : t < 2 ? "medio" : "alto");
	});

	// Pass 1: latent monthly attainment per seller (v1 model + liga/album effects).
	const meses = new Map<string, Mes[]>();
	const volatilidad = new Map<string, number>();
	for (const v of vendedores) {
		const skill = gaussian(rngOf(seed, v.id, "skill"), 0, SKILL_SD);
		const u = rngOf(seed, v.id, "arc")();
		const arc = u < 0.08 ? 1 : u < 0.13 ? -1 : 0; // remontada / bajon / none
		const vol = rngOf(seed, v.id, "volatilidad")();
		volatilidad.set(v.id, vol);
		const swing = rngOf(seed, v.id, "swing");
		const suc = sucEffect.get(v.sucursal) ?? 0;
		const mult = ENGAGEMENT_MULT[tier.get(v.id) ?? "medio"];
		const ar = {} as Record<GenId, { rng: () => number; e: number }>;
		const kpiSkill = {} as Record<GenId, number>;
		for (const k of GEN_IDS) {
			ar[k] = { rng: rngOf(seed, v.id, k), e: 0 };
			kpiSkill[k] = gaussian(rngOf(seed, v.id, k, "skill"), 0, KPI_SKILL_SD);
		}

		meses.set(
			v.id,
			PERIODOS.map((p, i) => {
				const mm = p.id.slice(5);
				const arcFx = arc * (-0.15 + (0.25 * i) / (PERIODOS.length - 1));
				// Advance every chain each month so alta does not shift the stream.
				const noise = {} as Record<GenId, number>;
				for (const k of GEN_IDS) {
					const s = ar[k];
					s.e = AR_PHI * s.e + gaussian(s.rng, 0, AR_SD);
					noise[k] = s.e;
				}
				const swingFx = gaussian(swing, 0, vol * VOL_SWING);
				if (p.id < v.altaPeriodo) return null;

				// Monthly shocks shared by a whole sucursal or canal (a promo, a strike).
				const mesFx =
					gaussian(rngOf(seed, "sucmes", v.sucursal, p.id), 0, SUC_MES_SD) +
					gaussian(rngOf(seed, "canalmes", v.canal, p.id), 0, CANAL_MES_SD);

				const att = {} as Record<GenId, number>;
				for (const k of GEN_IDS) {
					let a = CENTER[k] + skill + kpiSkill[k] + suc + arcFx;
					if (k === "venta") {
						a +=
							(noise[k] + mesFx) * (VOL_SHOCK_MIN + vol * VOL_SHOCK_GAIN) +
							swingFx;
						if (v.canal === "campaña") a -= 0.03;
						if (mm === "12") a += 0.04;
						if (mm === "01" || mm === "02") a -= 0.04;
					} else a += noise[k] + mesFx;
					if (k === "prod" && v.canal === "campaña") a += 0.02;
					for (const juego of ["liga", "album"] as const) {
						const fx = (EFECTOS[juego] as Partial<Record<GenId, number>>)[k];
						if (fx && activo(juego, v.sucursal, p.id)) a += fx * mult;
					}
					att[k] = a;
				}
				const indice = KPI_IDS.reduce(
					(t, k) => t + KPI_DEFS[k].peso * att[k],
					0,
				);
				return { att, indice };
			}),
		);
	}

	// revelacion: bottom half of the previous month, nationally, by the latent index.
	const abajo = new Set<string>(); // `${vendedorId}|${periodoIndex}`
	for (let i = 1; i < PERIODOS.length; i++) {
		const prev = vendedores
			.map((v) => ({ id: v.id, m: meses.get(v.id)?.[i - 1] }))
			.filter((x) => x.m)
			.sort((a, b) => (a.m?.indice ?? 0) - (b.m?.indice ?? 0));
		for (const x of prev.slice(0, Math.floor(prev.length / 2)))
			abajo.add(`${x.id}|${i}`);
	}

	// Pass 2: days. Each seller-month draws its whole month, rows stop at `hasta`.
	const diarios: KpiDiario[] = [];
	const resultados: KpiResultado[] = [];
	const planes: Plan[] = [];
	for (const v of vendedores) {
		const vol = volatilidad.get(v.id) ?? 0;
		const mult = ENGAGEMENT_MULT[tier.get(v.id) ?? "medio"];
		meses.get(v.id)?.forEach((m, i) => {
			if (!m) return;
			const p = PERIODOS[i];
			const dias = habilesEntre(ventanaMes(p.id));
			const hechos = dias.filter((d) => d >= FECHA_INICIO && d <= hasta).length;
			if (hechos === 0) return;

			const rd = rngOf(seed, v.id, p.id, "den");
			const clientes = between(rd, 60, 220);
			const dens: Record<GenId, number> = {
				venta: Math.round(
					between(rd, 8000, 40000) * (v.canal === "campaña" ? 0.7 : 1),
				),
				prod: between(rd, 150, 400),
				no_comp: clientes,
				lanz: clientes,
				no_entr: between(rd, 100, 600),
				cobr: between(rd, 40, 200),
				relev: between(rd, 10, 30),
				degus: between(rd, 8, 26),
			};
			// The OV is set for the whole month, so the month in progress knows its full plan.
			planes.push({
				vendedorId: v.id,
				periodoId: p.id,
				kpi: "venta",
				den: dens.venta,
			});
			const att = { ...m.att };
			if (activo("revelacion", v.sucursal, p.id) && abajo.has(`${v.id}|${i}`))
				att.venta += EFECTOS.revelacion.venta * mult;

			for (const k of GEN_IDS) {
				const def = GEN_DEF[k];
				const raw =
					def.direccion === "mayor"
						? def.objetivo * att[k]
						: def.objetivo / Math.max(att[k], 0.2); // floor stops division blow-up
				const [lo, hi] = BOUNDS[k];
				const valor = clamp(raw, lo, hi);
				const rows = diasDe(k, valor, dens[k], dias.length, vol, (s) =>
					rngOf(seed, v.id, p.id, k, s),
				).slice(0, hechos);
				let num = 0;
				let den = 0;
				rows.forEach(([n, d], j) => {
					diarios.push({
						vendedorId: v.id,
						fecha: dias[j],
						kpi: k,
						num: n,
						den: d,
					});
					if (STOCK.has(k)) [num, den] = [n, d];
					else [num, den] = [num + n, den + d];
				});
				resultados.push({
					vendedorId: v.id,
					periodoId: p.id,
					kpi: k,
					num,
					den,
				});
			}
		});
	}

	const engagement = simularEngagement(seed, vendedores, tier, activo, hasta);
	const premios = simularPremios(seed, activo, hasta);

	return {
		dataset: {
			sucursales: SUCURSALES,
			vendedores,
			periodos: PERIODOS,
			defs: KPI_DEFS,
			resultados,
			metricas: METRICAS_DEFAULT,
		},
		diarios,
		planes,
		juegos: {
			global: Object.fromEntries(
				JUEGOS.map((j) => [j, j in EFECTOS]),
			) as Record<JuegoId, boolean>,
			intervalos,
		},
		engagement,
		premios,
		ajustes: { ...AJUSTES_DEFAULT },
	};
}

/**
 * The [num, den] of every working day of one seller-month (all of them, so the stream
 * never depends on `hasta`). flujo: daily amounts; stock: month-to-date snapshots whose
 * last day is the monthly value.
 */
function diasDe(
	k: GenId,
	valor: number,
	denMes: number,
	n: number,
	vol: number,
	rngFor: (stream: string) => () => number,
): [number, number][] {
	const rng = rngFor("dias");
	if (STOCK.has(k)) {
		// lanz: buyers so far climb to the final count; no_comp: non-buyers fall to it.
		const final = Math.round(valor * denMes);
		const lejos = k === "lanz" ? final : denMes - final;
		let g = 0;
		return Array.from({ length: n }, (_, j) => {
			const f = (j + 1) / n;
			g =
				j === n - 1
					? 1
					: clamp(Math.max(g, 1 - (1 - f) ** 2 + gaussian(rng, 0, 0.03)), 0, 1);
			const hecho = Math.round(lejos * g);
			return [k === "lanz" ? hecho : denMes - hecho, denMes];
		});
	}
	// flujo den: venta's OV plan is spread evenly; the rest vary by day. Cumulative
	// rounding keeps the month's den exact.
	const pesos = Array.from({ length: n }, () =>
		k === "venta" ? 1 : Math.max(0.2, 1 + gaussian(rng, 0, 0.25)),
	);
	const total = pesos.reduce((t, w) => t + w, 0);
	let acum = 0;
	let antes = 0;
	const lump = vol * VOL_LUMP;
	return pesos.map((w) => {
		acum += w;
		const corte = Math.round((denMes * acum) / total);
		const d = corte - antes;
		antes = corte;
		if (k !== "venta") return [sround(d * valor, rng), d];
		// venta: ordinary days plus big orders; both have mean 1, so lumpiness only adds spread.
		const dia =
			(1 - lump) * Math.max(0, 1 + gaussian(rng, 0, DAY_SD)) +
			(rng() < VOL_SPIKE_P ? lump / VOL_SPIKE_P : 0);
		return [sround(d * valor * dia, rng), d];
	});
}

/** Weekly totals (fecha = Monday) per seller per active game, while the seller is on staff. */
function simularEngagement(
	seed: number,
	vendedores: Vendedor[],
	tier: Map<string, TierEngagement>,
	activo: (j: JuegoSeed, s: string, p: string) => boolean,
	hasta: string,
): EngagementRow[] {
	const lunes: string[] = [];
	for (let f = FECHA_INICIO; f <= hasta; f = sumarDias(f, 1))
		if (diaSemana(f) === 1) lunes.push(f);
	const out: EngagementRow[] = [];
	for (const v of vendedores) {
		const t = ENG_SEMANA[tier.get(v.id) ?? "medio"];
		for (const juego of JUEGOS_SEED) {
			const rng = rngOf(seed, v.id, juego, "eng");
			for (const fecha of lunes) {
				const mes = fecha.slice(0, 7);
				const usa = rng() < t.p;
				const vistas = 1 + Math.floor(rng() * t.vistas);
				const inter = Math.floor(vistas * rng() * 0.8);
				if (!usa || mes < v.altaPeriodo || !activo(juego, v.sucursal, mes))
					continue;
				const base = {
					fecha,
					vendedorId: v.id,
					juego,
					fuente: "simulado",
				} as const;
				out.push({ ...base, evento: "vista", cantidad: vistas });
				if (inter > 0)
					out.push({ ...base, evento: "interaccion", cantidad: inter });
			}
			// Claims: on the first Monday of a month, for the month before. Own stream, so the
			// vista/interaccion rows above stay the same.
			const rr = rngOf(seed, v.id, juego, "reclamo");
			for (const fecha of lunes) {
				if (Number(fecha.slice(8)) > 7) continue;
				const antes = sumarDias(fecha, -7).slice(0, 7);
				const claims = rr() < RECLAMO_P[tier.get(v.id) ?? "medio"];
				if (
					!claims ||
					antes < v.altaPeriodo ||
					!activo(juego, v.sucursal, antes)
				)
					continue;
				out.push({
					fecha,
					vendedorId: v.id,
					juego,
					evento: "reclamo",
					cantidad: 1 + Math.floor(rr() * (juego === "album" ? 4 : 1)),
					fuente: "simulado",
				});
			}
		}
	}
	return out;
}

/** One prize per game per month, priced per active sucursal. */
function simularPremios(
	seed: number,
	activo: (j: JuegoSeed, s: string, p: string) => boolean,
	hasta: string,
): Premio[] {
	const out: Premio[] = [];
	for (const juego of JUEGOS_SEED) {
		for (const p of PERIODOS) {
			if (`${p.id}-01` > hasta) continue;
			const n = SUCURSALES.filter((s) => activo(juego, s.slug, p.id)).length;
			if (n === 0) continue;
			const f = 0.8 + 0.4 * rngOf(seed, "premio", juego, p.id)();
			out.push({
				id: `${juego}-${p.id}`,
				juego,
				periodoId: p.id,
				descripcion: PREMIO[juego].descripcion,
				costoArs: Math.round((n * PREMIO[juego].costo * f) / 1000) * 1000,
				simulado: true,
			});
		}
	}
	return out;
}

/** v1 shape: the monthly dataset of generateV2 with only the seven KPIs. */
export function generate(seed = 42): Dataset {
	const { dataset } = generateV2(seed);
	const ids: readonly string[] = KPI_IDS;
	return {
		sucursales: dataset.sucursales,
		vendedores: dataset.vendedores,
		periodos: dataset.periodos,
		defs: dataset.defs,
		resultados: dataset.resultados.filter((r) => ids.includes(r.kpi)),
	};
}
