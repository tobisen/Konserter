import { handleApiRequest } from '../../server/api.js'

export default async function handler(request, response) {
  request.url = '/api/concerts/update'
  await handleApiRequest(request, response)
}
