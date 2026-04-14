import { handleApiRequest } from '../../server/api.js'

export default async function handler(request, response) {
  request.url = '/api/auth/change-password'
  await handleApiRequest(request, response)
}
