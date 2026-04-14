import { expect, test } from '@playwright/test'

test.describe('Navigation', () => {
  test('main menu buttons are visible', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Konsertnavigator')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hem' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Källor' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Spelningar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mina Spelningar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hjälp' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible()
  })

  test('help page opens', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Hjälp' }).click()

    await expect(page.getByRole('heading', { name: 'Hjälp' })).toBeVisible()
    await expect(page.getByText('Här ser du vad du kan göra i Konsertnavigator.')).toBeVisible()
  })

  test('sources page opens', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Källor' }).click()

    await expect(page.getByRole('heading', { name: 'Källor' })).toBeVisible()
  })
})
