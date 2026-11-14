import { afterEach, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'

/** Restores per-test browser and timer state after mounted components have released their resources. */
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  if (vi.isFakeTimers()) {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
  localStorage.clear()
  sessionStorage.clear()
  document.documentElement.classList.remove('dark')
  document.body.className = ''
  document.body.replaceChildren()
})

// Vitest unwinds afterEach hooks in reverse registration order, so wrappers must register their cleanup last.
enableAutoUnmount(afterEach)
