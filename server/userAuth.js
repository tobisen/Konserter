import crypto from 'node:crypto'
import { loadUsersFromStore, saveUsersToStore } from './storage.js'

const USER_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000
const COOKIE_NAME = 'user_session'
const USER_LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const USER_LOGIN_ATTEMPT_LIMIT = 7
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000
const userLoginAttempts = new Map()

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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function isValidEmail(email) {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function getClientIp(request) {
  return (
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    request.socket?.remoteAddress ||
    'unknown'
  )
}

function isUserLoginRateLimited(ip) {
  const entry = userLoginAttempts.get(ip)
  const now = Date.now()

  if (!entry || entry.resetAt < now) {
    userLoginAttempts.set(ip, { count: 0, resetAt: now + USER_LOGIN_ATTEMPT_WINDOW_MS })
    return false
  }

  return entry.count >= USER_LOGIN_ATTEMPT_LIMIT
}

function registerUserLoginFailedAttempt(ip) {
  const now = Date.now()
  const entry = userLoginAttempts.get(ip)

  if (!entry || entry.resetAt < now) {
    userLoginAttempts.set(ip, { count: 1, resetAt: now + USER_LOGIN_ATTEMPT_WINDOW_MS })
    return
  }

  entry.count += 1
}

function clearUserLoginFailedAttempts(ip) {
  userLoginAttempts.delete(ip)
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
    username: user.username,
    email: user.email || null
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
  const email = normalizeEmail(body?.email)
  const password = String(body?.password || '')

  if (!username || !password || !email) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Användarnamn, e-post och lösenord måste anges.' }))
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

  if (!isValidEmail(email)) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'E-postadressen är inte giltig.' }))
    return
  }

  const users = await loadUsersFromStore()
  const usernameLower = username.toLowerCase()
  const exists = users.some((entry) => entry.usernameLower === usernameLower)
  const emailExists = users.some((entry) => normalizeEmail(entry.email) === email)

  if (exists) {
    response.statusCode = 409
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Användarnamnet är redan upptaget.' }))
    return
  }

  if (emailExists) {
    response.statusCode = 409
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'E-postadressen används redan.' }))
    return
  }

  const newUser = {
    id: crypto.randomUUID(),
    username,
    email,
    usernameLower,
    passwordHash: hashPassword(password),
    favorites: [],
    bookings: [],
    seen: [],
    followedArtists: [],
    followedVenues: []
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
  const ip = getClientIp(request)

  if (isUserLoginRateLimited(ip)) {
    response.statusCode = 429
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'För många försök. Försök igen senare.' }))
    return
  }

  const users = await loadUsersFromStore()
  const identity = username.toLowerCase()
  const user = users.find(
    (entry) =>
      entry.usernameLower === identity ||
      normalizeEmail(entry.email) === identity
  )

  if (!user || user.passwordHash !== hashPassword(password)) {
    registerUserLoginFailedAttempt(ip)
    response.statusCode = 401
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Fel användarnamn eller lösenord.' }))
    return
  }

  clearUserLoginFailedAttempts(ip)

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

function buildResetUrl(token) {
  const explicitBase = String(process.env.APP_BASE_URL || '').trim()
  const base = explicitBase || 'http://localhost:5173'
  return `${base.replace(/\/$/, '')}/?resetToken=${encodeURIComponent(token)}`
}

export function isMailDeliveryConfigured() {
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim()
  const fromEmail = String(process.env.RESET_EMAIL_FROM || '').trim()
  return Boolean(resendApiKey && fromEmail)
}

async function sendResetPasswordEmail(email, resetLink) {
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim()
  const fromEmail = String(process.env.RESET_EMAIL_FROM || '').trim()

  if (resendApiKey && fromEmail) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Återställ ditt lösenord',
        html: `<p>Klicka på länken för att återställa lösenordet:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Länken gäller i 30 minuter.</p>`
      })
    })

    if (!response.ok) {
      const payload = await response.text().catch(() => '')
      throw new Error(`Kunde inte skicka återställningsmail (${response.status}): ${payload}`)
    }

    return
  }

  console.info(`[PasswordReset] ${email} -> ${resetLink}`)
}

export async function handleUserForgotPassword(request, response, body) {
  const email = normalizeEmail(body?.email)
  if (!email || !isValidEmail(email)) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Ange en giltig e-postadress.' }))
    return
  }

  const users = await loadUsersFromStore()
  const user = users.find((entry) => normalizeEmail(entry.email) === email)

  const configured = isMailDeliveryConfigured()

  if (user) {
    const token = crypto.randomBytes(24).toString('hex')
    const tokenHash = hashResetToken(token)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString()

    const nextUsers = users.map((entry) =>
      entry.id === user.id
        ? { ...entry, resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt }
        : entry
    )
    await saveUsersToStore(nextUsers)
    await sendResetPasswordEmail(email, buildResetUrl(token))
  }

  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(
    JSON.stringify({
      ok: true,
      message: configured
        ? 'Om e-postadressen finns skickas en återställningslänk.'
        : 'Testläge: återställningslänk loggas i serverloggar.'
    })
  )
}

export async function handleUserResetPassword(request, response, body) {
  const token = String(body?.token || '').trim()
  const newPassword = String(body?.newPassword || '')

  if (!token || !newPassword) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Token och nytt lösenord måste anges.' }))
    return
  }

  if (newPassword.length < 8) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Lösenordet måste vara minst 8 tecken.' }))
    return
  }

  const users = await loadUsersFromStore()
  const tokenHash = hashResetToken(token)
  const now = Date.now()

  const user = users.find((entry) => {
    if (!entry.resetTokenHash || !entry.resetTokenExpiresAt) return false
    if (entry.resetTokenHash !== tokenHash) return false
    const expires = new Date(entry.resetTokenExpiresAt).getTime()
    return Number.isFinite(expires) && expires >= now
  })

  if (!user) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Återställningslänken är ogiltig eller har gått ut.' }))
    return
  }

  const nextUsers = users.map((entry) =>
    entry.id === user.id
      ? {
          ...entry,
          passwordHash: hashPassword(newPassword),
          resetTokenHash: null,
          resetTokenExpiresAt: null
        }
      : entry
  )

  await saveUsersToStore(nextUsers)
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ ok: true }))
}
