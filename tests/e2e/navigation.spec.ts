import { expect, test } from '@playwright/test'

async function openMenu(page) {
  await page.getByRole('button', { name: /Öppna meny|Open menu/ }).click()
}

test.describe('Navigation', () => {
  test('main menu buttons are visible', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('soundcheck_locale', 'sv'))
    await page.goto('/')

    await expect(page.locator('.brand-block')).toBeVisible()
    await expect(page.locator('.header-quick-nav').getByRole('button', { name: /^Spelningar$/ })).toBeVisible()
    await expect(page.locator('.header-quick-nav').getByRole('button', { name: /^Mina Spelningar$/ })).toBeVisible()
    await expect(page.locator('.header-quick-nav').getByRole('button', { name: /^Merch$/ })).toBeVisible()
    await expect(page.locator('.header-quick-nav').getByRole('link', { name: /^Stötta$/ })).toHaveAttribute('href', 'https://ko-fi.com/soundcheckfun')
    await expect(page.getByRole('button', { name: /^Byt till svenska$/ })).toBeVisible()

    await openMenu(page)
    await expect(page.getByRole('button', { name: /^Hem$/ })).toBeVisible()
    await expect(page.locator('.slide-menu').getByRole('button', { name: /^Merch$/ })).toBeVisible()
    await expect(page.locator('.slide-menu').getByRole('link', { name: /^Stötta$/ })).toHaveAttribute('href', 'https://ko-fi.com/soundcheckfun')
    await expect(page.getByRole('button', { name: /^Källor$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Kontakt$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Hjälp$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Admin$/ })).toBeVisible()
  })

  test('English navigation labels are translated', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('soundcheck_locale', 'en'))
    await page.goto('/')

    await expect(page.locator('.header-quick-nav').getByRole('button', { name: /^Concerts$/ })).toBeVisible()
    await expect(page.locator('.header-quick-nav').getByRole('button', { name: /^My Concerts$/ })).toBeVisible()
    await expect(page.locator('.header-quick-nav').getByRole('button', { name: /^Merch$/ })).toBeVisible()
    await expect(page.locator('.header-quick-nav').getByRole('link', { name: /^Support$/ })).toHaveAttribute('href', 'https://ko-fi.com/soundcheckfun')
    await expect(page.locator('.header-quick-nav')).not.toContainText('nav.support')
  })

  test('mobile header keeps quick links visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => localStorage.setItem('soundcheck_locale', 'sv'))
    await page.goto('/')

    const quickNav = page.locator('.header-quick-nav')
    await expect(page.locator('.brand-block')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Byt till svenska$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Öppna meny/ })).toBeVisible()
    await expect(quickNav.getByRole('button', { name: /^Spelningar$/ })).toBeVisible()
    await expect(quickNav.getByRole('button', { name: /^Mina Spelningar$/ })).toBeVisible()
    await expect(quickNav.getByRole('button', { name: /^Merch$/ })).toBeVisible()
    await expect(quickNav.getByRole('link', { name: /^Stötta$/ })).toBeVisible()
  })

  test('help page opens', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('soundcheck_locale', 'sv'))
    await page.goto('/')
    await openMenu(page)
    await page.getByRole('button', { name: /^Hjälp$/ }).click()

    await expect(page.getByRole('heading', { name: 'Hjälp' })).toBeVisible()
    await expect(page.getByText('Här ser du vad du kan göra i Soundcheck.')).toBeVisible()
  })

  test('sources page opens', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('soundcheck_locale', 'sv'))
    await page.goto('/')
    await openMenu(page)
    await page.getByRole('button', { name: /^Källor$/ }).click()

    await expect(page.getByRole('heading', { name: 'Källor' })).toBeVisible()
  })

  test('contact page opens', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('soundcheck_locale', 'sv'))
    await page.goto('/')
    await openMenu(page)
    await page.getByRole('button', { name: /^Kontakt$/ }).click()

    await expect(page.getByRole('heading', { name: 'Kontakt' })).toBeVisible()
    await expect(page.getByPlaceholder('Namn')).toBeVisible()
    await expect(page.getByPlaceholder('E-post')).toBeVisible()
    await expect(page.getByPlaceholder('Meddelande')).toBeVisible()
  })

  test('merch page opens and reloads', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('soundcheck_locale', 'sv'))
    await page.goto('/')
    await page.locator('.header-quick-nav').getByRole('button', { name: /^Merch$/ }).click()

    await expect(page).toHaveURL(/\/merch$/)
    await expect(page.getByRole('heading', { name: 'SOUNDCHECK MERCH' })).toBeVisible()
    await expect(page.locator('.merch-hero .kicker', { hasText: 'För människor som faktiskt går på spelningar.' })).toBeVisible()
    await expect(page.getByText('Alla produkter säljs via Fourthwall och tillverkas på beställning.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The Gig Tee' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The Headliner Tee' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The Gig Hoodie' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Backstage Tee' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The Monogram Tee' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The Venue Cap' })).toBeVisible()
    await expect(page.getByAltText('The Gig Tee, svart t-shirt med Soundcheck-logga framtill')).toHaveAttribute('src', '/images/signature1.avif')
    await expect(page.getByAltText('The Gig Tee med konsertinspirerat ryggtryck')).toHaveAttribute('src', '/images/signature2.avif')
    await expect(page.getByAltText('The Headliner Tee, svart t-shirt med Soundcheck-logga framtill')).toHaveAttribute('src', '/images/headliner1.avif')
    await expect(page.getByAltText('The Gig Hoodie, svart hoodie med Soundcheck-logga framtill')).toHaveAttribute('src', '/images/hoodie1.avif')
    await expect(page.getByAltText('Backstage Tee, svart t-shirt med exklusivt tryck')).toHaveAttribute('src', '/images/merch/backstage1.webp')
    await expect(page.getByAltText('The Monogram Tee, svart t-shirt med Soundcheck-monogram framtill')).toHaveAttribute('src', '/images/monogram-fram.avif')
    await expect(page.getByAltText('The Monogram Tee med matchande ryggtryck')).toHaveAttribute('src', '/images/monogram-bak.avif')
    await expect(page.getByAltText('The Venue Cap, svart keps med Soundcheck-logga framtill')).toHaveAttribute('src', '/images/merch/soundcheck-cap.jpg')
    const tshirtCard = page.locator('.merch-card').filter({ hasText: 'The Gig Tee' })
    const headlinerCard = page.locator('.merch-card').filter({ hasText: 'The Headliner Tee' })
    const hoodieCard = page.locator('.merch-card').filter({ hasText: 'The Gig Hoodie' })
    const backstageCard = page.locator('.merch-card').filter({ hasText: 'Backstage Tee' })
    const monogramCard = page.locator('.merch-card').filter({ hasText: 'The Monogram Tee' })
    const capCard = page.locator('.merch-card').filter({ hasText: 'The Venue Cap' })
    await expect(tshirtCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('href', 'https://soundcheck-shop.fourthwall.com/en-sek/products/soundcheck-signature-tee')
    await expect(tshirtCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('target', '_blank')
    await expect(tshirtCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(headlinerCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('href', 'https://soundcheck-shop.fourthwall.com/en-sek/products/the-headliner-tee')
    await expect(headlinerCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('target', '_blank')
    await expect(headlinerCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(hoodieCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('href', 'https://soundcheck-shop.fourthwall.com/en-sek/products/the-gig-hoodie')
    await expect(hoodieCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('target', '_blank')
    await expect(hoodieCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(backstageCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('href', 'https://soundcheck-shop.fourthwall.com/en-sek/products/the-backstage-tee')
    await expect(backstageCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('target', '_blank')
    await expect(backstageCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(monogramCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('href', 'https://soundcheck-shop.fourthwall.com/products/the-monogram-tee')
    await expect(monogramCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('target', '_blank')
    await expect(monogramCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(capCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('href', 'https://soundcheck-shop.fourthwall.com/en-sek/products/the-venue-cap')
    await expect(capCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('target', '_blank')
    await expect(capCard.getByRole('link', { name: /^Köp på Fourthwall$/ })).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(page.getByRole('heading', { name: 'Mer än bara konserter' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Upptäck fler spelningar' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Till spelningarna$/ })).toHaveAttribute('href', '/')

    await page.getByRole('button', { name: /^Förstora The Gig Tee framsida$/ }).click()
    await expect(page.getByRole('dialog', { name: /Förstorad bild: The Gig Tee/ })).toBeVisible()
    await expect(page.getByRole('dialog', { name: /Förstorad bild: The Gig Tee/ }).getByAltText('The Gig Tee, svart t-shirt med Soundcheck-logga framtill')).toBeVisible()
    await page.getByRole('button', { name: /^Stäng$/ }).click()
    await expect(page.getByRole('dialog', { name: /Förstorad bild: The Gig Tee/ })).toBeHidden()

    await page.reload()

    await expect(page).toHaveURL(/\/merch$/)
    await expect(page.getByRole('heading', { name: 'SOUNDCHECK MERCH' })).toBeVisible()
  })

  test('reload keeps the same page route', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('soundcheck_locale', 'sv'))
    await page.goto('/kontakt')
    await expect(page.getByRole('heading', { name: 'Kontakt' })).toBeVisible()

    await page.reload()

    await expect(page).toHaveURL(/\/kontakt$/)
    await expect(page.getByRole('heading', { name: 'Kontakt' })).toBeVisible()
  })
})
