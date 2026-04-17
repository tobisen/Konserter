import { expect, test } from "@playwright/test";

test.describe("Admin guard and info", () => {
  test("admin page requires admin login when logged out", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("soundcheck_locale", "sv"));
    await page.goto("/");
    await page.getByRole("button", { name: /Öppna meny|Open menu/ }).click();
    await page.getByRole("button", { name: /^Admin$/ }).click();

    await page.getByRole("heading", { name: /^Admin$/ }).waitFor({ timeout: 5000 });

    await expect(
      page.getByText("Du behöver logga in som admin för att se denna vy."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin-inloggning" })).toBeVisible();
  });
});
