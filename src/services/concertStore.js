async function parseJson(response) {
  const rawText = await response.text().catch(() => '')
  let payload = {}

  if (rawText) {
    try {
      payload = JSON.parse(rawText)
    } catch {
      payload = { error: rawText }
    }
  }

  if (!response.ok) {
    const message = payload.error || rawText || `HTTP ${response.status}`
    throw new Error(message)
  }
  return payload
}

export async function loadStoredConcerts() {
  const response = await fetch('/api/concerts')
  const payload = await parseJson(response)
  return {
    concerts: payload.concerts || [],
    lastUpdatedAt: payload.lastUpdatedAt || null,
    latestAddedAt: payload.latestAddedAt || null,
    latestAddedConcertIds: payload.latestAddedConcertIds || []
  }
}

export async function updateConcertsFromSources() {
  const response = await fetch('/api/concerts/update', {
    method: 'POST'
  })

  const payload = await parseJson(response)

  return {
    concerts: payload.concerts || [],
    addedCount: payload.addedCount || 0,
    errors: payload.errors || [],
    lastUpdatedAt: payload.lastUpdatedAt || null,
    latestAddedAt: payload.latestAddedAt || null,
    latestAddedConcertIds: payload.latestAddedConcertIds || [],
    sourceStatus: payload.sourceStatus || []
  }
}

export async function clearStoredConcerts() {
  const response = await fetch('/api/concerts/clear', {
    method: 'POST'
  })

  const payload = await parseJson(response)

  return {
    concerts: payload.concerts || [],
    clearedCount: payload.clearedCount || 0,
    latestAddedAt: payload.latestAddedAt || null,
    latestAddedConcertIds: payload.latestAddedConcertIds || []
  }
}

export async function deleteStoredConcert(concertIndex, concertId) {
  const params = new URLSearchParams()
  if (concertId) {
    params.set('concertId', concertId)
  }

  const query = params.toString()
  const response = await fetch(
    `/api/concerts/${encodeURIComponent(String(concertIndex))}${query ? `?${query}` : ''}`,
    {
      method: 'DELETE'
    }
  )

  const payload = await parseJson(response)

  return {
    concerts: payload.concerts || [],
    deletedConcert: payload.deletedConcert || null,
    deletedConcertId: payload.deletedConcertId || '',
    latestAddedAt: payload.latestAddedAt || null,
    latestAddedConcertIds: payload.latestAddedConcertIds || []
  }
}
