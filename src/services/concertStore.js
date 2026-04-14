async function parseJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Okänt fel')
  }
  return payload
}

export async function loadStoredConcerts() {
  const response = await fetch('/api/concerts')
  const payload = await parseJson(response)
  return payload.concerts || []
}

export async function updateConcertsFromSources() {
  const response = await fetch('/api/concerts/update', {
    method: 'POST'
  })

  const payload = await parseJson(response)

  return {
    concerts: payload.concerts || [],
    addedCount: payload.addedCount || 0,
    errors: payload.errors || []
  }
}
