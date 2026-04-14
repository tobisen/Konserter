import { handleApiRequest } from '../../server/api.js'

export default async function handler(request, response) {
  request.url = '/api/auth/me'
  await handleApiRequest(request, response)
}
