async function parseJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Okänt fel')
  }
  return payload
}

export async function getUserSession() {
  const response = await fetch('/api/users/me')
  const payload = await parseJson(response)
  return payload
}

export async function registerUser(credentials) {
  const response = await fetch('/api/users/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  })

  return parseJson(response)
}

export async function loginUser(credentials) {
  const response = await fetch('/api/users/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  })

  return parseJson(response)
}

export async function logoutUser() {
  const response = await fetch('/api/users/logout', {
    method: 'POST'
  })

  return parseJson(response)
}

export async function loadFavorites() {
  const response = await fetch('/api/users/favorites')
  const payload = await parseJson(response)
  return payload.favorites || []
}

export async function addFavorite(concertId) {
  const response = await fetch('/api/users/favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ concertId })
  })

  const payload = await parseJson(response)
  return payload.favorites || []
}

export async function removeFavorite(concertId) {
  const response = await fetch(`/api/users/favorites/${encodeURIComponent(concertId)}`, {
    method: 'DELETE'
  })

  const payload = await parseJson(response)
  return payload.favorites || []
}
