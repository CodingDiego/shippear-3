# Figu · progress

Where we are against `SPECS.md`. Updated after every phase. Dates are 2026-10-24 unless noted.

| Phase                                                           | Status      | Evidence                                                                                       |
| --------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| 0 Bootstrap (repo, Vercel, Neon, Blob, envs, bun/lockfile)      | done        | PR #1, PR #2 merged; prod https://shippear-3.vercel.app; e2e green on dev/prod/preview         |
| 1 Design gate (4 mocks, tokens, fonts)                          | in progress | mocks on the Figu canvas (https://claude.ai/artifact/E9nGarBSa1HmyM75nYWtNE), awaiting user OK |
| 2 Engine (domain, scoring, generator, CSV, schema, seed, modes) | done        | W1 + review: `bun run check` green (13 files, 88 tests); DEV seeded with seed 42               |
| 3 Ranking UI (card, skeletons, data layer, pages, OG)           | pending     |                                                                                                |
| 4 Landing + modes + hero Player                                 | pending     |                                                                                                |
| 5 Cierre de mes workflow, admin gate, CSV import, clip download | pending     |                                                                                                |
| 6 Hardening (responsive pass, e2e, security review, PR)         | pending     |                                                                                                |

## Checklist

- [x] `src/lib/domain.ts` contract
- [x] `src/lib/scoring` + tests
- [x] `src/lib/seed` generator + `src/lib/csv` + tests
- [x] `src/db` schema, client, drizzle config, `scripts/seed.ts`, dev DB seeded
- [x] `src/lib/modes` (liga, revelacion, album) + tests
- [ ] `src/styles/tokens.css`, fonts, `SellerCard` + skeleton
- [ ] data layer (`queries.ts`, `db-reads.ts`, nuqs loaders, query options, GET routes)
- [ ] `/ranking`, `/ranking/sucursal/[slug]`, `/kpi/[kpi]`, `/vendedor/[id]` + OG
- [ ] `/` landing with sliders + hero Player
- [ ] `/liga`, `/revelacion`, `/album`, `/supuestos`
- [ ] cierre-mes workflow + `/admin` (HMAC gate, reseed, CSV import)
- [ ] clip download (web renderer)
- [ ] responsive pass 360/768/1440, e2e dev + prod + preview
- [ ] security review, user OK, commit, PR

## Open

- ADMIN_PASSCODE not yet set in any env.
- PREVIEW and PRODUCTION databases: run `db:push` then `db:seed` per env before Phase 6 e2e (schema moved to double precision; only DEV is pushed and seeded).
- Clásicos are decided by persistent skill plus pool size (Interior has 12 sucursales to AMBA's 4), so one side wins most of the 12 fixtures even with monthly shocks in the generator. Decide: accept, or play duels on form (KPI points minus the seller's own season average).
- Liga rule changed from `max` to `min(9, ⌈.75·months since alta⌉)` so mid-season hires can qualify; SPECS updated.
- Unused deps to drop after clips decision: `@remotion/vercel`, `@vercel/sandbox`.

## v2 engine

Integration sign-off, 2026-10-24. Five implementers filled the engine against `docs/SPEC-V2.md` in parallel. The numbers below come from `bun scripts/verify-v2.ts` on the DEVELOPMENT database (seed 42, through `HOY`). Nothing committed.

- `bun run check`: green. Biome 0 errors (18 CSS warnings), tsc clean, vitest 20 files and 189 tests.
- Seed (`bun run db:seed`, 94 s over Neon HTTP): sucursales 16, vendedores 139, periodos 13 (only `2026-10` en curso), kpi_definiciones 9, kpi_resultados 14000, kpi_diarios 359504 (2025-10-01 .. 2026-10-24, 0 Sunday rows), juegos 3, juegos_sucursal 36, engagement 10235, premios 39, ajustes 2, dataset_meta 1.
- Monthly == daily: 50 random seller-months per stored metric, 400 of 400 match (flujo = sum of days; stock = the last day's snapshot).
- Constancia across 139 sellers: at 2026-09-30 min 0.00, p25 0.55, median 0.72, p75 0.88, max 0.97. At `HOY` min 0.00, p25 0.56, median 0.72, p75 0.87, max 0.97.
- Monthly card score (vista mes, 12 closed months, live defs with Constancia, 1611 seller-months): p05 59.1, median 78.6, p95 93.6; 13.0% under 65, 44.6% at 80 or above, 0.0% at 100.
- `efectoVentas` against the seeded truth (TWFE with one game dummy per fit, as the admin page computes it):

  | game       | metric | truth | β sucursal | β vendedor |
  | ---------- | ------ | ----- | ---------- | ---------- |
  | liga       | venta  | 0.030 | 0.035      | 0.037      |
  | revelacion | venta  | 0.025 | 0.010      | 0.011      |
  | album      | venta  | 0.020 | 0.009      | 0.013      |
  | album      | lanz   | 0.040 | 0.038      | 0.032      |

  Every β is positive and within 0.03 of its truth. Each game has 96 treated and 96 control sucursal-months, and about 820 treated and 790 control seller-months. The revelación truth is half of +0.05, because only the bottom half qualifies. On seed 42, revelación venta and álbum venta come out at about half their truth. Across seeds the generator owner measured an sd of about 0.025, so a single seed recovers them only roughly.
- Goal tracker, month in progress (21 of 27 working days) and week 2026-10-19..25 (6 of 6):
  - V023, above meta: mes 96.0, faltan 0, "Conseguí que 1 cliente más compre y ganá la figu de Clientes no compradores"; semana 98.3, no suggestion.
  - V054, short: mes 77.0, faltan 3, "Conseguí que 5 clientes más compren"; semana 88.8, "Cerrá 7 pedidos más en tus visitas y ganá la figu de Productividad".
  - V095, far: mes 59.8, faltan 20.2, inalcanzable, "Conseguí que 38 clientes más compren", "Vendé lanzamientos a 86 clientes más", "Completá 2 encuestas". Semana 52.1, faltan 27.9, inalcanzable, no suggestion: every metric needs more than the week's last working day can give.
  - `proyeccion` equals `score` in every case. With `denPlan` null, flujo num and den scale by the same factor, so the pace projection cannot move the ratio (see the open point in SPEC-V2).
- Figus v2 (closed months, album active only): 1804 in total. By rarity: rara 911, épica 837, común 56, legendaria 0. By metric: venta 366, prod 166, no_comp 193, lanz 199, no_entr 263, cobr 138, relev 188, constancia 291. 860 are holográficas and 285 have a medalla. None fall in the month in progress or outside an album-active sucursal-month.
- Routes on the running dev server all return 200 with no "undefined" or "NaN" in rendered text or attributes: `/`, `/ranking`, `/ranking/sucursal/rosario`, `/kpi/venta`, `/vendedor/V001`, `/liga`, `/revelacion`, `/album`, `/como-funciona`, `/supuestos`, `/api/ranking`. On cold caches the dev log shows `Route "/": A "use cache" function took too long during prerendering`. `/` took 15.5 s cold and 0.16 s warm.

### Open after v2 engine

- Clásicos is deleted (code, route, CSS, tests); figu rarity is now a quantile of p over the season.
- Seed 42 never produces a legendaria figu: in no month is a metric met by fewer than 10% of sellers.
- On a Saturday, the weekly tracker gives a far seller no suggestion at all.
- Fixed at sign-off: `getLiga`, `getRevelacion` and `getAlbum` now pass the live `JuegosConfig`, so `/liga`, `/revelacion`, `/album` and the home fragments count only sucursal-months where the game is on. `getClasicos` still runs without one.
- The `/album` and landing copy still describes v1 figus (for example "Legendaria: oro nacional").
- A cold `getSeason` is slow: it scores 12 months, and each one reads the venta series for Constancia. `next build` was not run, so it is unverified whether prerendering `/` stays under the `"use cache"` timeout.
- After the seed, the dev server served stale Constancia for a while, because the cache filled while the seed was still writing. A restart or `updateTag("dataset")` clears it.
- Not built yet: the `reclamos` table, the `reclamo` engagement event, and the `/yo` and `/admin` pages.

## v2 engine fixes

Sign-off of the engine fixes (Clásicos removal, rarity by quantile, materialised Constancia, planes and pace, claims, month close), 2026-10-24, against the DEVELOPMENT database. Nothing committed.

- `bun run check`: tsc clean, vitest 21 files and 203 tests. Biome is not green yet: the engine files pass (16 CSS warnings), but UI agents were still editing their files during this run. At 16:15 the errors were format-only, in `src/app/admin/page.tsx` and in two untracked `playwright.rk*.tmp.mjs` scratch files in the repo root, all changed in the last minute. Run `bun run check` again once those agents finish.
- Fixed at sign-off: `readPlanes` in `src/lib/data/windows.ts` now queries the `planes` table through the schema. The raw-SQL read that treated a missing table as "no plan" is gone, since the table exists.
- No reseed was needed: the data agent's seed already includes planes, and the goals and rarity changes are read-time only. `drizzle-kit push` applied no schema change. Row counts: sucursales 16, vendedores 139, periodos 13, kpi_definiciones 9, kpi_resultados 14000, kpi_diarios 359504, juegos 3, juegos_sucursal 36, engagement 11225, premios 39, ajustes 2, dataset_meta 1, planes 1750, constancias 1807, reclamos 0.
- `bun scripts/verify-v2.ts` (23 s): all checks passed, including these new ones:
  - No `clasicos` row in juegos, juegos_sucursal, engagement or premios.
  - Rarity tiers by (month, metric) cell: legendaria 5 of 95 (5.3 %), épica 19 (20.0 %), rara 33 (34.7 %), común 38 (40.0 %). One of the 96 cells had nobody meeting it, so it has no figus and no tier. By figu (album-active only): común 927, rara 537, épica 284, legendaria 56.
  - Month in progress: `proyeccion` differs from `score` for 139 of 139 sellers (V023 95.64 vs 96.03, V054 77.12 vs 76.97).
  - `reclamar()` round trip on V013 `2025-10:venta`: true the first time, false on repeat, exactly one real `reclamo` event. The claim row and the event are deleted afterwards.
  - `constancias` table: one row per seller-month (1807), and 20 of 20 random rows match `constancia(serieRolling(...))` in value and reference date.
- `bun --env-file=.env.development.local x next build`: exit 0 in 42 s (compile 18.9 s, 59 static pages in 10.2 s). No "took too long" or blocking-route errors. Next loads `.env.local` over `.env.production`, so the build reads the same database as the scripts. Routes: `/`, `/album`, `/revelacion`, `/entrar`, `/kpi/venta`, `/kpi/prod` static (1h / 1d); `/admin/*`, `/liga`, `/ranking`, `/ranking/provincia/*`, `/ranking/sucursal/*`, `/vendedor/[id]`, `/yo` partial prerender; `/api/*`, `/admin/juegos/medidas` and the workflow routes dynamic.
- `grep -ri clasic src e2e`: no matches.

## v2 screens

Integration sign-off, 2026-10-24, against the DEVELOPMENT database. Nothing committed.

### Routes

- Public: `/` (hero animation), `/ranking` (Alcance tabs País / Provincia / Sucursal, Vendedores / Sucursales / Provincias), `/ranking/provincia/[slug]`, `/ranking/sucursal/[slug]`, `/kpi/[kpi]`, `/liga` (Nacional / Por provincia), `/revelacion`, `/album`, `/vendedor/[id]` (card reveal on open), `/como-funciona`, `/supuestos`.
- Seller: `/entrar` (sucursal and name picker, or code plus PIN), then `/yo`: Mes and Semana tracker, Constancia, puestos in país, provincia and sucursal, this month's Figu card, figus of the season, and Reclamar with the prize animation. `/yo` without the `figu_s` cookie redirects to `/entrar`.
- Admin: `/admin` (passcode form, then the overview), `/admin/metricas` (switch metrics on and off, weights, goal and margin per kg, seller table), `/admin/juegos` (games ranked by sales effect, switches per sucursal, Tremor charts), `/admin/premios`, `/admin/datos` (CSV import and export, Simular cierre, Reiniciar demo). Every `/admin/*` page, action and route checks the `figu_a` cookie on the server.

### Logging in (no secret values here)

- Seller: the PIN is not stored. It is `pinDe(codigo, PIN_SECRET ?? AUTH_SECRET)`. To get one in dev, run `bun --env-file=.env.local --env-file=.env.development.local -e 'import { pinDe } from "./src/lib/auth"; console.log(await pinDe("V001", process.env.PIN_SECRET ?? process.env.AUTH_SECRET))'`, then enter `V001` and that PIN on `/entrar`.
- Admin: open `/admin` and enter the value of `ADMIN_PASSCODE` (in `.env.development.local` for dev, the Secret Store for other envs). Without `ADMIN_PASSCODE` set, admin login is off.

### What is simulated

- All sales data: 139 sellers, 16 sucursales, 13 months (October 2025 to October 2026), generated with seed 42. October 2026 is the month in progress.
- The games history: when each sucursal turned each game on is seeded, and the generator applies known effects while a game is on (see "Games" in SPEC-V2). `/admin/juegos` says so on the page.
- Engagement: every row is `fuente = simulado` until sellers use `/yo`. Real `vista` and `reclamo` events come from `/yo`.
- Prizes: the seeded `premios` rows are marked `simulado`; edits on `/admin/premios` are real rows.
- Simular cierre fills the rest of the month with generated days and closes it; Reiniciar demo reseeds with seed 42.

### Checks at sign-off

- `bun run check`: biome 185 files, 0 errors (16 CSS specificity warnings); tsc clean; vitest 21 files, 203 tests passed.
- e2e: `bun --env-file=.env.development.local x playwright test` against the running dev server: 68 passed (desktop and mobile). Specs in `e2e/v2.spec.ts`: seller login with code and PIN (computed in the test from the env), tracker visible, one claim; admin login, Métricas toggle (switched back, not saved), Juegos charts, Datos, Premios; ranking scope tabs; `/ranking/provincia/santa-fe` and a 404 for an unknown province; 17 public routes at 390 and 1440 with no horizontal overflow, plus `/yo` and each admin page. The seller spec claims one item for V001 and one for V002 per run, so the pending list shrinks until the next Reiniciar demo.
- `playwright.config.ts` now calls `loadEnvConfig(cwd, true)` against the dev server. `bun --env-file` does not reach the processes `bun x` starts, so the env files have to be loaded inside the config.
- `bun --env-file=.env.development.local x next build`: exit 0, 59 static pages, no timeout or blocking-route errors. For the same reason, the `--env-file` vars do not reach `next`; the build reads `DATABASE_URL` from `.env.local` (over `.env.production`), which is the database the dev server uses.
- `grep -ri "clasic\|@remotion/vercel\|@vercel/sandbox" src e2e package.json`: no matches.
