function toArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function pickEventsPayload(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.events)) return data.events
  if (Array.isArray(data?.concerts)) return data.concerts
  if (Array.isArray(data?.items)) return data.items
  return []
}

function cleanupText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function parsePossiblyJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function extractJsonLdBlocks(html) {
  const blocks = []
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

  let match = pattern.exec(html)
  while (match) {
    const content = cleanupText(match[1])
    if (content) {
      blocks.push(content)
    }
    match = pattern.exec(html)
  }

  return blocks
}

function isEventNode(node) {
  const type = node?.['@type']
  if (!type) return false
  const allTypes = toArray(type).map((item) => String(item).toLowerCase())
  return allTypes.some((item) => item.includes('event'))
}

function collectEventNodes(node, events = []) {
  if (!node || typeof node !== 'object') {
    return events
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectEventNodes(item, events)
    }
    return events
  }

  if (isEventNode(node)) {
    events.push(node)
  }

  for (const value of Object.values(node)) {
    collectEventNodes(value, events)
  }

  return events
}

function pickPerformerName(eventNode) {
  const performers = toArray(eventNode?.performer)
  for (const performer of performers) {
    if (typeof performer === 'string' && cleanupText(performer)) {
      return cleanupText(performer)
    }
    if (typeof performer === 'object' && cleanupText(performer?.name)) {
      return cleanupText(performer.name)
    }
  }

  if (cleanupText(eventNode?.organizer?.name)) {
    return cleanupText(eventNode.organizer.name)
  }

  return cleanupText(eventNode?.name)
}

function pickVenue(eventNode) {
  if (cleanupText(eventNode?.location?.name)) {
    return cleanupText(eventNode.location.name)
  }

  return 'Okänd scen'
}

function pickCity(eventNode) {
  const address = eventNode?.location?.address

  if (typeof address === 'string' && cleanupText(address)) {
    return cleanupText(address)
  }

  if (cleanupText(address?.addressLocality)) {
    return cleanupText(address.addressLocality)
  }

  if (cleanupText(address?.addressRegion)) {
    return cleanupText(address.addressRegion)
  }

  return 'Okänd stad'
}

function normalizeEventNode(eventNode) {
  const date = cleanupText(eventNode?.startDate)
  if (!date) {
    return null
  }

  const asDate = new Date(date)
  if (Number.isNaN(asDate.getTime())) {
    return null
  }

  const title = cleanupText(eventNode?.name)
  const artist = pickPerformerName(eventNode)

  return {
    artist: artist || title || 'Okänd artist',
    title: title || artist || 'Konsert',
    date: asDate.toISOString(),
    venue: pickVenue(eventNode),
    city: pickCity(eventNode)
  }
}

function parseConcertsFromJsonPayload(payload) {
  const rawEvents = pickEventsPayload(payload)
  return rawEvents
    .map((event) => ({
      artist: cleanupText(event?.artist),
      title: cleanupText(event?.title),
      date: cleanupText(event?.date),
      venue: cleanupText(event?.venue),
      city: cleanupText(event?.city)
    }))
    .filter((event) => {
      if (!event.artist || !event.title || !event.venue || !event.city || !event.date) {
        return false
      }
      const parsedDate = new Date(event.date)
      return !Number.isNaN(parsedDate.getTime())
    })
}

function parseConcertsFromHtml(html) {
  const jsonLdBlocks = extractJsonLdBlocks(html)
  const eventNodes = []

  for (const block of jsonLdBlocks) {
    const parsed = parsePossiblyJson(block)
    if (!parsed) continue
    collectEventNodes(parsed, eventNodes)
  }

  return eventNodes.map(normalizeEventNode).filter(Boolean)
}

function stripHtmlTags(value) {
  return cleanupText(String(value || '').replace(/<[^>]+>/g, ' '))
}

const SWEDISH_MONTHS = {
  januari: 0,
  februari: 1,
  mars: 2,
  april: 3,
  maj: 4,
  juni: 5,
  juli: 6,
  augusti: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11
}

