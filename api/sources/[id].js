import { handleApiRequest } from '../../server/api.js'

export default async function handler(request, response) {
  const id = request.query?.id
  const idValue = Array.isArray(id) ? id[0] : id
  request.url = `/api/sources/${encodeURIComponent(idValue || '')}`
  await handleApiRequest(request, response)
}
