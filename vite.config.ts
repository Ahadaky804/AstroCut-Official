import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleAiApiRequest } from './server/aiMiddleware.ts'

function astrocutAiServerPlugin(): Plugin {
  return {
    name: 'astrocut-ai-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleAiApiRequest(req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch(next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleAiApiRequest(req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch(next)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), astrocutAiServerPlugin()],
})
