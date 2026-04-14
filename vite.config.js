import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { handleApiRequest } from './server/api.js'

function apiPlugin() {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        try {
          await handleApiRequest(req, res)
        } catch (error) {
          next(error)
        }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        try {
          await handleApiRequest(req, res)
        } catch (error) {
          next(error)
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), apiPlugin()]
})
