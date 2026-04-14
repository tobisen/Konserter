async function parseJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Okänt fel')
  }
  return payload
}

export async function loadSources() {
  const response = await fetch('/api/sources')
  const payload = await parseJson(response)
  return payload.sources || []
}

export async function addSource(sourceInput) {
  const response = await fetch('/api/sources', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(sourceInput)
  })

  const payload = await parseJson(response)
  return payload.sources || []
}

export async function removeSource(id) {
  const response = await fetch(`/api/sources/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })

  const payload = await parseJson(response)
  return payload.sources || []
}
