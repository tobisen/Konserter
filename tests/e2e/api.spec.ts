import { expect, test } from '@playwright/test'

test.describe('Public API smoke', () => {
  test('GET /api/concerts returns JSON payload', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/concerts`)
    expect(response.ok()).toBeTruthy()

    const payload = await response.json()
    expect(Array.isArray(payload.concerts)).toBeTruthy()
  })

  test('GET /api/sources returns JSON payload', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/sources`)
    expect(response.ok()).toBeTruthy()

    const payload = await response.json()
    expect(Array.isArray(payload.sources)).toBeTruthy()
  })

  test('DELETE /api/concerts/:index requires admin auth', async ({ request, baseURL }) => {
    const response = await request.delete(`${baseURL}/api/concerts/0`)
    expect(response.status()).toBe(401)

    const payload = await response.json()
    expect(payload.error).toBe('Unauthorized')
  })

  test('GET /api/source-events without url returns 400', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/source-events`)
    expect(response.status()).toBe(400)

    const payload = await response.json()
    expect(String(payload.error || '')).toContain('url')
  })

  test('GET /api/source-events with invalid url returns a readable error', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/source-events?url=not-a-valid-url`)
    expect(response.status()).toBe(500)

    const payload = await response.json()
    expect(String(payload.error || '')).toContain('Ogiltig käll-URL')
  })

  test('GET /api/source-events can read Dog Bar events', async ({ request, baseURL }) => {
    const response = await request.get(
      `${baseURL}/api/source-events?url=${encodeURIComponent('https://dogbaruppsala.se/evenemang')}`
    )
    expect(response.ok()).toBeTruthy()

    const payload = await response.json()
    expect(Array.isArray(payload.concerts)).toBeTruthy()
    expect(payload.concerts.length).toBeGreaterThan(0)
    expect(
      payload.concerts.some((concert) =>
        String(concert.detailsUrl || '').includes('dogbaruppsala.se')
      )
    ).toBeTruthy()
  })

  test('GET /api/source-events can read Kulturoasen events', async ({ request, baseURL }) => {
    const response = await request.get(
      `${baseURL}/api/source-events?url=${encodeURIComponent('https://www.kulturoasen.se/')}`
    )
    expect(response.ok()).toBeTruthy()

    const payload = await response.json()
    expect(Array.isArray(payload.concerts)).toBeTruthy()
    expect(payload.concerts.length).toBeGreaterThan(0)
    expect(
      payload.concerts.some((concert) =>
        String(concert.detailsUrl || '').includes('kulturoasen.se/events/')
      )
    ).toBeTruthy()
  })
})
