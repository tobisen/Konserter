import { handleApiRequest } from '../server/api.js'

export default async function handler(request, response) {
  const query = request.url?.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''
  request.url = `/api/source-events${query}`
  await handleApiRequest(request, response)
}
