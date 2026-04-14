import crypto from 'node:crypto'
import {
  getAuthenticatedUser,
  handleAuthMe,
  handleChangePassword,
  handleLogin,
  handleLogout,
  requireAuth
} from './auth.js'
import { fetchConcertsFromUrl, handleSourceEventsRequest } from './sourceEvents.js'
import {
  loadConcertsFromFile,
  loadSourcesFromFile,
  saveConcertsToFile,
  saveSourcesToFile
} from './storage.js'

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

function toUrl(request) {
  return new URL(request.url || '/', 'http://localhost')
}

async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8')

  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Ogiltig JSON')
  }
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function createStableId(concert) {
  return [
    normalizeText(concert.artist),
    normalizeText(concert.venue),
    normalizeText(concert.city),
    new Date(concert.date).toISOString()
  ].join('|')
}

function parseConcertDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeOptionalUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''

  try {
    const parsed = new URL(text)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return ''
    }
    return parsed.toString()
  } catch {
    return ''
  }
}

function normalizeIncomingConcert(rawConcert, sourceName) {
  return {
    artist: String(rawConcert.artist || '').trim(),
    title: String(rawConcert.title || '').trim(),
    date: String(rawConcert.date || '').trim(),
    venue: String(rawConcert.venue || '').trim(),
    city: String(rawConcert.city || '').trim(),
    genre: String(rawConcert.genre || '').trim(),
    detailsUrl: normalizeOptionalUrl(rawConcert.detailsUrl),
    sourceName
  }
}

function isValidConcert(concert) {
  if (!concert.artist || !concert.title || !concert.venue || !concert.city) {
    return false
  }

  return Boolean(parseConcertDate(concert.date))
}

async function handleGetConcerts(response) {
  const concerts = await loadConcertsFromFile()
  sendJson(response, 200, { concerts })
}

async function handleGetSources(request, response) {
  const user = getAuthenticatedUser(request)
  const sources = await loadSourcesFromFile()

  if (user) {
    sendJson(response, 200, { sources })
    return
  }

  const publicSources = sources.map((source) => ({
    id: source.id,
    name: source.name
  }))

  sendJson(response, 200, { sources: publicSources })
}

async function handleAddSource(request, response) {
  const user = requireAuth(request, response)
  if (!user) return

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, 400, { error: error.message })
    return
  }

  const name = String(body?.name || '').trim()
  const url = String(body?.url || '').trim()

  if (!name || !url) {
    sendJson(response, 400, { error: 'Namn och URL måste anges.' })
    return
  }

  try {
    new URL(url)
  } catch {
    sendJson(response, 400, { error: 'URL är inte giltig.' })
    return
  }

  const sources = await loadSourcesFromFile()
  const duplicate = sources.some((source) => source.url.toLowerCase() === url.toLowerCase())

  if (duplicate) {
    sendJson(response, 409, { error: 'Källan finns redan i listan.' })
    return
  }

  const nextSources = [
    ...sources,
    {
      id: crypto.randomUUID(),
      name,
      url
    }
  ]

  await saveSourcesToFile(nextSources)
  sendJson(response, 201, { sources: nextSources })
}

async function handleDeleteSource(request, response, sourceId) {
  const user = requireAuth(request, response)
  if (!user) return

  const sources = await loadSourcesFromFile()
  const nextSources = sources.filter((source) => source.id !== sourceId)

  await saveSourcesToFile(nextSources)
  sendJson(response, 200, { sources: nextSources })
}

async function handleUpdateConcerts(request, response) {
  const sources = await loadSourcesFromFile()

  if (sources.length === 0) {
    sendJson(response, 400, { error: 'Lägg till minst en källa innan uppdatering.' })
    return
  }

  const currentConcerts = await loadConcertsFromFile()

  const sourceResults = await Promise.allSettled(
    sources.map(async (source) => {
      const fetched = await fetchConcertsFromUrl(source.url)
      return fetched
        .map((concert) => normalizeIncomingConcert(concert, source.name))
        .filter(isValidConcert)
    })
  )

  const incomingConcerts = []
  const errors = []

  for (let i = 0; i < sourceResults.length; i += 1) {
    const result = sourceResults[i]
    const source = sources[i]

    if (result.status === 'fulfilled') {
      incomingConcerts.push(...result.value)
      continue
    }

    errors.push(`${source.name}: ${result.reason?.message || 'okänt fel'}`)
  }

  const existingIds = new Set(currentConcerts.map(createStableId))
  const additions = incomingConcerts.filter((concert) => !existingIds.has(createStableId(concert)))

  const merged = [...currentConcerts, ...additions].sort(
    (a, b) => parseConcertDate(a.date) - parseConcertDate(b.date)
  )

  if (additions.length > 0) {
    await saveConcertsToFile(merged)
  }

  sendJson(response, 200, {
    concerts: additions.length > 0 ? merged : currentConcerts,
    addedCount: additions.length,
    errors
  })
}

export async function handleApiRequest(request, response) {
  const url = toUrl(request)
  const pathname = url.pathname.startsWith('/api')
    ? url.pathname
    : `/api${url.pathname}`

  if (request.method === 'OPTIONS') {
    response.statusCode = 204
    response.end()
    return
  }

  if (pathname === '/api/auth/me' && request.method === 'GET') {
    handleAuthMe(request, response)
    return
  }

  if (pathname === '/api/source-events') {
    await handleSourceEventsRequest(request, response)
    return
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    let body
    try {
      body = await readJsonBody(request)
    } catch (error) {
      sendJson(response, 400, { error: error.message })
      return
    }

    await handleLogin(request, response, body)
    return
  }

  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    handleLogout(request, response)
    return
  }

  if (pathname === '/api/auth/change-password' && request.method === 'POST') {
    const user = requireAuth(request, response)
    if (!user) return

    let body
    try {
      body = await readJsonBody(request)
    } catch (error) {
      sendJson(response, 400, { error: error.message })
      return
    }

    await handleChangePassword(request, response, user, body)
    return
  }

  if (pathname === '/api/concerts' && request.method === 'GET') {
    await handleGetConcerts(response)
    return
  }

  if (pathname === '/api/concerts/update' && request.method === 'POST') {
    await handleUpdateConcerts(request, response)
    return
  }

  if (pathname === '/api/sources' && request.method === 'GET') {
    await handleGetSources(request, response)
    return
  }

  if (pathname === '/api/sources' && request.method === 'POST') {
    await handleAddSource(request, response)
    return
  }

  if (pathname.startsWith('/api/sources/') && request.method === 'DELETE') {
    const sourceId = decodeURIComponent(pathname.slice('/api/sources/'.length))
    await handleDeleteSource(request, response, sourceId)
    return
  }

  sendJson(response, 404, { error: 'Not found' })
}
