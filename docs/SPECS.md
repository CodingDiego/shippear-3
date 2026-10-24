# Figu · specs

Caso **La Virginia · Ranking de Vendedores** (Shippe.ar Hackathon #3, Rosario, 24-10-2026).
Source: `CASE/Shippear3_CLVSA_Ranking_Vendedores_V2.pdf`. This file is what we want; `PROGRESS.md` is where we are.

## What the case asks for

- A web app that **loads** monthly KPI data and shows the ranking as **player cards**: general, por sucursal, por KPI.
- A **card per vendedor** with their score, seven KPIs and their rank in each.
- Score: each KPI becomes a 0–100 attainment against its target (cap 110%); the card score is the weighted sum. Weights and targets live in the dataset.
- Input: anonymised scorecard sheets, 16 sucursales, ~140 vendedores, mes + acumulado.
- PLUS: game modes so the ranking lives all year (Liga anual, Revelación del mes, Álbum de figuritas, Clásicos y derbis). We build all four.

## Decisions

| Topic   | Decision                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Name    | **Figu**                                                                                                                    |
| Data    | Synthetic, deterministic generator. CSV import kept open (admin page) so real scorecard sheets can be loaded later.         |
| DB      | Neon (gru1) + Drizzle. Scores are computed on read, never stored.                                                           |
| Clips   | Browser-rendered download ("Descargar clip") with Remotion web renderer. No server rendering.                               |
| Hero    | Remotion `<Player>` on the landing, poster fallback, pauses off-screen.                                                     |
| Auth    | None for reading. Admin actions behind an HMAC signed cookie (`AUTH_SECRET`), passcode `ADMIN_PASSCODE`. No auth libraries. |
| Regions | Everything in São Paulo (`gru1`).                                                                                           |
| Commits | One branch `FEATURE/figu-app`, nobody commits during workflows, one security review and one user OK at the end.             |

## KPIs

Stored as `{num, den}` per vendedor × periodo × kpi; `valor = num/den`; acumulado = Σnum/Σden since season start.

| kpi     | peso | objetivo | dir   | num / den                                 |
| ------- | ---- | -------- | ----- | ----------------------------------------- |
| venta   | .30  | 1.00     | mayor | kilos vendidos / kilos objetivo           |
| prod    | .10  | .70      | mayor | pedidos / visitas                         |
| no_comp | .15  | .10      | menor | no compradores / clientes activos         |
| lanz    | .15  | .75      | mayor | compraron lanzamientos / clientes activos |
| no_entr | .10  | .02      | menor | no entregados / pedidos                   |
| cobr    | .15  | .90      | mayor | cobradas en plazo / vencidas              |
| relev   | .05  | .95      | mayor | encuestas hechas / asignadas              |

**Formulas** (`src/lib/scoring`, pure, shared by server, client sliders and Remotion):
- attainment: mayor `v/obj`, menor `obj/v` (v = 0 → tope). Clamped to `[0, 1.10]`.
- `puntos = 100 · att / 1.10` (on target → 90.9, ≥110% → 100).
- vista `mes | acum | mix`, `mix = pesoMes·mes + (1−pesoMes)·acum` (one side null → the other).
- card score `Σ w·p / Σ w` over non-null KPIs; null if < 50% of weight available.
- tiers: ≥80 verde "Arriba", 65–79 amarillo "En carrera", <65 rojo "Abajo".
- ties: unrounded score → KPI points in `KPI_TIE_ORDER` → vendedor id. Per-KPI: value (direction-aware) → larger den → id.
- sucursal score: mean of member scores.

## Game modes (`src/lib/modes`, derived from monthly mes-only scores)

- **Liga anual / Balón de Oro.** Vendedor: mean of monthly scores, eligible with ≥ `min(9, ⌈.75 · months since alta⌉)` months (a mid-season hire needs 75% of their own months). Ties: more months → median → best month. Sucursal: mean of member means, ≥3 members. Botín per KPI: best mean KPI points.
- **Revelación del mes.** absoluta Δ score; relativa `Δ/(100−prev)` (Δ>0, prev<99.5); racha ≥3 consecutive Δ>0; remontada del año `max(pos_i) − pos_now`, ≥6 months.
- **Álbum.** Monthly top 3 per KPI, national and per sucursal. Rarity: legendaria (oro nac.) / épica (plata, bronce nac.) / rara (oro suc.) / común (plata, bronce suc.). Holográfica: oro in the same KPI 3 months running. Grid 7 KPI × 12 months; completion = KPIs with a medal / 7.
- **Clásicos y derbis.** Monthly fixtures: Plaza vs Campaña, Interior vs AMBA (best 11 each), vecinas (top `min(5,|A|,|B|)`). Goals = KPI duels won on team mean points (gap < 1 pt = no goal). Table PJ G E P GF GC DG Pts (3/1/0).

## Screens and URL state

`/` landing (hero + live weight sliders over the real top 10) · `/ranking` (podium, grid/table) · `/ranking/sucursal/[slug]` · `/kpi/[kpi]` · `/vendedor/[id]` (+ OG image, clip download) · `/liga` · `/revelacion` · `/album` · `/clasicos` · `/supuestos` · `/admin`.

nuqs: `?periodo=&vista=mes|acum|mix&sucursal=&canal=&view=grid|tabla`.

## Architecture rules

- Next 16 cache components: `"use cache"` + `cacheLife` + `cacheTag("dataset", "periodo:<id>")` in `src/lib/data/queries.ts`; React `cache()` for per-request DB dedupe in `src/lib/data/db-reads.ts`.
- **Mutations are server actions**; they invalidate with `updateTag`. **Reads for the client are GET route handlers**. `revalidateTag(tag, "max")` only inside workflow steps / route handlers.
- React Query: centralized `queryOptions` in `src/lib/query/options.ts`; `useSuspenseQuery` under Suspense + custom error boundary; `getQueryClient()` singleton (`React.cache` on the server, module singleton in the browser) with hydration.
- Singleton DB client in `src/db/client.ts`.
- Every uncached read sits behind a granular `<Suspense>` whose fallback is the same component in a loading state (no layout shift).
- `src/components/card/SellerCard.tsx` is pure (props only); used by pages, Player and clip.

## Data format (CSV, long)

Columns: `vendedor,nombre,apellido,sucursal,canal,alta,periodo,kpi,num,den`. Separator `,` or `;` (auto-detected), decimals `.` or `,`. `sucursal` is the slug, `canal` is `plaza|campaña`, `alta`/`periodo` are `YYYY-MM`, `kpi` is one of the seven ids. The generator exports the same format, so a real scorecard export can replace it.

## Supuestos (to confirm with the organizers)

- PROD is pedidos/visitas as a ratio; the PDF's "3,8" is probably pedidos per día. We show %.
- LANZ is shown as coverage (higher is better), matching the PDF colouring.
- Tope: 110% attainment → 100 points, linear below.
- Tier thresholds 80/65 are ours; configurable.

## Anti-slop (design)

Dark "night pitch" navy, OKLCH tiers, Big Shoulders + Archivo, tabular numerals, 5/7 cards with container queries, flip by button. No gradients except foil, no glow/glass/violet, no pill eyebrows, no emoji, no clip-art, no fake stats, no "→" CTAs, no La Virginia logos (text credit only). es-AR voice.

## Audience and surfaces (user, 2026-10-24)

- The PDF specifies no vendor-facing or admin UI. The app is **read-only for everyone** and built from a management point of view (gerencia comercial, jefes de sucursal): the cards are the product.
- `/admin` is the minimum needed to run the demo: reseed, "Simular cierre de mes", CSV import. No user accounts.
- Phase 1 ships a fourth artifact, `designs/flow.html`, showing how a gerente moves through the app (landing → ranking → sucursal → carta → modos).
- **Charts: Tremor only** (Tremor Raw copy-paste components or the `@tremor/react` package). No other chart library, no hand-rolled SVG charts. The card itself has no chart; evolution views (Revelación, Liga) use Tremor.

## Propuestas de modos extra (2026-10-24, pendientes de elección)

The organisers allow new game modes as long as they follow the main idea. Candidates, all derived from monthly scores (no new input):

- **Mundial de sucursales.** The last four months of the season are a bracket: 16 sucursales seeded by Liga position, one round per month, each tie decided by the sucursal mean score that month. Cheap: reuses `ScoredPeriod.sucursales`.
- **Invicto.** A streak counter on the card: consecutive months in verde (≥ 80). Breaks on a yellow month. Cheap: a fold over `ScoredPeriod[]`.
- **Fantasy 5.** Each jefe picks five vendedores from other sucursales at the start of the month; the sum of their puntos is the fantasy score. Needs a picks table and a form, so only if time allows.
