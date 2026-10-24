import { expect, type Page, test } from "@playwright/test";
import { pinDe } from "../src/lib/auth";

// Secrets come from the env (bun --env-file=.env.development.local), never from this file.
const pinSecret = process.env.PIN_SECRET ?? process.env.AUTH_SECRET;
const passcode = process.env.ADMIN_PASSCODE;

/** 390 on the mobile project, 1440 on desktop, then no element may widen the page. */
async function sinOverflow(page: Page, mobile: boolean) {
	await page.setViewportSize(
		mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
	);
	const { scroll, client } = await page.evaluate(() => ({
		scroll: document.documentElement.scrollWidth,
		client: document.documentElement.clientWidth,
	}));
	expect(scroll, `${page.url()} overflows`).toBeLessThanOrEqual(client);
}

const PUBLICAS = [
	"/",
	"/entrar",
	"/admin",
	"/ranking",
	"/ranking?scope=provincia&provincia=santa-fe",
	"/ranking?scope=sucursal&sucursal=rosario",
	"/ranking?entidad=provincias",
	"/ranking/provincia/santa-fe",
	"/ranking/sucursal/rosario",
	"/kpi/venta",
	"/vendedor/V001",
	"/liga",
	"/liga?modo=provincia",
	"/revelacion",
	"/album",
	"/como-funciona",
	"/supuestos",
];

for (const ruta of PUBLICAS) {
	test(`${ruta} has no horizontal overflow`, async ({ page, isMobile }) => {
		const res = await page.goto(ruta);
		expect(res?.status()).toBe(200);
		await expect(page.locator("h1").first()).toBeVisible();
		await sinOverflow(page, isMobile);
	});
}

test("seller logs in with code and PIN, sees the tracker and claims an item", async ({
	page,
	isMobile,
}) => {
	test.skip(!pinSecret, "PIN_SECRET or AUTH_SECRET not in the env");
	// One seller per project so parallel runs never claim the same item.
	const id = isMobile ? "V002" : "V001";
	await page.goto("/entrar");
	await page.getByLabel("O escribí tu código").fill(id);
	await page
		.getByLabel("PIN de 6 números")
		.fill(await pinDe(id, pinSecret as string));
	await page.getByRole("button", { name: "Entrar a mi mes" }).click();
	await expect(page).toHaveURL(/\/yo$/);
	await expect(page.locator(".tracker").first()).toBeVisible();
	await sinOverflow(page, isMobile);

	const reclamar = page.getByRole("button", { name: "Reclamar" }).first();
	await expect(reclamar).toBeVisible();
	await reclamar.click();
	await expect(page.getByRole("dialog", { name: "Reclamaste" })).toBeVisible();
});

test("admin logs in and goes through Métricas, Juegos and Datos", async ({
	page,
	isMobile,
}) => {
	test.skip(!passcode, "ADMIN_PASSCODE not in the env");
	await page.goto("/admin");
	await page.getByLabel("Clave de administración").fill(passcode as string);
	await page
		.getByRole("button", { name: "Entrar a la administración" })
		.click();
	await expect(
		page
			.getByRole("navigation", { name: "Administración" })
			.getByRole("link", { name: "Métricas" }),
	).toBeVisible();
	await sinOverflow(page, isMobile);

	// Toggle a metric and back without saving, so the shared dev data stays put.
	await page.goto("/admin/metricas");
	await expect(page.getByRole("heading", { name: "Métricas" })).toBeVisible();
	const sw = page.locator(".adm-met-list .switch").first();
	const antes = await sw.getAttribute("aria-pressed");
	await sw.click();
	await expect(sw).not.toHaveAttribute("aria-pressed", antes ?? "");
	await sw.click();
	await expect(sw).toHaveAttribute("aria-pressed", antes ?? "");
	await sinOverflow(page, isMobile);

	await page.goto("/admin/juegos");
	await expect(page.locator("#jg-efecto")).toBeVisible();
	await expect(page.locator(".recharts-surface").first()).toBeVisible();
	await sinOverflow(page, isMobile);

	await page.goto("/admin/datos");
	await expect(
		page.getByRole("heading", { name: "Exportar CSV" }),
	).toBeVisible();
	await sinOverflow(page, isMobile);

	await page.goto("/admin/premios");
	await expect(page.locator("h1").first()).toBeVisible();
	await sinOverflow(page, isMobile);
});

test("ranking scope tabs switch between País, Provincia and Sucursal", async ({
	page,
}) => {
	await page.goto("/ranking");
	const alcance = page.getByRole("group", { name: "Alcance del ranking" });
	for (const [label, scope] of [
		["Provincia", "provincia"],
		["Sucursal", "sucursal"],
		["País", "pais"],
	] as const) {
		const tab = alcance.getByRole("button", { name: label });
		await tab.click();
		await expect(tab).toHaveAttribute("aria-pressed", "true");
		if (scope === "pais") await expect(page).not.toHaveURL(/scope=/);
		else await expect(page).toHaveURL(new RegExp(`scope=${scope}`));
	}
});

test("province page lists its sucursales and unknown provinces 404", async ({
	page,
}) => {
	const res = await page.goto("/ranking/provincia/santa-fe");
	expect(res?.status()).toBe(200);
	await expect(page.locator("h1")).toHaveText("Santa Fe");
	await expect(page.locator("table").first()).toBeVisible();
	const nope = await page.goto("/ranking/provincia/nope");
	expect(nope?.status()).toBe(404);
});
