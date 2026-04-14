import { expect, test } from '@playwright/test'

test('homepage basic smoke', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Konsertnavigator')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Spelningar' })).toBeVisible()
})
