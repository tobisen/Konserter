import crypto from 'node:crypto'
import {
  changeAdminPassword,
  verifyAdminCredentials
} from './adminCredentials'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const sessions = new Map()
const loginAttempts = new Map()

function parseCookies(cookieHeader = '') {
  const cookies = {}

  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (!key) continue
    cookies[key] = decodeURIComponent(rest.join('='))
  }

  return cookies
}

function createSessionId() {
  return crypto.randomBytes(24).toString('hex')
}

function getClientIp(request) {
  return (
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    request.socket?.remoteAddress ||
    'unknown'
  )
}

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip)
  const now = Date.now()

  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 0, resetAt: now + 15 * 60 * 1000 })
    return false
  }

  return entry.count >= 5
}

function registerFailedAttempt(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return
  }

  entry.count += 1
}

function clearFailedAttempts(ip) {
  loginAttempts.delete(ip)
}

function buildSessionCookie(sessionId, ttlSeconds) {
  const secure = process.env.NODE_ENV === 'production'
  const cookieParts = [
    `admin_session=${encodeURIComponent(sessionId)}`,
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

export function getAuthenticatedUser(request) {
  const cookies = parseCookies(request.headers.cookie)
  const sessionId = cookies.admin_session

  if (!sessionId) return null

  const session = sessions.get(sessionId)
  if (!session) return null

  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId)
    return null
  }

  return { username: session.username, sessionId }
}

export function sendUnauthorized(response) {
  response.statusCode = 401
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ error: 'Unauthorized' }))
}

export function requireAuth(request, response) {
  const user = getAuthenticatedUser(request)
  if (!user) {
    sendUnauthorized(response)
    return null
  }

  return user
}

export function handleAuthMe(request, response) {
  const user = getAuthenticatedUser(request)

  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ authenticated: Boolean(user), username: user?.username || null }))
}

export async function handleLogin(request, response, body) {
  const ip = getClientIp(request)

  if (isRateLimited(ip)) {
    response.statusCode = 429
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'För många försök. Försök igen senare.' }))
    return
  }

  const username = String(body?.username || '')
  const password = String(body?.password || '')

  const valid = await verifyAdminCredentials(username, password)

  if (!valid) {
    registerFailedAttempt(ip)
    response.statusCode = 401
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Fel användarnamn eller lösenord.' }))
    return
  }

  clearFailedAttempts(ip)

  const sessionId = createSessionId()
  sessions.set(sessionId, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS
  })

  response.setHeader('Set-Cookie', buildSessionCookie(sessionId, Math.floor(SESSION_TTL_MS / 1000)))
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ ok: true }))
}

export async function handleChangePassword(request, response, user, body) {
  const currentPassword = String(body?.currentPassword || '')
  const newPassword = String(body?.newPassword || '')

  if (!currentPassword || !newPassword) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Nuvarande och nytt lösenord måste anges.' }))
    return
  }

  if (newPassword.length < 10) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Nytt lösenord måste vara minst 10 tecken.' }))
    return
  }

  const validCurrent = await verifyAdminCredentials(user.username, currentPassword)
  if (!validCurrent) {
    response.statusCode = 401
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Nuvarande lösenord är fel.' }))
    return
  }

  await changeAdminPassword({
    username: user.username,
    newPassword
  })

  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ ok: true }))
}

export function handleLogout(request, response) {
  const cookies = parseCookies(request.headers.cookie)
  const sessionId = cookies.admin_session

  if (sessionId) {
    sessions.delete(sessionId)
  }

  response.setHeader('Set-Cookie', buildSessionCookie('', 0))
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ ok: true }))
}
