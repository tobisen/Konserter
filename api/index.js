import { handleApiRequest } from '../server/api.js'

function normalizeRouteValue(routeValue) {
  if (Array.isArray(routeValue)) {
    return routeValue.join('/').replace(/^\/+|\/+$/g, '')
  }

  return String(routeValue || '').replace(/^\/+|\/+$/g, '')
}

function buildQueryString(query) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query || {})) {
    if (key === 'route') continue

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item))
      }
      continue
    }

    if (value != null) {
      params.set(key, String(value))
    }
  }

  const result = params.toString()
  return result ? `?${result}` : ''
}

export default async function handler(request, response) {
  let route = normalizeRouteValue(request.query?.route)

  if (!route && typeof request.url === 'string') {
    const parsed = new URL(request.url, 'http://localhost')
    route = parsed.pathname.replace(/^\/api\/?/, '').replace(/^\/+|\/+$/g, '')
  }

  const queryString = buildQueryString(request.query)
  request.url = `/api/${route}${queryString}`

  await handleApiRequest(request, response)
}
