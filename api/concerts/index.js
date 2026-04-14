import { handleApiRequest } from '../../server/api.js'

export default async function handler(request, response) {
  request.url = '/api/concerts'
  await handleApiRequest(request, response)
}
