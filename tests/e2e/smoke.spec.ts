import { expect, test } from "@playwright/test";

test("homepage basic smoke", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("soundcheck_locale", "sv"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^SOUNDCHECK$/ })).toBeVisible();
  await expect(
    page.locator(".header-quick-nav").getByRole("button", { name: /^Spelningar$/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^SV$/ })).toBeVisible();
});

test("favicon is loaded", async ({ page }) => {
  await page.goto("/");

  const faviconLink = page.locator('link[rel="icon"]');
  await expect(faviconLink).toHaveAttribute("href", /favicon\.svg/);
});
