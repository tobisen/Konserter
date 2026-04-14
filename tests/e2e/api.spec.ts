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
})
