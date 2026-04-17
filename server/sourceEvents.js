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

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function cleanupText(value) {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
}

function normalizeUrlLike(value) {
  const text = cleanupText(value)
  if (!text) return ''

  if (text.startsWith('//')) {
    return `https:${text}`
  }

  return text
}

function pickImageUrlFromUnknown(value) {
  if (!value) return ''

  if (typeof value === 'string') {
    return normalizeUrlLike(value)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickImageUrlFromUnknown(item)
      if (found) return found
    }
    return ''
  }

  if (typeof value === 'object') {
    const candidates = [
      value.url,
      value.src,
      value.secure_url,
      value.contentUrl
    ]

    for (const candidate of candidates) {
      const found = normalizeUrlLike(candidate)
      if (found) return found
    }
  }

  return ''
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

function extractJsonScriptBlocks(html) {
  const blocks = []
  const pattern = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi

  let match = pattern.exec(html)
  while (match) {
    const content = String(match[1] || '').trim()
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
    city: pickCity(eventNode),
    genre: cleanupText(eventNode?.genre),
    detailsUrl: cleanupText(eventNode?.url),
    imageUrl: pickImageUrlFromUnknown(eventNode?.image)
  }
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = cleanupText(value)
    if (text) return text
  }

  return ''
}

function pickDateTextFromUnknown(event) {
  const candidates = [
    event?.startDate,
    event?.date,
    event?.eventDate,
    event?.startsAt,
    event?.start,
    event?.datetime,
    event?.publishedAt
  ]

  for (const candidate of candidates) {
    const text = cleanupText(candidate)
    if (!text) continue
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }

    const swedish = parseSwedishDateWithRollingYear(text)
    if (swedish) {
      return swedish
    }
  }

  return ''
}

function normalizeUnknownEventObject(event, sourceUrl = null) {
  if (!event || typeof event !== 'object') return null

  const title = pickFirstText(event?.title, event?.name, event?.eventName)
  const artist = pickFirstText(
    event?.artist,
    event?.performer?.name,
    event?.performer,
    title
  )
  const date = pickDateTextFromUnknown(event)

  if (!title || !artist || !date) {
    return null
  }

  const detailsUrl = normalizeUrlLike(
    event?.detailsUrl || event?.url || event?.link || event?.slug
  )

  const venue = pickFirstText(
    event?.venue,
    event?.location?.name,
    event?.location,
    sourceUrl?.hostname.includes('fallan.nu') ? 'Fållan' : ''
  ) || 'Okänd scen'

  const city = pickFirstText(
    event?.city,
    event?.location?.address?.addressLocality,
    sourceUrl?.hostname.includes('fallan.nu') ? 'Stockholm' : ''
  ) || 'Okänd stad'

  return {
    artist,
    title,
    date,
    venue,
    city,
    genre: pickFirstText(event?.genre, event?.category),
    detailsUrl,
    imageUrl: pickImageUrlFromUnknown(event?.image || event?.imageUrl || event?.poster)
  }
}

function collectLikelyEventObjects(node, output = []) {
  if (!node || typeof node !== 'object') {
    return output
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectLikelyEventObjects(item, output)
    }
    return output
  }

  const hasNameLike = Boolean(node?.title || node?.name || node?.eventName)
  const hasDateLike = Boolean(
    node?.startDate || node?.date || node?.eventDate || node?.startsAt || node?.start
  )

  if (hasNameLike && hasDateLike) {
    output.push(node)
  }

  for (const value of Object.values(node)) {
    collectLikelyEventObjects(value, output)
  }

  return output
}

function parseConcertsFromEmbeddedJson(html, sourceUrl = null) {
  const blocks = extractJsonScriptBlocks(html)
  if (blocks.length === 0) {
    return []
  }

  const concerts = []

  for (const block of blocks) {
    const parsed = parsePossiblyJson(block)
    if (!parsed) continue

    const candidates = collectLikelyEventObjects(parsed)
    for (const candidate of candidates) {
      const normalized = normalizeUnknownEventObject(candidate, sourceUrl)
      if (normalized) {
        concerts.push(normalized)
      }
    }
  }

  return concerts
}

const ENGLISH_MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
}

