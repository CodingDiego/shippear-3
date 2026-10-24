import { expect, test } from "@playwright/test";

const ROUTES = [
	"/",
	"/ranking",
	"/ranking/sucursal/rosario",
	"/kpi/venta",
	"/vendedor/V001",
	"/liga",
	"/revelacion",
	"/album",
	"/como-funciona",
	"/supuestos",
];

for (const route of ROUTES) {
	test(`${route} renders`, async ({ page }) => {
		const res = await page.goto(route);
		expect(res?.status()).toBe(200);
		await expect(page.locator("h1").first()).toBeVisible();
		await expect(page.locator("body")).not.toContainText("Application error");
	});
}

test("unknown vendedor responds 404", async ({ page }) => {
	const res = await page.goto("/vendedor/nope");
	expect(res?.status()).toBe(404);
});

test("ranking Tabla control switches to a table", async ({ page }) => {
	await page.goto("/ranking");
	await page.getByRole("button", { name: "Tabla" }).click();
	await expect(page.locator("table").first()).toBeVisible();
	await expect(page).toHaveURL(/view=tabla/);
});
