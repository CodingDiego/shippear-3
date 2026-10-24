import { expect, test } from "@playwright/test";

test("home page renders the app, not an auth wall", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { level: 1, name: "Ranking de Vendedores" }),
	).toBeVisible();
});
