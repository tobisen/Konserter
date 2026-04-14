import { promises as fs } from 'node:fs'
import path from 'node:path'

const dataDir = path.resolve(process.cwd(), 'data')
const sourcesFile = path.join(dataDir, 'sources.json')
const concertsFile = path.join(dataDir, 'concerts.json')
const adminFile = path.join(dataDir, 'admin.json')
const usersFile = path.join(dataDir, 'users.json')

const KV_SOURCES_KEY = 'konserter:sources'
const KV_CONCERTS_KEY = 'konserter:concerts'
const KV_ADMIN_KEY = 'konserter:admin'
const KV_USERS_KEY = 'konserter:users'

function hasKvConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function runKvCommand(command) {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    throw new Error('KV är inte konfigurerat')
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `KV-fel (${response.status})`)
  }

  return payload?.result
}

async function kvReadJson(key, fallbackValue) {
  const result = await runKvCommand(['GET', key])

  if (result == null) {
    return fallbackValue
  }

  try {
    return JSON.parse(result)
  } catch {
    return fallbackValue
  }
}

async function kvWriteJson(key, value) {
  await runKvCommand(['SET', key, JSON.stringify(value)])
}

async function ensureDataFiles() {
  await fs.mkdir(dataDir, { recursive: true })

  const defaults = [
    { file: sourcesFile, initial: '[]\n' },
    { file: concertsFile, initial: '[]\n' },
    { file: usersFile, initial: '[]\n' }
  ]

  for (const { file, initial } of defaults) {
    try {
      await fs.access(file)
    } catch {
      await fs.writeFile(file, initial, 'utf8')
    }
  }
}

async function readJsonArrayFromFile(filePath) {
  await ensureDataFiles()

  try {
    const content = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeJsonArrayToFile(filePath, data) {
  await ensureDataFiles()
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function readJsonObjectFromFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(content)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function writeJsonObjectToFile(filePath, data) {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export async function loadSourcesFromFile() {
  if (hasKvConfig()) {
    return kvReadJson(KV_SOURCES_KEY, [])
  }

  return readJsonArrayFromFile(sourcesFile)
}

export async function saveSourcesToFile(sources) {
  if (hasKvConfig()) {
    await kvWriteJson(KV_SOURCES_KEY, sources)
    return
  }

  await writeJsonArrayToFile(sourcesFile, sources)
}

export async function loadConcertsFromFile() {
  if (hasKvConfig()) {
    return kvReadJson(KV_CONCERTS_KEY, [])
  }

  return readJsonArrayFromFile(concertsFile)
}

export async function saveConcertsToFile(concerts) {
  if (hasKvConfig()) {
    await kvWriteJson(KV_CONCERTS_KEY, concerts)
    return
  }

  await writeJsonArrayToFile(concertsFile, concerts)
}

export async function loadUsersFromStore() {
  if (hasKvConfig()) {
    return kvReadJson(KV_USERS_KEY, [])
  }

  return readJsonArrayFromFile(usersFile)
}

export async function saveUsersToStore(users) {
  if (hasKvConfig()) {
    await kvWriteJson(KV_USERS_KEY, users)
    return
  }

  await writeJsonArrayToFile(usersFile, users)
}

export async function loadAdminCredentialsFromStore() {
  if (hasKvConfig()) {
    const stored = await kvReadJson(KV_ADMIN_KEY, null)
    return stored && typeof stored === 'object' ? stored : null
  }

  return readJsonObjectFromFile(adminFile)
}

export async function saveAdminCredentialsToStore(payload) {
  if (hasKvConfig()) {
    await kvWriteJson(KV_ADMIN_KEY, payload)
    return
  }

  await writeJsonObjectToFile(adminFile, payload)
}
