// Checks the seeded v2 data against SPEC-V2 and prints the numbers that go in
// docs/PROGRESS.md. Read only. Run: bun scripts/verify-v2.ts (default local env = DEVELOPMENT).
// Exits 1 when a hard check fails (monthly != daily, an effect off its truth, a broken spread).
import { loadEnvConfig } from "@next/env";

// Env must load before the db client module is evaluated, hence the dynamic imports.
loadEnvConfig(process.cwd(), true);

const pct = (xs: number[], q: number) => {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const f2 = (x: number | null | undefined) =>
	x === null || x === undefined ? "null" : x.toFixed(2);
const f3 = (x: number | null | undefined) =>
	x === null || x === undefined ? "null" : x.toFixed(3);
const fallas: string[] = [];
const check = (ok: boolean, what: string) => {
	console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`);
	if (!ok) fallas.push(what);
};

// Deterministic sampler (mulberry32) so the sample is the same on every run.
const rng = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

async function main() {
	const { sql } = await import("drizzle-orm");
	const { db } = await import("../src/db/client");
	const { CONSTANCIA_ID, hoy } = await import("../src/lib/domain");
	const reads = await import("../src/lib/data/db-reads");
	const { readAgregadosVentana, readConstancias, readSerieVentaDe } =
		await import("../src/lib/data/windows");
	const { scorePeriodV2, constancia, serieRolling } = await import(
		"../src/lib/scoring"
	);
	const { fechaReferencia, ventanaDe, sumarDias } = await import(
		"../src/lib/time"
	);
	const { efectoVentas, juegoActivo } = await import("../src/lib/games");
	const { tracker } = await import("../src/lib/goals");
	const { figusV2 } = await import("../src/lib/modes/album");
	const { EFECTOS, JUEGOS_SEED } = await import("../src/lib/seed/generate");

	const rows = async <T>(q: ReturnType<typeof sql>) =>
		(await db.execute(q)).rows as T[];

	// ---------- 1. row counts ----------
	console.log("\n1. Row counts");
	const tablas = [
		"sucursales",
		"vendedores",
		"periodos",
		"kpi_definiciones",
		"kpi_resultados",
		"kpi_diarios",
		"juegos",
		"juegos_sucursal",
		"engagement",
		"premios",
		"ajustes",
		"dataset_meta",
	];
	for (const t of tablas) {
		const [r] = await rows<{ n: number }>(
			sql.raw(`select count(*)::int as n from ${t}`),
		);
		console.log(`  ${t}: ${r.n}`);
	}
	const [rango] = await rows<{ min: string; max: string; dom: number }>(
		sql`select min(fecha)::text as min, max(fecha)::text as max,
			count(*) filter (where extract(isodow from fecha) = 7)::int as dom from kpi_diarios`,
	);
	console.log(
		`  kpi_diarios fechas ${rango.min} .. ${rango.max}, Sunday rows ${rango.dom}`,
	);
	check(rango.dom === 0, "no Sunday rows in kpi_diarios");
	check(rango.max === hoy(), `kpi_diarios ends at hoy() (${hoy()})`);

	const [d, defs, juegos] = await Promise.all([
		reads.readDataset(),
		reads.readMetricas(),
		reads.readJuegosConfig(),
	]);
	const ajustes = await reads.readAjustes();

	// ---------- 2. monthly == aggregate of daily ----------
	console.log(
		"\n2. Monthly == aggregate of daily (50 random seller-months per metric)",
	);
	const agg = await rows<{
		v: string;
		p: string;
		kpi: string;
		sn: number;
		sd: number;
		ln: number;
		ld: number;
	}>(sql`select vendedor_id as v, to_char(fecha, 'YYYY-MM') as p, kpi,
		sum(num)::float8 as sn, sum(den)::float8 as sd,
		(array_agg(num order by fecha desc))[1]::float8 as ln,
		(array_agg(den order by fecha desc))[1]::float8 as ld
		from kpi_diarios group by 1, 2, 3`);
	const diario = new Map(agg.map((r) => [`${r.v}|${r.p}|${r.kpi}`, r]));
	const rand = rng(42);
	const cerca = (a: number, b: number) =>
		Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
	for (const m of defs.filter((x) => x.acumulacion !== "derivada")) {
		const deM = d.resultados.filter((r) => r.kpi === m.id);
		const muestra = Array.from(
			{ length: Math.min(50, deM.length) },
			() => deM[Math.floor(rand() * deM.length)],
		);
		let mal = 0;
		for (const r of muestra) {
			const x = diario.get(`${r.vendedorId}|${r.periodoId}|${r.kpi}`);
			const [num, den] =
				m.acumulacion === "stock" ? [x?.ln, x?.ld] : [x?.sn, x?.sd];
			if (
				num === undefined ||
				den === undefined ||
				!cerca(num, r.num) ||
				!cerca(den, r.den)
			)
				mal++;
		}
		check(
			mal === 0 && muestra.length > 0,
			`${m.id} (${m.acumulacion}): ${muestra.length - mal}/${muestra.length} match`,
		);
	}

	// ---------- 3. constancia spread ----------
	console.log("\n3. Constancia spread across sellers");
	for (const ref of ["2026-09-30", hoy()]) {
		const c = Object.values(await readConstancias(ref)).filter(
			(x): x is number => x !== null,
		);
		console.log(
			`  ref ${ref}: n ${c.length}, min ${f2(Math.min(...c))}, p25 ${f2(pct(c, 0.25))}, median ${f2(pct(c, 0.5))}, p75 ${f2(pct(c, 0.75))}, max ${f2(Math.max(...c))}`,
		);
		check(
			c.length === d.vendedores.length,
			`ref ${ref}: every seller has a value`,
		);
		check(
			pct(c, 0.75) - pct(c, 0.25) > 0.15,
			`ref ${ref}: interquartile range > 0.15`,
		);
	}

	// ---------- 4. monthly card scores ----------
	console.log("\n4. Monthly card score (vista mes, closed months, live defs)");
	const cerrados = d.periodos.filter((p) => !p.enCurso);
	const conConstancia = defs.some((m) => m.id === CONSTANCIA_ID && m.activa);
	const season = [];
	for (const p of cerrados) {
		const c = conConstancia
			? await readConstancias(fechaReferencia(p, hoy()))
			: undefined;
		season.push(scorePeriodV2(d, p.id, "mes", { defs, constancia: c }));
	}
	const scores = season.flatMap((p) =>
		p.vendedores.flatMap((v) => (v.score === null ? [] : [v.score])),
	);
	const share = (f: (x: number) => boolean) =>
		(100 * scores.filter(f).length) / scores.length;
	console.log(
		`  ${scores.length} seller-months over ${cerrados.length} months: p05 ${f2(pct(scores, 0.05))}, median ${f2(pct(scores, 0.5))}, p95 ${f2(pct(scores, 0.95))}; under 65 ${f2(share((x) => x < 65))}%, at 80+ ${f2(share((x) => x >= 80))}%, at 100 ${f2(share((x) => x >= 99.95))}%`,
	);
	check(
		pct(scores, 0.5) > 70 && pct(scores, 0.5) < 85,
		"median score between 70 and 85",
	);
	check(share((x) => x >= 99.95) < 2, "under 2% of seller-months at 100");

	// ---------- 5. games: TWFE recovers the seeded effects ----------
	console.log(
		"\n5. efectoVentas vs ground truth (venta attainment; unit = sucursal mean / seller)",
	);
	const historia = {
		...juegos,
		global: Object.fromEntries(
			Object.keys(juegos.global).map((j) => [j, true]),
		) as typeof juegos.global,
	};
	// revelacion only lifts the bottom half of the previous month, so its average effect is half.
	const verdad = (j: (typeof JUEGOS_SEED)[number], kpi: "venta" | "lanz") => {
		const e = (EFECTOS[j] as Partial<Record<string, number>>)[kpi] ?? 0;
		return j === "revelacion" ? e / 2 : e;
	};
	const TOL = 0.03;
	for (const juego of JUEGOS_SEED) {
		for (const kpi of ["venta", "lanz"] as const) {
			const t = verdad(juego, kpi);
			if (t === 0) continue;
			const vend = [];
			const suc = [];
			for (const p of season) {
				const porSuc = new Map<string, number[]>();
				for (const v of p.vendedores) {
					const att = v.kpis[kpi]?.attainment ?? null;
					if (att === null) continue;
					const s = v.vendedor.sucursal;
					vend.push({
						unidad: v.vendedor.id,
						periodoId: p.periodoId,
						y: att,
						activo: juegoActivo(historia, juego, s, p.periodoId),
					});
					porSuc.set(s, [...(porSuc.get(s) ?? []), att]);
				}
				for (const [s, xs] of porSuc)
					suc.push({
						unidad: s,
						periodoId: p.periodoId,
						y: xs.reduce((a, b) => a + b, 0) / xs.length,
						activo: juegoActivo(historia, juego, s, p.periodoId),
					});
			}
			for (const [nombre, celdas] of [
				["sucursal", suc],
				["vendedor", vend],
			] as const) {
				const e = efectoVentas(celdas);
				check(
					e.beta !== null && e.beta > 0 && Math.abs(e.beta - t) <= TOL,
					`${juego} ${kpi} by ${nombre}: beta ${f3(e.beta)} vs truth ${f3(t)} (treated ${e.tratadas}, control ${e.control}, tol ${TOL})`,
				);
			}
		}
	}

	// ---------- 6. tracker for three sellers ----------
	console.log("\n6. Goal tracker, month in progress (ref hoy())");
	const enCurso = d.periodos.find((p) => p.enCurso);
	if (!enCurso) throw new Error("no month in progress");
	const ref = hoy();
	const actual = scorePeriodV2(d, enCurso.id, "mes", {
		defs,
		constancia: conConstancia ? await readConstancias(ref) : undefined,
	});
	const conScore = actual.vendedores.filter((v) => v.score !== null);
	const meta = ajustes.meta_puntos;
	const elegir = (f: (s: number) => boolean) =>
		conScore.find((v) => f(v.score as number))?.vendedor.id;
	const elegidos = [
		["above meta", elegir((s) => s >= meta + 3)],
		["short", elegir((s) => s < meta - 3 && s >= meta - 12)],
		["far", elegir((s) => s < meta - 20)],
	] as const;
	for (const [cual, id] of elegidos) {
		check(id !== undefined, `a seller ${cual} exists`);
		if (!id) continue;
		for (const ventana of ["mes", "semana"] as const) {
			const v = ventanaDe(ventana, ref);
			const serie =
				ventana === "mes" && conConstancia
					? await readSerieVentaDe(id, sumarDias(ref, -118), ref)
					: null;
			const t = tracker({
				vendedorId: id,
				ventana: v,
				defs,
				ajustes,
				agregados: await readAgregadosVentana(id, v, defs),
				constancia: serie ? constancia(serieRolling(serie, ref)) : null,
			});
			console.log(
				`  ${cual} ${id} ${ventana} ${t.desde}..${t.hasta} (${t.diasTranscurridos}/${t.diasHabiles}): score ${f2(t.score)}, meta ${t.meta}, faltan ${t.faltan}, proyeccion ${f2(t.proyeccion)}${t.inalcanzable ? ", inalcanzable" : ""}`,
			);
			for (const s of t.sugerencias)
				console.log(
					`      "${s.texto}" (gain ${f2(s.ganancia)}, effort ${f3(s.esfuerzo)}${s.figu ? ", figu" : ""})`,
				);
			check(
				t.sugerencias.length <= 3,
				`${id} ${ventana}: at most 3 suggestions`,
			);
			check(
				t.sugerencias.every((s) => !/undefined|NaN/.test(s.texto) && s.n >= 1),
				`${id} ${ventana}: suggestion text is clean`,
			);
		}
	}

	// ---------- 7. figus v2 ----------
	console.log("\n7. Figus v2 (closed months, album active only)");
	const figus = figusV2(season, d, defs, juegos);
	const por = (k: (f: (typeof figus)[number]) => string) =>
		Object.entries(
			figus.reduce<Record<string, number>>((acc, f) => {
				acc[k(f)] = (acc[k(f)] ?? 0) + 1;
				return acc;
			}, {}),
		)
			.map(([a, n]) => `${a} ${n}`)
			.join(", ");
	console.log(`  total ${figus.length}`);
	console.log(`  by rareza: ${por((f) => f.rareza)}`);
	console.log(`  by metrica: ${por((f) => f.metrica)}`);
	console.log(
		`  holograficas ${figus.filter((f) => f.holografica).length}, with medalla ${figus.filter((f) => f.medalla).length}`,
	);
	check(
		figus.every((f) =>
			juegoActivo(
				juegos,
				"album",
				d.vendedores.find((v) => v.id === f.vendedorId)?.sucursal ?? "",
				f.periodoId,
			),
		),
		"every figu is in an album-active sucursal-month",
	);
	check(
		figus.every((f) => f.periodoId !== enCurso.id),
		"no figu in the month in progress",
	);

	console.log(
		fallas.length === 0
			? "\nall checks passed"
			: `\n${fallas.length} check(s) failed`,
	);
	return fallas.length === 0;
}

main().then(
	(ok) => process.exit(ok ? 0 : 1),
	(err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	},
);
