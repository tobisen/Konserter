import { handleApiRequest } from '../server/api.js'

export default async function handler(request, response) {
  const routeValue = request.query?.route
  let routeParts = Array.isArray(routeValue)
    ? routeValue
    : routeValue
      ? [routeValue]
      : []

  // Fallback for runtimes where req.query.route is missing in catch-all handlers.
  if (routeParts.length === 0 && typeof request.url === 'string') {
    const parsed = new URL(request.url, 'http://localhost')
    routeParts = parsed.pathname
      .replace(/^\/api\/?/, '')
      .split('/')
      .filter(Boolean)
  }

  const queryString = request.url?.includes('?')
    ? request.url.slice(request.url.indexOf('?'))
    : ''

  request.url = `/api/${routeParts.join('/')}${queryString}`
  await handleApiRequest(request, response)
}
