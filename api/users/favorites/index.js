import { handleApiRequest } from '../../../server/api.js'

export default async function handler(request, response) {
  request.url = '/api/users/favorites'
  await handleApiRequest(request, response)
}
