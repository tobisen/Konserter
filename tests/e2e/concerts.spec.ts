import { expect, test } from "@playwright/test";

test.describe("Concerts view", () => {
  test("concerts view has filters and search", async ({ page }) => {
    await page.goto("/spelningar");

    await page.getByRole("button", { name: /^Visa filter$/ }).click();
    await expect(
      page.getByRole("heading", { name: "Filtrera kommande spelningar" }),
    ).toBeVisible();
    await expect(page.locator("#concert-search")).toBeVisible();
    await expect(page.locator("#concert-date-to")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Kortvy$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Listvy$/ })).toBeVisible();
  });

  test("can switch between card and table view", async ({ page }) => {
    await page.goto("/spelningar");

    await page.getByRole("button", { name: /^Listvy$/ }).click();
    await expect(page.getByRole("columnheader", { name: "Datum" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Artist" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Plats" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Ort" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Åtgärder" })).toBeVisible();
    await expect(page.locator(".table-actions .mini-action-button").first()).toBeVisible();

    await page.getByRole("button", { name: /^Kortvy$/ }).click();
    await expect(page.locator(".concert-cards-grid")).toBeVisible();
  });

  test("can toggle upcoming and past tabs", async ({ page }) => {
    await page.goto("/spelningar");

    await page.getByRole("button", { name: /^Tidigare$/ }).click();
    await expect(page.getByRole("button", { name: /^Tidigare$/ })).toHaveClass(
      /active/,
    );

    await page.getByRole("button", { name: /^Framtida$/ }).click();
    await expect(page.getByRole("button", { name: /^Framtida$/ })).toHaveClass(
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
