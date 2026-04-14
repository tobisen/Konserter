import { handleApiRequest } from '../../server/api.js'

export default async function handler(request, response) {
  request.url = '/api/sources'
  await handleApiRequest(request, response)
}
