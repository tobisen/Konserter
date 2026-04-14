import { handleApiRequest } from '../../server/api.js'

export default async function handler(request, response) {
  request.url = '/api/users/me'
  await handleApiRequest(request, response)
}
