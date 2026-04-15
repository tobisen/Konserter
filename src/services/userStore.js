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

export async function requestPasswordReset(email) {
  const response = await fetch('/api/users/forgot-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  })

  return parseJson(response)
}

export async function resetPassword(token, newPassword) {
  const response = await fetch('/api/users/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token, newPassword })
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

export async function loadUserLists() {
  const response = await fetch('/api/users/lists')
  const payload = await parseJson(response)
  return {
    favorites: payload.favorites || [],
    bookings: payload.bookings || [],
    seen: payload.seen || [],
    followedArtists: payload.followedArtists || [],
    followedVenues: payload.followedVenues || []
  }
}

export async function loadUserFollows() {
  const response = await fetch('/api/users/follows')
  const payload = await parseJson(response)
  return {
    followedArtists: payload.followedArtists || [],
    followedVenues: payload.followedVenues || []
  }
}

export async function addUserFollow(followType, value) {
  const response = await fetch('/api/users/follows', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ followType, value })
  })

  const payload = await parseJson(response)
  return {
    followedArtists: payload.followedArtists || [],
    followedVenues: payload.followedVenues || []
  }
}

export async function removeUserFollow(followType, value) {
  const response = await fetch(
    `/api/users/follows/${encodeURIComponent(followType)}/${encodeURIComponent(value)}`,
    {
      method: 'DELETE'
    }
  )

  const payload = await parseJson(response)
  return {
    followedArtists: payload.followedArtists || [],
    followedVenues: payload.followedVenues || []
  }
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

export async function addToUserList(listType, concertId) {
  const response = await fetch('/api/users/lists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ listType, concertId })
  })

  const payload = await parseJson(response)
  return {
    favorites: payload.favorites || [],
    bookings: payload.bookings || [],
    seen: payload.seen || []
  }
}

export async function removeFromUserList(listType, concertId) {
  const response = await fetch(
    `/api/users/lists/${encodeURIComponent(listType)}/${encodeURIComponent(concertId)}`,
    {
      method: 'DELETE'
    }
  )

  const payload = await parseJson(response)
  return {
    favorites: payload.favorites || [],
    bookings: payload.bookings || [],
    seen: payload.seen || []
  }
}
