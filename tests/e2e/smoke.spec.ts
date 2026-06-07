import { expect, test } from "@playwright/test";

test("homepage basic smoke", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("soundcheck_locale", "sv"));
  await page.goto("/");
  await expect(page.locator(".brand-block")).toBeVisible();
  await expect(
    page.locator(".header-quick-nav").getByRole("button", { name: /^Spelningar$/ }),
  ).toBeVisible();
  await expect(
    page.locator(".header-quick-nav").getByRole("button", { name: /^Merch$/ }),
  ).toBeVisible();
  await expect(
    page.locator(".header-quick-nav").getByRole("link", { name: /^Stötta$/ }),
  ).toHaveAttribute("href", "https://ko-fi.com/soundcheckfun");
  await expect(page.getByRole("button", { name: /^Byt till svenska$/ })).toBeVisible();
  await expect(page.locator(".site-footer")).toBeVisible();
  await expect(page.locator(".site-footer").getByRole("link", { name: "Spelningar Uppsala" })).toHaveAttribute(
    "href",
    "/spelningar",
  );
  await expect(page.getByText(/Sound Check/)).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Soundcheck\.fun/,
  );
});

test("favicon is loaded", async ({ page }) => {
  await page.goto("/");

  const faviconLink = page.locator('link[rel="icon"]');
  await expect(faviconLink).toHaveAttribute("href", /favicon\.svg/);
});

test("seo title updates on concerts route", async ({ page }) => {
  await page.goto("/spelningar");
  await expect(page).toHaveTitle(/Spelningar i Uppsala|Concerts in Uppsala/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://soundcheck.fun/spelningar",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  const pageSchema = await page
    .locator('script[type="application/ld+json"][data-schema="soundcheck-page"]')
    .evaluate((element) => element.textContent || "");
  expect(pageSchema).toContain("WebPage");
  const brandSchema = await page
    .locator('script[type="application/ld+json"][data-schema="soundcheck-brand"]')
    .evaluate((element) => element.textContent || "");
  expect(brandSchema).toContain("Sound Check");
  expect(brandSchema).toContain("Soundcheck.fun");
  const websiteSchema = await page
    .locator('script[type="application/ld+json"][data-schema="soundcheck-website"]')
    .evaluate((element) => element.textContent || "");
  expect(websiteSchema).toContain("SearchAction");
});

test("private routes are marked noindex", async ({ page }) => {
  await page.goto("/admin?utm_source=test");
  await expect(page).toHaveTitle(/Admin \| Soundcheck/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://soundcheck.fun/admin",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});

test("seo discovery files are available", async ({ page }) => {
  const llmsResponse = await page.request.get("/llms.txt");
  expect(llmsResponse.ok()).toBeTruthy();
  expect(await llmsResponse.text()).toContain("Soundcheck.fun");

  const manifestResponse = await page.request.get("/site.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  expect(await manifestResponse.text()).toContain("Soundcheck");

  const openSearchResponse = await page.request.get("/opensearch.xml");
  expect(openSearchResponse.ok()).toBeTruthy();
  expect(await openSearchResponse.text()).toContain("OpenSearchDescription");
});
