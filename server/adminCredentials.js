import crypto from 'node:crypto'
import {
  loadAdminCredentialsFromStore,
  saveAdminCredentialsToStore
} from './storage.js'

function parsePasswordHash(hash) {
  if (!hash || typeof hash !== 'string') return null

  if (hash.startsWith('sha256:')) {
    return { type: 'sha256', digest: hash.slice('sha256:'.length) }
  }

  if (hash.startsWith('scrypt:')) {
    const [, saltBase64, keyBase64] = hash.split(':')
    if (!saltBase64 || !keyBase64) return null
    return { type: 'scrypt', saltBase64, keyBase64 }
  }

  return null
}

function timingSafeEqualStrings(a, b) {
  const aBuffer = Buffer.from(String(a))
  const bBuffer = Buffer.from(String(b))

  if (aBuffer.length !== bBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

function verifyPasswordFromHash(password, hash) {
  const parsed = parsePasswordHash(hash)
  if (!parsed) return false

  if (parsed.type === 'sha256') {
    const digest = crypto.createHash('sha256').update(password).digest('hex')
    return timingSafeEqualStrings(digest, parsed.digest)
  }

  if (parsed.type === 'scrypt') {
    const salt = Buffer.from(parsed.saltBase64, 'base64')
    const expectedKey = Buffer.from(parsed.keyBase64, 'base64')
    const derivedKey = crypto.scryptSync(password, salt, expectedKey.length)
    return crypto.timingSafeEqual(derivedKey, expectedKey)
  }

  return false
}

function createScryptHash(password) {
  const salt = crypto.randomBytes(16)
  const key = crypto.scryptSync(password, salt, 64)
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`
}

export async function getEffectiveAdminCredentials() {
  const fromStore = await loadAdminCredentialsFromStore()
  if (
    fromStore &&
    typeof fromStore.username === 'string' &&
    typeof fromStore.passwordHash === 'string'
  ) {
    return {
      username: fromStore.username,
      passwordHash: fromStore.passwordHash,
      password: null,
      source: 'store'
    }
  }

  return {
    username: process.env.ADMIN_USERNAME || '',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    password: process.env.ADMIN_PASSWORD || '',
    source: 'env'
  }
}

export async function verifyAdminCredentials(username, password) {
  const creds = await getEffectiveAdminCredentials()

  if (!creds.username || !timingSafeEqualStrings(username, creds.username)) {
    return false
  }

  if (creds.passwordHash) {
    return verifyPasswordFromHash(password, creds.passwordHash)
  }

  if (creds.password) {
    return timingSafeEqualStrings(password, creds.password)
  }

  return false
}

export async function changeAdminPassword({ username, newPassword }) {
  const newHash = createScryptHash(newPassword)
  await saveAdminCredentialsToStore({ username, passwordHash: newHash })
}
