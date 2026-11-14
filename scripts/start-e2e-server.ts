import { build, preview } from 'vite'

// Vite gives process environment values priority over local env files when it embeds the public API URL.
process.env.VITE_API_BASE_URL = '/api'

await build({ mode: 'e2e', base: '/' })

// previewServer serves this build only on loopback; an empty proxy prevents forwarding unmatched API requests.
const previewServer = await preview({
  mode: 'e2e',
  base: '/',
  preview: { host: '127.0.0.1', port: 5001, strictPort: true, proxy: {} },
})

previewServer.printUrls()

/** Closes the preview listener; its completion callback exits after active HTTP connections finish. */
const closePreview = () => {
  previewServer.httpServer.close(() => process.exit(0))
}

process.once('SIGINT', closePreview)
process.once('SIGTERM', closePreview)
