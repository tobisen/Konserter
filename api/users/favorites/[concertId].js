import { handleApiRequest } from '../../../server/api.js'

export default async function handler(request, response) {
  const concertId = request.query?.concertId
  const normalized = Array.isArray(concertId) ? concertId[0] : concertId
  request.url = `/api/users/favorites/${encodeURIComponent(normalized || '')}`
  await handleApiRequest(request, response)
}
