import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleAiApiRequest } from './server/aiMiddleware.ts'
import { handleTranscriptionApiRequest } from './server/transcriptionMiddleware.ts'

function astrocutAiServerPlugin(): Plugin {
  const handleApi = async (
    req: Parameters<typeof handleAiApiRequest>[0],
    res: Parameters<typeof handleAiApiRequest>[1],
  ): Promise<boolean> => {
    if (await handleAiApiRequest(req, res)) return true
    if (await handleTranscriptionApiRequest(req, res)) return true
    return false
  }

  return {
    name: 'astrocut-ai-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleApi(req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch(next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleApi(req, res)
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
