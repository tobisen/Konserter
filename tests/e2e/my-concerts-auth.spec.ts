import { expect, test } from '@playwright/test'

test.describe('My Concerts auth UI', () => {
  test('shows create-account and login forms when logged out', async ({ page }) => {
    await page.goto('/mina-spelningar')

    await expect(page.getByRole('heading', { name: 'Skapa konto' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Logga in' })).toBeVisible()

    const registerForm = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Skapa konto' }) })
    await expect(registerForm.getByPlaceholder('namn@epost.se')).toBeVisible()
  })

  test('can show password-reset form', async ({ page }) => {
    await page.goto('/mina-spelningar')

    await page.getByRole('button', { name: 'Har du fått en länk? Återställ lösenord' }).click()
    await expect(page.getByRole('heading', { name: 'Återställ lösenord' })).toBeVisible()
    await expect(page.getByPlaceholder('Token från mail-länken')).toBeVisible()
  })

  test('password visibility toggle exists in login form', async ({ page }) => {
    await page.goto('/mina-spelningar')

    const loginCard = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Logga in' }) })
    await expect(loginCard.getByRole('button', { name: /^Visa$/ })).toBeVisible()
  })
})
