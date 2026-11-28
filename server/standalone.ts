import { existsSync, readFileSync, statSync } from 'node:fs'
import http from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { handleAiApiRequest } from './aiMiddleware.ts'
import { loadServerEnv } from './envLoader.ts'
import { handleTranscriptionApiRequest } from './transcriptionMiddleware.ts'

loadServerEnv(process.cwd())

const PORT = Number(process.env.PORT || 4173)
const DIST_DIR = resolve(process.cwd(), 'dist')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
}

const server = http.createServer(async (req, res) => {
  if (await handleAiApiRequest(req, res)) return
  if (await handleTranscriptionApiRequest(req, res)) return

  const reqPath = (req.url || '/').split('?')[0]
  const safeRel = normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '')
  let filePath = join(DIST_DIR, safeRel === '/' ? 'index.html' : safeRel)

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST_DIR, 'index.html')
  }

  if (!existsSync(filePath)) {
    res.statusCode = 404
    res.end('Production build not found. Run "npm run build" first.')
    return
  }

  const ext = extname(filePath)
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
  res.end(readFileSync(filePath))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AstroCut server listening at http://127.0.0.1:${PORT}`)
})
