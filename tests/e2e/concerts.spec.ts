import { expect, test } from "@playwright/test";

test.describe("Concerts view", () => {
  test("concerts view has filters and search", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Spelningar$/ }).click();

    await expect(
      page.getByRole("heading", { name: "Filtrera kommande spelningar" }),
    ).toBeVisible();
    await expect(page.getByLabel("Sök spelning")).toBeVisible();
    await expect(page.getByLabel("Välj datum")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Kortvy$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Listvy$/ })).toBeVisible();
  });

  test("can switch between card and table view", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Spelningar$/ }).click();

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
    await page.goto("/");
    await page.getByRole("button", { name: /^Spelningar$/ }).click();

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
    await page.goto("/");
    await page.getByRole("button", { name: /^Spelningar$/ }).click();

    const search = page.getByLabel("Sök spelning");
    await search.fill("uppsala");
    await expect(search).toHaveValue("uppsala");
  });

  test("Spotify button appears on concert cards", async ({ page }) => {
    await page.goto("/");

    const spotifyButton = page.getByRole("button", { name: "🎵" }).first();
    await expect(spotifyButton).toBeVisible();
  });

  test("can open Spotify modal for artist", async ({ page }) => {
    await page.goto("/");

    const spotifyButton = page.getByRole("button", { name: "🎵" }).first();
    await spotifyButton.click();

    const spotifyModal = page.locator(".modal-card").first();
    await expect(spotifyModal).toBeVisible();
  });
});
