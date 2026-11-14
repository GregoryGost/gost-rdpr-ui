import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

/** Reuses the app's configuration factory; configEnv selects test mode without Vue DevTools. */
export default defineConfig((configEnv) =>
  mergeConfig(viteConfig(configEnv), {
    test: {
      globals: false,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.spec.ts'],
      exclude: [...configDefaults.exclude, 'e2e/**'],
      coverage: {
        provider: 'v8',
        reportsDirectory: './coverage',
        reporter: ['text', 'html', 'lcov', 'json-summary'],
        include: [
          'src/composables/use*.ts',
          'src/utils/clientPagination.ts',
          'src/utils/attemptsPagination.ts',
          'src/ui/tables/columnFilters.ts',
          'src/api/client.ts',
          'src/api/endpoints/*.ts',
          'src/stores/*.ts',
          'src/ui/tables/*.vue',
          'src/ui/modals/*.vue',
        ],
      },
    },
  }),
)