function parseSwedishDateFromText(text, fallbackYear) {
  const cleaned = cleanupText(text)
  const pattern =
    /(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)(?:\s+(20\d{2}))?(?:[^\d]{0,20}(?:kl\.?|klockan)\s*(\d{1,2})[:.](\d{2}))?/i

  const match = cleaned.match(pattern)
  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = SWEDISH_MONTHS[match[2].toLowerCase()]
  const year = match[3] ? Number(match[3]) : fallbackYear
  const hour = match[4] ? Number(match[4]) : 20
  const minute = match[5] ? Number(match[5]) : 0

  if (!Number.isInteger(day) || month == null || !Number.isInteger(year)) {
    return null
  }

  const date = new Date(Date.UTC(year, month, day, hour - 2, minute))
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function inferFuruvikYear(pageData) {
  const markdownBlock = pageData?.result?.data?.contentfulContentPage?.blocks
    ?.flatMap((block) => block.blocks || [])
    ?.find((block) => block?.text?.childMarkdownRemark?.html)

  const text = stripHtmlTags(markdownBlock?.text?.childMarkdownRemark?.html)
  const yearMatch = text.match(/(20\d{2})/)
  if (yearMatch) {
    return Number(yearMatch[1])
  }

  return new Date().getFullYear()
}

function parseFuruvikConcertsFromPageData(pageData) {
  const blocks = pageData?.result?.data?.contentfulContentPage?.blocks || []
  const nestedBlocks = blocks.flatMap((block) => block.blocks || [])
  const filterBlock = nestedBlocks.find(
    (block) => block.__typename === 'ContentfulFilterListBlock'
  )
  const listObjects = filterBlock?.lists?.[0]?.listObjects || []
  const fallbackYear = inferFuruvikYear(pageData)

  return listObjects
    .map((item) => {
      const textPool = [
        item?.preamble?.preamble,
        item?.shortDescriptionInList,
        stripHtmlTags(item?.description?.childMarkdownRemark?.html)
      ]
        .filter(Boolean)
        .join(' ')

      const isoDate = parseSwedishDateFromText(textPool, fallbackYear)
      if (!isoDate) {
        return null
      }

      return {
        artist: cleanupText(item.title) || 'Okänd artist',
        title: cleanupText(item.title) || 'Konsert',
        date: isoDate,
        venue: cleanupText(item.location) || 'Stora Scen',
        city: 'Furuvik'
      }
    })
    .filter(Boolean)
}

async function fetchFuruvikPageDataConcerts(sourceUrl) {
  if (!sourceUrl.hostname.includes('furuvik.se')) {
    return []
  }

  const path = sourceUrl.pathname.replace(/\/$/, '') || '/'
  if (!path.startsWith('/konserter')) {
    return []
  }

  const pageDataPath = path === '/' ? '/page-data/index/page-data.json' : `/page-data${path}/page-data.json`
  const pageDataUrl = `${sourceUrl.origin}${pageDataPath}`

  const response = await fetch(pageDataUrl, {
    headers: {
      'User-Agent': 'KonserterBot/1.0 (+https://local.app)'
    }
  })

  if (!response.ok) {
    return []
  }

  const payload = await response.json()
  return parseFuruvikConcertsFromPageData(payload)
}

export async function fetchConcertsFromUrl(sourceUrlRaw) {
  let sourceUrl

  try {
    sourceUrl = new URL(sourceUrlRaw)
    if (!['http:', 'https:'].includes(sourceUrl.protocol)) {
      throw new Error('Invalid URL protocol')
    }
  } catch {
    throw new Error('Ogiltig käll-URL')
  }

  const upstream = await fetch(sourceUrl.toString(), {
    headers: {
      'User-Agent': 'KonserterBot/1.0 (+https://local.app)'
    }
  })

  if (!upstream.ok) {
    throw new Error(`Kunde inte läsa källa (${upstream.status})`)
  }

  const contentType = upstream.headers.get('content-type') || ''
  let concerts = []

  if (contentType.includes('application/json')) {
    const payload = await upstream.json()
    concerts = parseConcertsFromJsonPayload(payload)
  } else {
    const body = await upstream.text()
    const maybeJson = parsePossiblyJson(body)

    if (maybeJson) {
      concerts = parseConcertsFromJsonPayload(maybeJson)
    } else {
      concerts = parseConcertsFromHtml(body)
    }
  }

  if (concerts.length === 0) {
    const fallbackConcerts = await fetchFuruvikPageDataConcerts(sourceUrl)
    if (fallbackConcerts.length > 0) {
      concerts = fallbackConcerts
    }
  }

  return concerts
}

function withCors(response, origin = '*') {
  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export async function handleSourceEventsRequest(request, response) {
  withCors(response)

  if (request.method === 'OPTIONS') {
    response.statusCode = 204
    response.end()
    return
  }

  if (request.method !== 'GET') {
    response.statusCode = 405
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const sourceUrlRaw = request.url
    ? new URL(request.url, 'http://localhost').searchParams.get('url')
    : null

  if (!sourceUrlRaw) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Missing query parameter: url' }))
    return
  }

  try {
    const concerts = await fetchConcertsFromUrl(sourceUrlRaw)

    response.statusCode = 200
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ concerts }))
  } catch (error) {
    response.statusCode = 500
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unexpected scraping error'
      })
    )
  }
}
