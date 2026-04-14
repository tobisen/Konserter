import { handleApiRequest } from '../server/api.js'

export default async function handler(request, response) {
  await handleApiRequest(request, response)
}
