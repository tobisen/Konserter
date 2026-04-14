import crypto from 'node:crypto'
import { loadUsersFromStore, saveUsersToStore } from './storage.js'

const USER_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000
const COOKIE_NAME = 'user_session'

function parseCookies(cookieHeader = '') {
  const cookies = {}

  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (!key) continue
    cookies[key] = decodeURIComponent(rest.join('='))
  }

  return cookies
}

function getSessionSecret() {
  return (
    process.env.USER_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    'dev-user-session-secret-change-me'
  )
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function normalizeUsername(value) {
  return String(value || '').trim()
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function decodeBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const missing = padded.length % 4
  const finalValue = missing ? padded + '='.repeat(4 - missing) : padded
  return Buffer.from(finalValue, 'base64').toString('utf8')
}

function signPayload(payloadString) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadString)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createSessionToken(userId) {
  const payload = {
    userId,
    exp: Date.now() + USER_SESSION_TTL_MS
  }

  const payloadPart = encodeBase64Url(JSON.stringify(payload))
  const signaturePart = signPayload(payloadPart)
  return `${payloadPart}.${signaturePart}`
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null
  }

  const [payloadPart, signaturePart] = token.split('.')
  if (!payloadPart || !signaturePart) {
    return null
  }

  const expected = signPayload(payloadPart)
  const a = Buffer.from(signaturePart)
  const b = Buffer.from(expected)

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadPart))
    if (!payload?.userId || !payload?.exp || payload.exp < Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function buildSessionCookie(token, ttlSeconds) {
  const secure = process.env.NODE_ENV === 'production'
  const cookieParts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ttlSeconds}`
  ]

  if (secure) {
    cookieParts.push('Secure')
  }

  return cookieParts.join('; ')
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username
  }
}

export function getUserSessionId(request) {
  const cookies = parseCookies(request.headers.cookie)
  const token = cookies[COOKIE_NAME]
  const session = verifySessionToken(token)
  return session?.userId || null
}

export async function getAuthenticatedAppUser(request) {
  const userId = getUserSessionId(request)
  if (!userId) return null

  const users = await loadUsersFromStore()
  const user = users.find((entry) => entry.id === userId)
  return user || null
}

export function sendUserUnauthorized(response) {
  response.statusCode = 401
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ error: 'Du måste vara inloggad.' }))
}

export async function requireAppUser(request, response) {
  const user = await getAuthenticatedAppUser(request)
  if (!user) {
    sendUserUnauthorized(response)
    return null
  }

  return user
}

export async function handleUserMe(request, response) {
  const user = await getAuthenticatedAppUser(request)

  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(
    JSON.stringify({
      authenticated: Boolean(user),
      user: user ? sanitizeUser(user) : null
    })
  )
}

export async function handleUserRegister(request, response, body) {
  const username = normalizeUsername(body?.username)
  const password = String(body?.password || '')

  if (!username || !password) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Användarnamn och lösenord måste anges.' }))
    return
  }

  if (username.length < 3) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Användarnamnet måste vara minst 3 tecken.' }))
    return
  }

  if (password.length < 8) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Lösenordet måste vara minst 8 tecken.' }))
    return
  }

  const users = await loadUsersFromStore()
  const usernameLower = username.toLowerCase()
  const exists = users.some((entry) => entry.usernameLower === usernameLower)

  if (exists) {
    response.statusCode = 409
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Användarnamnet är redan upptaget.' }))
    return
  }

  const newUser = {
    id: crypto.randomUUID(),
    username,
    usernameLower,
    passwordHash: hashPassword(password),
    favorites: [],
    bookings: [],
    seen: []
  }

  await saveUsersToStore([...users, newUser])
  const token = createSessionToken(newUser.id)

  response.setHeader(
    'Set-Cookie',
    buildSessionCookie(token, Math.floor(USER_SESSION_TTL_MS / 1000))
  )
  response.statusCode = 201
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ ok: true, user: sanitizeUser(newUser) }))
}

export async function handleUserLogin(request, response, body) {
  const username = normalizeUsername(body?.username)
  const password = String(body?.password || '')

  const users = await loadUsersFromStore()
  const user = users.find((entry) => entry.usernameLower === username.toLowerCase())

  if (!user || user.passwordHash !== hashPassword(password)) {
    response.statusCode = 401
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Fel användarnamn eller lösenord.' }))
    return
  }

  const token = createSessionToken(user.id)

  response.setHeader(
    'Set-Cookie',
    buildSessionCookie(token, Math.floor(USER_SESSION_TTL_MS / 1000))
  )
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ ok: true, user: sanitizeUser(user) }))
}

export function handleUserLogout(request, response) {
  response.setHeader('Set-Cookie', buildSessionCookie('', 0))
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ ok: true }))
}
