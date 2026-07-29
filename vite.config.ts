import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import tailwindcss from '@tailwindcss/vite'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

const buildDateUtc = new Date().toISOString().slice(0, 10)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    target: ['chrome111', 'edge111', 'firefox128', 'safari16.4', 'ios16.4'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_DATE_UTC__: JSON.stringify(buildDateUtc),
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    watch: {
      ignored: [
        '**/coverage/**',
        '**/playwright-report/**',
        '**/blob-report/**',
        '**/.nyc_output/**',
        '**/playwright/.cache/**',
        '**/dist-ssr/**',
        '**/.pnpm-store/**',
        '**/.agents/**',
        '**/.codex/**',
        '**/.idea/**',
        '**/.vscode/**',
        '**/*.tsbuildinfo',
        '**/.eslintcache',
        '**/.stylelintcache',
        '**/.prettier-cache',
        '**/lint-result.html',
      ],
    },
  },
  base: process.env.BASE_URL,
  plugins: [vue(), vueDevTools(), tailwindcss()],
  css: {
    devSourcemap: mode === 'development',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
