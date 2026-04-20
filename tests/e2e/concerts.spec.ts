import { expect, test } from "@playwright/test";

test.describe("Concerts view", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("soundcheck_locale", "sv"));
  });

  test("concerts view has filters and search", async ({ page }) => {
    await page.goto("/spelningar");

    await page.getByRole("button", { name: /Visa filter|Filters/i }).click();
    await expect(
      page.getByRole("heading", { name: /Filtrera kommande spelningar|Filter upcoming concerts/i }),
    ).toBeVisible();
    await expect(page.locator("#concert-search")).toBeVisible();
    await expect(page.locator("#concert-date-to")).toBeVisible();
    await expect(page.getByRole("button", { name: /Kortvy|Card view/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Listvy|List view/i })).toBeVisible();
  });

  test("can switch between card and table view", async ({ page }) => {
    await page.goto("/spelningar");

    await page.getByRole("button", { name: /Listvy|List view/i }).click();
    await expect(page.getByRole("columnheader", { name: /Datum|Date/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Artist" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Plats|Venue/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Ort|City/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Åtgärder|Actions/i })).toBeVisible();
    await expect(page.locator(".table-actions .mini-action-button").first()).toBeVisible();

    await page.getByRole("button", { name: /Kortvy|Card view/i }).click();
    await expect(page.locator(".concert-cards-grid")).toBeVisible();
  });

  test("can toggle upcoming and past tabs", async ({ page }) => {
    await page.goto("/spelningar");

    await page.getByRole("button", { name: /Tidigare|Past/i }).click();
    await expect(page.getByRole("button", { name: /Tidigare|Past/i })).toHaveClass(
      /active/,
    );

    await page.getByRole("button", { name: /Framtida|Upcoming/i }).click();
    await expect(page.getByRole("button", { name: /Framtida|Upcoming/i })).toHaveClass(
      /active/,
    );
  });

  test("search field accepts input", async ({ page }) => {
    await page.goto("/spelningar");

    const search = page.locator("#concert-search");
    await search.fill("uppsala");
    await expect(search).toHaveValue("uppsala");
  });

  test("Spotify button appears on concert cards", async ({ page }) => {
    await page.goto("/spelningar");

    const spotifyButton = page.getByRole("button", { name: "♫" }).first();
    await expect(spotifyButton).toBeVisible();
  });

  test("favorite star button appears on concert cards", async ({ page }) => {
    await page.goto("/spelningar");

    const starButton = page.getByRole("button", { name: /Ta bort favorit|Spara favorit/ }).first();
    await expect(starButton).toBeVisible();
    await expect(starButton).toContainText(/★|☆/);
  });

  test("can open Spotify modal for artist", async ({ page }) => {
    await page.goto("/spelningar");

    const spotifyButton = page.getByRole("button", { name: "♫" }).first();
    await spotifyButton.click();

    const spotifyModal = page.locator(".modal-card").first();
    await expect(spotifyModal).toBeVisible();
  });
});
