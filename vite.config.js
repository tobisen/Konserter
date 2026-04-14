import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { handleApiRequest } from './server/api.js'
import { readFileSync } from 'node:fs'

function resolveAppVersion() {
  let appVersion = '0.0.0'
  let build = 0

  try {
    const packageRaw = readFileSync('./package.json', 'utf8')
    const packageJson = JSON.parse(packageRaw)
    appVersion = String(packageJson.version || appVersion)
  } catch {
    appVersion = '0.0.0'
  }

  try {
    const metaRaw = readFileSync('./build-meta.json', 'utf8')
    const meta = JSON.parse(metaRaw)
    if (Number.isInteger(meta?.build) && meta.build >= 0) {
      build = meta.build
    }
  } catch {
    build = 0
  }

  return `${appVersion}+build.${build}`
}

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
  plugins: [vue(), apiPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion())
  }
})
