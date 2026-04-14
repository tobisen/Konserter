import { handleApiRequest } from '../server/api.js'

function normalizeRouteParts(value) {
  const rawParts = Array.isArray(value)
    ? value
    : value
      ? [value]
      : []

  const expanded = rawParts
    .flatMap((part) => String(part).split('/'))
    .map((part) => part.trim())
    .filter(Boolean)

  if (expanded[0] === 'api') {
    return expanded.slice(1)
  }

  return expanded
}

export default async function handler(request, response) {
  let routeParts = normalizeRouteParts(request.query?.route)

  // Fallback for runtimes where req.query.route is missing in catch-all handlers.
  if (routeParts.length === 0 && typeof request.url === 'string') {
    const parsed = new URL(request.url, 'http://localhost')
    routeParts = parsed.pathname
      .replace(/^\/api\/?/, '')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
  }

  const queryString = request.url?.includes('?')
    ? request.url.slice(request.url.indexOf('?'))
    : ''

  request.url = `/api/${routeParts.join('/')}${queryString}`
  await handleApiRequest(request, response)
}
