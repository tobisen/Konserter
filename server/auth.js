import crypto from 'node:crypto'
import {
  changeAdminPassword,
  verifyAdminCredentials
} from './adminCredentials.js'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
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

function getSessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD_HASH ||
    process.env.ADMIN_PASSWORD ||
    'dev-fallback-secret-change-me'
  )
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

function createSessionToken(username) {
  const payload = {
    username,
    exp: Date.now() + SESSION_TTL_MS
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
    if (!payload?.username || !payload?.exp) {
      return null
    }

    if (payload.exp < Date.now()) {
      return null
    }

    return {
      username: payload.username,
      expiresAt: payload.exp
    }
  } catch {
    return null
  }
}

function buildSessionCookie(token, ttlSeconds) {
  const secure = process.env.NODE_ENV === 'production'
  const cookieParts = [
    `admin_session=${encodeURIComponent(token)}`,
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
  const token = cookies.admin_session
  const session = verifySessionToken(token)

  if (!session) {
    return null
  }

  return {
    username: session.username
  }
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

  const token = createSessionToken(username)

  response.setHeader('Set-Cookie', buildSessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)))
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
  response.setHeader('Set-Cookie', buildSessionCookie('', 0))
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ ok: true }))
}
