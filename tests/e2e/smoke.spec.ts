import { expect, test } from "@playwright/test";

test("homepage basic smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Soundcheck")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Spelningar$/ }),
  ).toBeVisible();
});

test("favicon is loaded", async ({ page }) => {
  await page.goto("/");

  const faviconLink = page.locator('link[rel="icon"]');
  await expect(faviconLink).toHaveAttribute("href", /favicon\.svg/);
});
