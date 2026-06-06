import { expect, test } from "@playwright/test";

test("homepage basic smoke", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("soundcheck_locale", "sv"));
  await page.goto("/");
  await expect(page.locator(".brand-block")).toBeVisible();
  await expect(
    page.locator(".header-quick-nav").getByRole("button", { name: /^Spelningar$/ }),
  ).toBeVisible();
  await expect(
    page.locator(".header-quick-nav").getByRole("link", { name: /^Stötta$/ }),
  ).toHaveAttribute("href", "https://ko-fi.com/soundcheckfun");
  await expect(page.getByRole("button", { name: /^Byt till svenska$/ })).toBeVisible();
  await expect(page.locator(".site-footer")).toBeVisible();
});

test("favicon is loaded", async ({ page }) => {
  await page.goto("/");

  const faviconLink = page.locator('link[rel="icon"]');
  await expect(faviconLink).toHaveAttribute("href", /favicon\.svg/);
});

test("seo title updates on concerts route", async ({ page }) => {
  await page.goto("/spelningar");
  await expect(page).toHaveTitle(/Spelningar|Concerts/);
});
