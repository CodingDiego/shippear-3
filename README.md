# Figu

Ranking de vendedores como cartas de jugador. Caso La Virginia, Shippe.ar Hackathon #3 (Rosario, 2026-10-24).

- What we want: [docs/SPECS.md](docs/SPECS.md)
- Where we are: [docs/PROGRESS.md](docs/PROGRESS.md)
- Case brief: `CASE/`

## Run

```sh
bun install
cp .env.example .env.local   # or vercel env pull
bun run db:push && bun run db:seed
bun run dev
```

`bun run check` runs biome, tsc and vitest. `bun run test:e2e` runs Playwright against dev; `PW_MODE=prod` against a local prod build; `PLAYWRIGHT_BASE_URL=<url>` against a deployment.
