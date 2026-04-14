import { handleApiRequest } from '../server/api.js'

export default async function handler(request, response) {
  const routeValue = request.query?.route
  const routeParts = Array.isArray(routeValue)
    ? routeValue
    : routeValue
      ? [routeValue]
      : []

  const queryString = request.url?.includes('?')
    ? request.url.slice(request.url.indexOf('?'))
    : ''

  request.url = `/api/${routeParts.join('/')}${queryString}`
  await handleApiRequest(request, response)
}
