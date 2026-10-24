# Figu v2 · spec

Source of truth for the v2 work (2026-10-24). `docs/SPECS.md` stays valid where this file is silent. Every agent reads this file before writing code.

## Decisions after kickoff (override anything below)

- **Clásicos is deleted.** No Clásicos game, page, mode module, tests, nav link, landing fragment, generator effect or rollout, or games-analytics row. `JUEGOS = liga | revelacion | album`. Remove it everywhere it exists today (`src/app/clasicos`, `src/lib/modes/clasicos*`, fixtures, links in nav, footer, landing, como-funciona, supuestos, e2e).
- **Remotion scope:** only (1) the landing hero Player and (2) short in-app animations played with `@remotion/player`: a card reveal, a ranking re-sort, and a prize claim. No clip rendering, no clip download, no Vercel Sandbox, no Blob writes for video. Drop `@remotion/vercel` and `@vercel/sandbox`.
- **Plain wording (user: the narrative was ambiguous).** The case's canal values stay `plaza` / `campaña` in data and CSV, but the UI shows them through `canalNombre()` (`src/lib/format.ts`) as **Ciudad** / **Rural**, and the column or filter is called **Zona**. Vistas are labelled **Mes**, **Acumulado**, **Combinada** (never "Acum." or "Mix"). Every explanatory sentence names the concrete thing (kilos, clientes, facturas) instead of shorthand like "num sobre den"; no internal jargon (dataset, slug, cociente) in user-facing copy except on the CSV format section. `/como-funciona` already describes the v2 story (three users, goal tracker, admin closes the month, games switched per sucursal); new screens must match it.
- **Prize claiming** (new, seller view): when a seller has a newly earned figu or a prize (`premios` for their sucursal's active game and month), `/yo` shows it as claimable; "Reclamar" plays the claim animation and records the claim. Table `reclamos (vendedor_id, tipo figu|premio, ref, periodo_id, reclamado_at)`, pk (vendedor_id, tipo, ref). Claiming is a server action (`updateTag("engagement")`) and also logs a real engagement event `reclamo`. Claims are counted in the engagement measures.
- **Rarity by quantile (engine review: seed 42 never produced a legendaria with fixed shares).** For each closed month and metric, `p` = share of sellers with data who met it. Rank every (month, metric) cell of the season by `p`: the hardest 5 % of cells are legendaria, the next 20 % épica, the next 35 % rara, the rest común. Ties in `p` share the harder tier.
- **Venta plan and pace projection.** Table `planes (vendedor_id, periodo_id, kpi, den)` holds the full-month plan den for venta (the OV), written by the generator for every month and by CSV import when present. The tracker uses it as venta's window den. **Pace** for flujo numerators = average daily num of the last 14 working days (or all elapsed days if fewer), times remaining working days, added to num so far; flujo den without a plan scales by elapsed share. This makes `proyeccion` differ from `score` whenever the recent pace differs from the month so far.
- **Constancia is materialised.** Table `constancias (vendedor_id, periodo_id, valor)` is computed when data is written (seed, CSV import, cierre de mes), never on read. Reads stay fast; the cold load of `/` must stay well under the prerender limit and `next build` must pass.
- **CSV plan column.** An optional `plan` column, filled only on `venta` rows, gives that seller-month's full OV and is written to `planes`; v1 files without the column stay valid, and a daily file may repeat the value on every row.
- **Weekly tracker with nothing reachable** says so plainly ("Esta semana ya no alcanza para la meta; la del mes sigue abierta") instead of an empty list.

## What changed and why

The user (La Virginia case team) added:

1. **Brand.** The look follows La Virginia's own palette (from their site theme): primary blue `#0e4194`, gold `#b09613`, yellow `#eed30b`, olive green `#627D47`, red `#b20000`, base text `#4d5864`, dark `#313233`. No La Virginia logos or product images; a text credit only.
2. **Seller view.** Each seller sees a goal tracker: "Te faltan 12 puntos para tu meta del mes", with a projection at the current pace and 1–3 concrete actions ("Vendé 120 kg más", "Conseguí que 3 clientes más compren"). Both month and week.
3. **Consistency.** Steady sellers are rewarded over spiky ones. Measured on **rolling 30-day windows**, never on calendar months.
4. **Rankings by scope.** Sellers and sucursales ranked nacional, por provincia and por sucursal; provinces ranked nationally. The Liga can be read nacional or por provincia.
5. **Figus come from goals.** A seller earns a metric's figu by meeting that metric's objetivo in a month. Rarity comes from how few sellers met it. The national top 3 is a foil edition on top.
6. **Games are managed.** An admin turns each game on or off, globally and per sucursal, and sees which game works better, per seller and per sucursal, by **effect on sales**, **engagement** and **prize value**. (Difficulty was explicitly not requested.)
7. **Custom metrics.** An admin adds metrics with their own weight; the weighted sum is always renormalised over active metrics.

## Time

- `HOY = "2026-10-24"` (Saturday) lives in `src/lib/domain.ts`; `process.env.DEMO_HOY` may override it (server only). No code calls `new Date()` to decide "today".
- Daily data runs from `2025-10-01` through `HOY`. Working days are Monday–Saturday; Sundays have no rows.
- Periods: `2025-10` … `2026-10`. `2026-10` is the **month in progress** (`enCurso: true`); the others are closed. Rankings, Liga, Revelación, Álbum and Clásicos use closed months only and default to the latest closed month (`2026-09`). The seller tracker uses the month in progress and the current week.
- Week = ISO week, Monday–Sunday. The current week is `2026-10-19 … 2026-10-25`.
- "Simular cierre de mes" (admin) generates the remaining working days of the month in progress, marks it closed, and computes its figus. A reseed restores the demo state.

## Metrics (was: KPIs)

- `MetricaId = string`. The seven case KPIs keep their ids and `KpiId` stays as the union of those seven; new code keys by `MetricaId`.
- Table `kpi_definiciones` gains: `tipo` (`base` | `derivada` | `custom`), `activa` (bool), `orden` (int), `acumulacion` (`flujo` | `stock` | `derivada`), `accion` (suggestion template with `{n}`), `unidad` (short unit for display).
- **Effective weight** = `peso / Σ peso of active metrics`. Admin edits raw `peso`; the UI shows the normalised %. A metric with `activa = false` scores nothing and shows nowhere except admin.
- Defaults: the seven case KPIs with their PDF weights (sum 1.00), plus **Constancia** (`derivada`, peso 0.10, active), plus one seeded **custom** metric `degus` ("Degustaciones", num "degustaciones hechas", den "degustaciones programadas", objetivo 0.9, peso 0.05, `activa = false`) that has generated data, so the demo can switch it on.
- `acumulacion`:
  - `flujo` (venta, prod, no_entr, cobr, relev, degus): daily rows are that day's amounts; any window sums num and den.
  - `stock` (no_comp, lanz): daily rows are **month-to-date snapshots** (clients active this month, clients that have not bought yet). A month's value is its last day's row. Stock metrics have no weekly value.
  - `derivada` (constancia): computed, never stored.

Suggestion templates (`accion`), es-AR voseo:

| metric         | accion                                  |
| -------------- | --------------------------------------- |
| venta          | `Vendé {n} kg más`                      |
| prod           | `Cerrá {n} pedidos más en tus visitas`  |
| no_comp        | `Conseguí que {n} clientes más compren` |
| lanz           | `Vendé lanzamientos a {n} clientes más` |
| no_entr        | `Evitá {n} pedidos sin entregar`        |
| cobr           | `Cobrá {n} facturas vencidas`           |
| relev          | `Completá {n} encuestas`                |
| degus          | `Hacé {n} degustaciones más`            |
| custom default | `Sumá {n} {num}`                        |

## Consistency (Constancia)

- Series: for each day `d` in the 90 days ending at the reference date, `r_d = Σnum / Σden` of **venta** over `d-29 … d` (rolling 30-day attainment). Days with Σden = 0 are skipped.
- `cv = stdev(r) / mean(r)`. `valor = 1 - min(1, cv / 0.5)` (in [0,1], higher is steadier). `objetivo = 0.8` (cv 0.10), direccion `mayor`, scored with the same attainment/TOPE/points rule as every metric.
- Reference date: last day of the month for closed months, `HOY` for the month in progress. Fewer than 60 rolling points → `null`.
- The generator gives each seller a persistent `volatilidad` trait (lumpy days, month-to-month swings) so Constancia spreads across the whole range.

## Geography

`Sucursal` gains `provincia`. Mapping: CABA → Ciudad de Buenos Aires; San Martín, Morón, Quilmes, Junín, Bahía Blanca, Mar del Plata → Buenos Aires; Rosario, Santa Fe → Santa Fe; Paraná → Entre Ríos; Corrientes, Córdoba, Mendoza, Tucumán, Salta, Neuquén → their own province. `PROVINCIAS` lists `{ slug, nombre }`.

Scoring adds `puestoProvincia/deProvincia` per seller, sucursal `puestoProvincia`, and `provincias: ScoredProvincia[]` (mean of member seller scores, rank nacional).

## Goal tracker

- Goal score `meta` = `ajustes.meta_puntos` (default 80, the "Arriba" tier).
- `tracker(vendedorId, ventana: "mes" | "semana")` returns: window dates, working days total and elapsed, current score, `meta`, `faltan = max(0, meta - score)` (points, one decimal), `proyeccion` (score at the current pace at window end), per metric `{ valor, puntos, objetivo, alcanzado, faltanUnidades }`, and `sugerencias` (at most 3).
- **Pace projection** for `flujo` metrics: num and den scale by `diasHabiles / diasTranscurridos`; except venta's den (OV plan), which is known for the whole window. `stock` metrics: the current snapshot.
- **Suggestions.** For each active, actionable metric (not derivada) below objetivo: `n` = whole units of numerator change needed to reach objetivo on the projected window (mayor: `ceil(obj·den − num)`; menor: `ceil(num − obj·den)`). Gain = effective weight × (points at objetivo − current points). Effort = `n / den`. Pick metrics by gain/effort, highest first, until the summed gain closes `faltan`; at most 3. When `faltan = 0`, suggest the single cheapest metric still below objetivo, phrased as a figu to win. Text = `accion` with `{n}` filled (es-AR thousands separator).
- Weekly window: flujo metrics only.

## Figus v2 (Álbum)

- A figu = (seller, closed month, active metric incl. constancia) with attainment ≥ 1.
- Rarity by difficulty, share `p` of sellers with data that month who met that metric, ranked as a quantile over all (closed month, metric) cells: hardest 5 % legendaria, next 20 % épica, next 35 % rara, rest común; ties take the harder tier.
- Holográfica: met the same metric in this month and the two closed months before it.
- Foil edition: the national top 3 by points among those who met it get `medalla` oro/plata/bronce (existing tie rules).
- Figus are only earned where the **album** game is active for the seller's sucursal that month.

## Games

- `JUEGOS = liga | revelacion | album`. The goal tracker is a core feature, not a game.
- Tables: `juegos (id, nombre, activo)` for the global switch; `juegos_sucursal (juego, sucursal, desde, hasta?)` for activation intervals by month. `juegoActivo(config, juego, sucursal, periodoId)` = global on AND an interval covers the month.
- Seeded history (simulated, labelled as such): for each game, sucursales are split by hash into early (2025-10), mid (2026-02), late (2026-06) and never (control). Every game therefore has treated and control cells.
- Ground-truth effects the generator applies while a game is active for a sucursal-month (the analytics must recover them, roughly): liga +0.03 venta attainment; album +0.04 lanz and +0.02 venta; revelacion +0.05 venta for sellers in the bottom half of the previous month. Each effect scales with the seller's simulated engagement (1.5× for the top engagement third, 0.5× for the bottom third).

## Measuring games (admin "Juegos" page)

All three measures are available per seller and per sucursal, per game, by month.

1. **Effect on sales.** Two-way fixed effects on monthly cells: `y = α_unit + γ_month + β·activo`. Unit = sucursal (y = mean card score and mean venta attainment of members) or seller (y = card score, venta attainment). Estimate β by alternating demeaning. Report β, treated/control cell counts, and the same β in kilos per seller-month for venta. A game with no control cells reports "sin grupo de control".
2. **Engagement.** Table `engagement (fecha, vendedor_id, juego, evento, cantidad, fuente)`, `fuente = real | simulado`. Real events come from the seller view through a server action (daily upsert, count +1). Simulated rows are weekly totals (fecha = Monday) per seller per active game. Measures: active sellers / eligible sellers, events per active seller, month-over-month retention. The UI always labels simulated data.
3. **Prize value.** Table `premios (id, juego, periodo_id, descripcion, costo_ars, simulado)`. `ajustes.valor_kg_ars` (gross margin per kg, default 1800). Value = β_venta_kg × treated seller-months × valor_kg_ars; ROI = value / Σ costo_ars of that game's prizes.

## Settings

Table `ajustes (clave pk, valor double)`: `meta_puntos` (80), `valor_kg_ars` (1800).

## Auth (custom, no libraries)

- Seller: `/entrar` shows a picker ("Entrar como…") and a code + PIN form. PIN = 6 digits from `HMAC-SHA256(AUTH_SECRET, "pin:" + id)`; nothing stored. Session cookie `figu_s` = `id.exp.sig` (Web Crypto HMAC, httpOnly, sameSite lax, secure outside development, 7 days).
- Admin: `/admin` asks for `ADMIN_PASSCODE` (constant-time compare). Cookie `figu_a` = `admin.exp.sig`, 12 hours. If `ADMIN_PASSCODE` is unset, admin login is disabled with a plain message.
- `proxy.ts` redirects unauthenticated `/yo/*` to `/entrar` and `/admin/*` (except the login) to `/admin`. **Every** admin server action and admin GET route verifies the cookie again on the server.
- Known limit, stated in `/supuestos`: the demo picker lets anyone enter as any seller; no rate limit on PIN attempts.

## Data and caching

- New table `kpi_diarios (vendedor_id, fecha date, kpi, num, den)`, pk (vendedor_id, fecha, kpi). `kpi_resultados` stays as the monthly aggregate and is written from the same generated days. Invariant (tested): monthly flujo = Σ daily; monthly stock = last day's snapshot.
- Window aggregates (week, rolling 30 days) are computed in SQL; nothing loads all daily rows into memory except the venta series for Constancia (one metric).
- Mutations are server actions that call `updateTag` (`dataset`, `config`, `engagement`). Client reads are GET route handlers. React Query options stay centralised in `src/lib/query/options.ts`. Same caching rules as v1 (`"use cache"` + `cacheLife("hours")` + tags; React `cache()` for per-request dedupe).
- CSV import: the v1 monthly long format stays; an optional `fecha` column (YYYY-MM-DD) imports daily rows, and the monthly table is rebuilt from them.

## Screens

- **Gerencia (public, read only):** `/`, `/ranking` (scope nacional | provincia | sucursal; entity vendedores | sucursales | provincias), `/ranking/provincia/[slug]`, `/ranking/sucursal/[slug]`, `/kpi/[kpi]`, `/vendedor/[id]`, `/liga` (nacional | provincia), `/revelacion`, `/album`, `/como-funciona`, `/supuestos`.
- **Seller (`/yo`):** goal tracker (month and week), suggestions, Constancia, positions (sucursal, provincia, país), their figus, the games active in their sucursal. Pages that are switched off for the sucursal do not appear.
- **Admin (`/admin`):** Métricas (weights with live normalised %, add custom metric, activate), Juegos (global and per-sucursal switches; the measures dashboard with Tremor charts), Premios, Datos (CSV import and export, reseed, Simular cierre de mes).
- Charts: Tremor only.

## Out of scope

Weekly figus; per-seller custom goals; push notifications; any real La Virginia data.

## Contract

Fixed types and signatures for the parallel implementers. Stubs throw `new Error("not implemented")`; the owner fills the body without changing the signature. A signature change needs the architect (or the orchestrator) and a note here. Read the JSDoc in each file for the exact rules.

### File ownership

- generator: src/lib/seed/**, scripts/seed.ts, src/db/upsert.ts, src/db/map.ts
- scoring: src/lib/scoring/**, src/lib/time/**
- goals: src/lib/goals/**
- games: src/lib/games/**, src/lib/modes/** (album v2; liga, revelacion respect game activation and closed months)
- data: src/lib/data/**, src/lib/auth/**, src/lib/csv/**, src/proxy.ts, src/env.ts, src/lib/query/**, src/app/api/** (GET routes only)

`src/lib/domain.ts`, `src/db/schema.ts` and this section belong to the architect. Nobody else edits them; ask for a change instead.

### Compatibility rules

- Every v1 export keeps its name and shape: `KPI_IDS`, `KpiId`, `KpiDef`, `KPI_DEFS`, `KPI_TIE_ORDER`, `TOPE`, `scorePeriod(dataset, periodoId, vista)`, `rescore`, `album`, `Figu` (in `src/lib/modes/types.ts`), and the rest.
- Widened types (no call sites broke): `KpiResultado.kpi`, `KpiScore.kpi` are `MetricaId`; `ScoredVendedor.kpis` is `Record<MetricaId, KpiScore>` and **always holds the seven KPI_IDS** (inactive base metrics with null valor/puntos/puesto), so v1 UI that loops `KPI_IDS` keeps working.
- New fields on v1 types are optional so hand-built fixtures still compile; the v2 code paths always set them: `Sucursal.provincia`, `Periodo.enCurso`, `Dataset.metricas`, `ScoredVendedor.puestoProvincia/deProvincia`, `ScoredSucursal.puestoProvincia`, `ScoredPeriod.provincias`.
- `PERIODOS` now has 13 entries (2025-10 … 2026-10, the last with `enCurso: true`). Code that wants closed months uses `periodosCerrados()` / `ultimoPeriodoCerrado()`, never `PERIODOS.at(-1)`.
- `DatasetRows` in `src/db/map.ts` uses `$inferInsert` for sucursales, periodos and defs, so the new defaulted columns are optional there.

### src/lib/domain.ts (new exports)

- `HOY`: `"2026-10-24"`, a plain constant, safe on the client.
- `hoy()`: server "today", where `DEMO_HOY` (YYYY-MM-DD) overrides `HOY`. Use this on the server, never `new Date()`.
- `FECHA_INICIO`: `"2025-10-01"`, the first day of daily data.
- `periodoDe(fecha)`: the `"YYYY-MM"` of a date.
- `Periodo.enCurso?`: marks the month in progress. The live value comes from `periodos.en_curso` in the DB.
- `periodosCerrados(periodos = PERIODOS)`: closed periods, ascending.
- `ultimoPeriodoCerrado(periodos = PERIODOS)`: the latest closed id (`"2026-09"` by default), or null.
- `periodoEnCurso(periodos = PERIODOS)`: the open period, or null.
- `Provincia`, `PROVINCIAS`, `PROVINCIA_BY_SLUG`: the ten provinces (`caba`, `buenos-aires`, `santa-fe`, `entre-rios`, `corrientes`, `cordoba`, `mendoza`, `tucuman`, `salta`, `neuquen`).
- `PROVINCIA_DE_SUCURSAL`, `provinciaDe(sucursalSlug)`: map a sucursal slug to its province slug, or null.
- `Sucursal.provincia?`: set on every `SUCURSALES` entry.
- `MetricaId` (string), `TipoMetrica`, `Acumulacion`, `MetricaDef` (KpiDef fields plus `tipo`, `activa`, `orden`, `acumulacion`, `accion`, `unidad`).
- `CONSTANCIA_ID`: `"constancia"`.
- `ACCION_CUSTOM_DEFAULT`: `"Sumá {n} {num}"`.
- `metricasDe(defs)`: the seven base `MetricaDef`s from v1 `KpiDef`s. This is the v1 compat set, without constancia or custom metrics.
- `METRICAS_DEFAULT`: seven base metrics, plus constancia (derivada, 0.10, active), plus degus (custom, 0.05, inactive).
- `efectivo(defs)`: `Record<MetricaId, number>` with `peso / Σ peso` over active metrics. Inactive metrics are absent.
- `KpiDiario`: a row of `kpi_diarios`.
- `JUEGOS`, `JuegoId`, `JUEGO_LABEL`, `JuegoIntervalo`, `JuegosConfig` (`{ global, intervalos }`): game definitions and activation data.
- `Ajustes` (`{ meta_puntos, valor_kg_ars }`), `AJUSTES_DEFAULT` (80, 1800).
- `FuenteEngagement`, `EVENTOS_ENGAGEMENT` (`vista`, `interaccion`), `EventoEngagement`, `EngagementRow`: engagement types.
- `Premio`: a row of `premios`.
- `GeneratedV2`: everything the v2 generator returns and v2 `replaceDataset` writes.
- `Ventana`, `TrackerMetrica`, `Sugerencia`, `Tracker`: goal tracker output types.
- `ScoredProvincia`: a province ranked nationally.
- `Rareza`, `Medalla`: the same unions as in modes/types.
- `FiguV2`: a figu earned by meeting a goal.

### src/db/schema.ts

- `sucursales.provincia` is text with default `''`.
- `periodos.en_curso` is a bool with default false.
- `kpi_definiciones` gains `tipo` (default `base`), `activa` (true), `orden` (0), `acumulacion` (`flujo`), `accion` (`''`) and `unidad` (`''`).
- `kpi_diarios`: pk (vendedor_id, fecha, kpi), indexes on (fecha) and (vendedor_id, kpi, fecha), cascades with vendedores.
- `juegos`: id pk, nombre, activo.
- `juegos_sucursal`: pk (juego, sucursal, desde), `hasta` nullable, an index on sucursal, cascades with juegos and sucursales.
- `engagement`: pk (fecha, vendedor_id, juego, evento, fuente), an index on (juego, fecha).
- `premios`: id pk, an index on (juego, periodo_id), no FK to periodos.
- `ajustes`: clave pk, valor double.

### src/lib/time/index.ts (scoring)

- `Rango`, `VentanaMeta`: date range types.
- `sumarDias`, `diaSemana`, `esHabil`: day arithmetic, with Monday to Saturday as working days.
- `habilesEntre`, `diasHabiles`, `diasTranscurridos(r, ref)`: working-day lists and counts.
- `semanaIso`, `ventanaMes`, `ventanaSemana`, `ventanaDe(ventana, ref)`: month and ISO-week windows.
- `rolling30(fin)`, `finesRolling(ref, dias = 90)`: rolling 30-day windows and their end dates.
- `fechaReferencia(periodo, hoyFecha)`: the reference date of a period.

### src/lib/scoring (scoring)

- `scorePeriodV2(dataset, periodoId, vista, { defs, constancia? })`: the metric-driven scorer. It fills the province fields. Once it works, v1 `scorePeriod` becomes a wrapper around it with `defs: d.metricas ?? metricasDe(d.defs)`.
- `ScoreV2Opts`: the options type of `scorePeriodV2`.
- `CONSTANCIA` holds the constants: 90 days, a 30-day window, at least 60 points, a cv cap of 0.5.
- `FilaDiaria`: a daily `{ fecha, num, den }` row.
- `serieRolling(diarios, ref)`: the rolling attainment series for one seller.
- `constancia(series)`: the Constancia value, or null.
- `rankProvincias({ vendedores, sucursales })`: province ranks for sellers and sucursales, plus `provincias`.

### src/lib/goals/index.ts (goals)

- `AgregadoMetrica`: `{ num, den, denPlan }` for the elapsed part of the window.
- `TrackerInput`: `{ vendedorId, ventana: VentanaMeta, defs, ajustes, agregados, constancia }`.
- `tracker(input)`: returns a `Tracker`.
- `textoAccion(def, n)`: the suggestion text.

### src/lib/games/index.ts and src/lib/modes/album.ts (games)

- `juegoActivo(config, juego, sucursal, periodoId)`: whether a game is on for a sucursal in a month.
- `Celda`, `EfectoVentas`: input and output of the sales-effect estimate.
- `efectoVentas(celdas, opts?)`: the TWFE β, plus treated and control counts and `sinControl`.
- `EngagementMes`, `EngagementResumen`: engagement measure types.
- `engagementResumen(rows, juego, elegibles)`: engagement measures for one game.
- `ValorPremios`: the prize value output.
- `valorPremios({ juego, betaKg, vendedorMesesTratados, premios, ajustes })`: the value and ROI of a game's prizes.
- `figusV2(periods, dataset, defs, juegos)` in `album.ts`: returns `FiguV2[]`.

### src/lib/auth/index.ts (data)

- `SESSION_COOKIE` (`figu_s`), `ADMIN_COOKIE` (`figu_a`), `ADMIN_SUB`: cookie names and the admin subject.
- `SESSION_MAX_AGE` (7 days), `ADMIN_MAX_AGE` (12 hours): max ages in seconds.
- `Sesion`: the decoded session type.
- `signSession(sub, maxAgeSec, secret, nowMs?)`: signs a session token.
- `verifySession(token, secret, nowMs?)`: checks a token and returns the session, or null.
- `pinDe(id, secret)`: a seller's 6-digit PIN.
- `checkAdminPasscode(input, passcode)`: the admin passcode check.

### src/lib/data/windows.ts (data)

- `readAgregadosVentana(vendedorId, ventana, defs)`: one seller's window aggregates, as `Record<MetricaId, AgregadoMetrica>`.
- `readSerieVenta(desde, hasta)`: every seller's venta daily rows.
- `readSerieVentaDe(vendedorId, desde, hasta)`: one seller's venta daily rows.
- `readConstancias(ref)`: Constancia per seller at a reference date.
- `readUltimaFecha()`: the latest date in `kpi_diarios`.

### Signature changes made during implementation (recorded at sign-off)

- `Figu` (modes/types.ts) is now `FiguV2 & { kpi: MetricaId; ambito }`, so `medalla` is **optional**: only the national top 3 among figu holders get one. This breaks the "Figu keeps its shape" rule on purpose. Readers map a missing medal to no medal (see `src/app/page.tsx`, `AlbumUi`).
- `tracker(input)` returns `TrackerResultado = Tracker & { inalcanzable: boolean; descartadas: MetricaId[] }`. It drops a metric from the suggestions when the `n` it needs is more than the remaining working days (today included) can give.
- `album`, `liga` and `revelacion` take an optional third argument, `juegos?: JuegosConfig`. Without it, every game counts as on everywhere. They all drop the month in progress. `queries.ts` passes the live config to liga, revelación and álbum.
- `replaceDataset(input, meta)` takes a v1 `Dataset` or `{ dataset, ...Partial<rest of GeneratedV2> }`, and returns a row count per table.
- `generateV2(seed = 42, hasta = HOY)`. `generate(seed)` (v1 shape) is a view of it. The generator also exports `EFECTOS`, `ENGAGEMENT_MULT`, `ROLLOUT` and `JUEGOS_SEED`.
- `rescore(scored, pesos)`: `pesos` is `Record<MetricaId, number>`, and rescore also recomputes the province layer. `attainment(def, valor)` takes `Pick<KpiDef, "direccion" | "objetivo">`.
- `parseCsv(text, defs = METRICAS_DEFAULT)` also returns `diarios`.
- `getSeasonMeta()` lists closed months with data only, and has an `enCurso` field. `/api/ranking` answers 400 for a period that is in progress or has no data.
- Verification of the seeded data: `bun scripts/verify-v2.ts` (read only; exits 1 when a check fails).

### Open point: venta OV plan in the month in progress

The spec projects venta with the whole-window plan (`denPlan`), but no table stores a future plan, and `kpi_diarios` has no rows after `HOY`. Until someone decides where the plan is stored, `readAgregadosVentana` returns `denPlan: null` and `tracker` scales venta's den like any other flujo metric. If the generator writes a plan, the place for it is a new `kpi_diarios` kpi id, `venta_plan`, holding the planned den for every working day of the open month. That needs this section updated first.
