import { expect, test } from '@playwright/test'

test.describe('Admin guard and info', () => {
  test('admin page requires admin login when logged out', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^Admin$/ }).click()

    await expect(page.getByText('Du behöver logga in som admin för att se denna vy.')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Logga in$/ })).toBeVisible()
  })
})
