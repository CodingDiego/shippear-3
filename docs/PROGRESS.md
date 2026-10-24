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