function parseEnglishDateFromParts(monthText, dayText, yearText, hourText, minuteText) {
  const month = ENGLISH_MONTHS[String(monthText || '').slice(0, 3).toLowerCase()]
  const day = Number(dayText)
  const year = Number(yearText)
  const hour = Number.isInteger(Number(hourText)) ? Number(hourText) : 20
  const minute = Number.isInteger(Number(minuteText)) ? Number(minuteText) : 0

  if (month == null || !Number.isInteger(day) || !Number.isInteger(year)) {
    return null
  }

  const date = new Date(Date.UTC(year, month, day, hour - 2, minute))
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function parseFallanEventsFromHtml(html, sourceUrl = null) {
  if (!sourceUrl?.hostname?.includes('fallan.nu')) {
    return []
  }

  const anchors = [
    ...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)
  ]

  const concerts = []

  for (const [, hrefRaw, anchorInner] of anchors) {
    const text = cleanupText(stripHtmlTags(anchorInner))
    if (!text) continue
    if (!/(Concert|Club|Festival|Market)/i.test(text)) continue
    if (!/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(text)) continue

    const dateMatch = text.match(
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(20\d{2})\b/i
    )
    if (!dateMatch) continue

    const doorsTimeMatch = text.match(/DOORS:\s*(\d{1,2})[:.](\d{2})/i)
    const isoDate = parseEnglishDateFromParts(
      dateMatch[1],
      dateMatch[2],
      dateMatch[3],
      doorsTimeMatch?.[1],
      doorsTimeMatch?.[2]
    )
    if (!isoDate) continue

    const withoutPrefix = text.replace(/^(Concert|Club|Festival|Market|Club XL)\s*/i, '')
    const afterDate = withoutPrefix.replace(
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s*20\d{2}\s*/i,
      ''
    )

    const beforeAge = afterDate.split(/\bAge:/i)[0].trim()
    const venueMatch = beforeAge.match(/\b(Fållan|Lilla Fållan|Förbindelsehallen|BAR15)\b/i)
    const venue = cleanupText(venueMatch?.[1]) || 'Fållan'
    const artist = cleanupText(
      venueMatch ? beforeAge.replace(venueMatch[0], '').trim() : beforeAge
    )
    if (!artist) continue

    const detailsUrl = normalizeUrlLike(hrefRaw)
    concerts.push({
      artist,
      title: artist,
      date: isoDate,
      venue,
      city: 'Stockholm',
      genre: '',
      detailsUrl,
      imageUrl: ''
    })
  }

  const deduped = []
  const seen = new Set()
  for (const concert of concerts) {
    const key = `${concert.artist}|${concert.venue}|${concert.date}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(concert)
  }

  return deduped
}

function parseConcertsFromJsonPayload(payload) {
  const rawEvents = pickEventsPayload(payload)
  return rawEvents
    .map((event) => ({
      artist: cleanupText(event?.artist),
      title: cleanupText(event?.title),
      date: cleanupText(event?.date),
      venue: cleanupText(event?.venue),
      city: cleanupText(event?.city),
      genre: cleanupText(event?.genre),
      detailsUrl: cleanupText(event?.detailsUrl || event?.url || event?.link),
      imageUrl: normalizeUrlLike(
        event?.imageUrl ||
          event?.image ||
          event?.thumbnail ||
          event?.thumbnailUrl ||
          event?.poster
      )
    }))
    .filter((event) => {
      if (!event.artist || !event.title || !event.venue || !event.city || !event.date) {
        return false
      }
      const parsedDate = new Date(event.date)
      return !Number.isNaN(parsedDate.getTime())
    })
}

function parseConcertsFromHtml(html, sourceUrl = null) {
  const jsonLdBlocks = extractJsonLdBlocks(html)
  const eventNodes = []

  for (const block of jsonLdBlocks) {
    const parsed = parsePossiblyJson(block)
    if (!parsed) continue
    collectEventNodes(parsed, eventNodes)
  }

  const fromJsonLd = eventNodes.map(normalizeEventNode).filter(Boolean)
  if (fromJsonLd.length > 0) {
    return fromJsonLd
  }

  const fromEmbeddedJson = parseConcertsFromEmbeddedJson(html, sourceUrl)
  if (fromEmbeddedJson.length > 0) {
    return fromEmbeddedJson
  }

  const fromFallanHtml = parseFallanEventsFromHtml(html, sourceUrl)
  if (fromFallanHtml.length > 0) {
    return fromFallanHtml
  }

  return parseKaliberEventsFromHtml(html, sourceUrl)
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
    /(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)(?:\s+(20\d{2}))?(?:[^\d]{0,20}(?:(?:kl\.?|klockan)\s*)?(\d{1,2})[:.](\d{2}))?/i

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

const ENGLISH_MONTHS_FULL = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
}

function parseEnglishDateFromText(text) {
  const cleaned = cleanupText(text)
  const match = cleaned.match(
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})(?:[^\d]{0,20}(\d{1,2})[:.](\d{2}))?/i
  )

  if (!match) return null

  const day = Number(match[1])
  const month = ENGLISH_MONTHS_FULL[String(match[2] || '').toLowerCase()]
  const year = Number(match[3])
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

function parseSwedishDateWithRollingYear(dateText) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentYearIso = parseSwedishDateFromText(dateText, currentYear)
  if (!currentYearIso) {
    return null
  }

  const candidate = new Date(currentYearIso)
  const ninetyDaysAgo = new Date(now)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  if (candidate < ninetyDaysAgo) {
    return parseSwedishDateFromText(dateText, currentYear + 1)
  }

  return currentYearIso
}

function stageLabelToSlug(value) {
  return cleanupText(value)
    .toLowerCase()
    .replace(/&/g, ' och ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseKaliberEventsFromHtml(html, sourceUrl = null) {
  const stageFilter = cleanupText(sourceUrl?.searchParams?.get('stage')).toLowerCase()
  const stageSlugFilter = cleanupText(sourceUrl?.searchParams?.get('stageSlug')).toLowerCase()
  const stageFilters = [stageFilter, stageSlugFilter].filter(Boolean)
  const hasStageFilter = stageFilters.length > 0

  const kaliberLiveItems = [...html.matchAll(/<div[^>]*class="[^"]*events__list-item[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi)]

  if (kaliberLiveItems.length > 0) {
    const concerts = []

    for (const itemMatch of kaliberLiveItems) {
      const itemHtml = itemMatch[0]
      const stageAttr = cleanupText(itemHtml.match(/\sdata-stage="([^"]+)"/i)?.[1]).toLowerCase()
      const stageLabel = cleanupText(itemHtml.match(/<span[^>]*class="[^"]*info__stage[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1])
      const stageLabelSlug = stageLabelToSlug(stageLabel)

      if (hasStageFilter) {
        const matched = stageFilters.some((filter) => {
          const normalizedFilter = stageLabelToSlug(filter)
          return (
            stageAttr === filter ||
            stageAttr === normalizedFilter ||
            stageLabelSlug === normalizedFilter
          )
        })

        if (!matched) {
          continue
        }
      }

      const dateText = cleanupText(itemHtml.match(/<span[^>]*class="[^"]*info__date[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1])
      const title = cleanupText(itemHtml.match(/<h2[^>]*class="[^"]*item__content-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
      const genre = cleanupText(itemHtml.match(/\sdata-genre="([^"]*)"/i)?.[1])
      const contentAnchorTag = itemHtml.match(/<a[^>]*class="[^"]*item__content[^"]*"[^>]*>/i)?.[0] || ''
      const detailsUrl = cleanupText(contentAnchorTag.match(/href="([^"]+)"/i)?.[1])
      const imageStyle = cleanupText(itemHtml.match(/<div[^>]*class="[^"]*item__image[^"]*"[^>]*style="([^"]+)"/i)?.[1])
      const imageUrl = normalizeUrlLike(imageStyle.match(/url\(['"]?([^'")]+)['"]?\)/i)?.[1])
      const isoDate = parseSwedishDateWithRollingYear(dateText)

      if (!title || !isoDate) {
        continue
      }

      concerts.push({
        artist: title,
        title,
        date: isoDate,
        venue: stageLabel || 'Okänd scen',
        city: 'Uppsala',
        genre,
        detailsUrl,
        imageUrl
      })
    }

    if (concerts.length > 0) {
      return concerts
    }
  }

  const kaliberRootMatch = html.match(
    /<div id="kaliber-events">([\s\S]*?)<\/div>\s*<\/div>/i
  )
  const scope = kaliberRootMatch ? kaliberRootMatch[1] : html

  const itemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi
  const concerts = []
  let itemMatch = itemPattern.exec(scope)

  while (itemMatch) {
    const itemHtml = itemMatch[1]

    const dateMatch = itemHtml.match(/<strong>([^<]+)<\/strong>/i)
    const artistMatch = itemHtml.match(/<h3>([^<]+)<\/h3>/i)

    const dateText = cleanupText(dateMatch?.[1])
    const artist = cleanupText(artistMatch?.[1])
    const isoDate = parseSwedishDateWithRollingYear(dateText)

    if (artist && isoDate) {
      const event = {
        artist,
        title: artist,
        date: isoDate,
        venue: 'Parksnäckan',
        city: 'Uppsala'
      }

      if (!hasStageFilter) {
        concerts.push(event)
      } else {
        const eventVenueSlug = stageLabelToSlug(event.venue)
        const matches = stageFilters.some((filter) => eventVenueSlug === stageLabelToSlug(filter))
        if (matches) concerts.push(event)
      }
    }

    itemMatch = itemPattern.exec(scope)
  }

  return concerts
}

function isKaliberEventsUrl(sourceUrl) {
  return (
    sourceUrl.hostname.includes('kaliberlive.com') &&
    sourceUrl.pathname.replace(/\/$/, '') === '/events'
  )
}

function getKaliberStageFilter(sourceUrl) {
  const stage = cleanupText(sourceUrl.searchParams.get('stage')).toLowerCase()
  if (stage) return stage

  const stageSlug = cleanupText(sourceUrl.searchParams.get('stageSlug')).toLowerCase()
  if (stageSlug) return stageSlug

  return ''
}

async function fetchKaliberFilteredConcerts(sourceUrl) {
  if (!isKaliberEventsUrl(sourceUrl)) {
    return []
  }

  const stage = getKaliberStageFilter(sourceUrl)
  if (!stage) {
    return []
  }

  const body = new URLSearchParams({
    action: 'filter_events',
    is_archive: '0',
    tab: '',
    'filter[stage]': stage,
    'filter[genre]': '',
    'filter[q]': ''
  })

  const response = await fetch('https://kaliberlive.com/wp-admin/admin-ajax.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'KonserterBot/1.0 (+https://local.app)'
    },
    body: body.toString()
  })

  if (!response.ok) {
    return []
  }

  const payload = await response.json().catch(() => null)
  const listHtml = payload?.data?.list_items
  if (!listHtml) {
    return []
  }

  return parseKaliberEventsFromHtml(String(listHtml), sourceUrl)
}

function inferConcertYearFromPageData(pageData) {
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

function parseParksResortsConcertsFromPageData(pageData, city) {
  const blocks = pageData?.result?.data?.contentfulContentPage?.blocks || []
  const nestedBlocks = blocks.flatMap((block) => block.blocks || [])
  const filterBlock = nestedBlocks.find((block) =>
    ['ContentfulFilterListBlock', 'ContentfulListBlock'].includes(
      block.__typename
    )
  )
  const listObjects = filterBlock?.lists?.[0]?.listObjects || []
  const fallbackYear = inferConcertYearFromPageData(pageData)

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
        city,
        imageUrl: normalizeUrlLike(
          item?.image?.file?.url ||
            item?.image?.url ||
            item?.heroImage?.file?.url ||
            item?.heroImage?.url
        )
      }
    })
    .filter(Boolean)
}

function getParksResortsPageDataCity(hostname) {
  if (hostname.includes('furuvik.se')) return 'Furuvik'
  if (hostname.includes('gronalund.com')) return 'Stockholm'
  return null
}

async function fetchParksResortsPageDataConcerts(sourceUrl) {
  const city = getParksResortsPageDataCity(sourceUrl.hostname)
  if (!city) {
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
  return parseParksResortsConcertsFromPageData(payload, city)
}

function parseDalhallaConcertFromWpPost(post, sourceUrl) {
  const title = cleanupText(post?.title?.rendered)
  const detailsUrl = normalizeUrlLike(post?.link)
  const contentText = stripHtmlTags(post?.content?.rendered)

  const date =
    parseSwedishDateWithRollingYear(contentText) ||
    parseEnglishDateFromText(contentText)

  if (!title || !date) {
    return null
  }

  const imageUrl = normalizeUrlLike(
    post?.yoast_head_json?.og_image?.[0]?.url ||
      post?.yoast_head_json?.twitter_image ||
      ''
  )

  return {
    artist: title,
    title,
    date,
    venue: 'Dalhalla',
    city: 'Rättvik',
    genre: '',
    detailsUrl: detailsUrl || sourceUrl.origin,
    imageUrl
  }
}

async function fetchDalhallaConcertsFromWpApi(sourceUrl) {
  if (!sourceUrl.hostname.includes('dalhalla.se')) {
    return []
  }

  const concerts = []
  const seen = new Set()
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= 6) {
    const endpoint = `${sourceUrl.origin}/wp-json/wp/v2/konsert?per_page=100&page=${page}`
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'KonserterBot/1.0 (+https://local.app)'
      }
    })

    if (!response.ok) {
      break
    }

    const pageItems = await response.json().catch(() => [])
    if (!Array.isArray(pageItems) || pageItems.length === 0) {
      break
    }

    totalPages = Number(response.headers.get('x-wp-totalpages') || totalPages || 1)

    for (const post of pageItems) {
      const normalized = parseDalhallaConcertFromWpPost(post, sourceUrl)
      if (!normalized) continue

      const key = `${normalized.artist}|${normalized.date}`
      if (seen.has(key)) continue
      seen.add(key)
      concerts.push(normalized)
    }

    page += 1
  }

  return concerts
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

  const kaliberFilteredConcerts = await fetchKaliberFilteredConcerts(sourceUrl)
  if (kaliberFilteredConcerts.length > 0) {
    return kaliberFilteredConcerts
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
      concerts = parseConcertsFromHtml(body, sourceUrl)
    }
  }

  if (concerts.length === 0) {
    const dalhallaConcerts = await fetchDalhallaConcertsFromWpApi(sourceUrl)
    if (dalhallaConcerts.length > 0) {
      concerts = dalhallaConcerts
    }
  }

  if (concerts.length === 0) {
    const fallbackConcerts = await fetchParksResortsPageDataConcerts(sourceUrl)
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
