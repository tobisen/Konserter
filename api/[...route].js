import { handleApiRequest } from '../server/api'

export default async function handler(request, response) {
  await handleApiRequest(request, response)
}
