import { handleApiRequest } from '../../server/api.js'

export default async function handler(request, response) {
  request.url = '/api/auth/login'
  await handleApiRequest(request, response)
}
