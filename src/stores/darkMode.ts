import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { STORAGE_KEYS } from '@/constants'

export const useDarkModeStore = defineStore('darkMode', () => {
  const isEnabled: Ref<boolean, boolean> = ref(false)
  const isInProgress: Ref<boolean, boolean> = ref(false)

  function init(): void {
    if (typeof localStorage === 'undefined' || typeof window === 'undefined') {
      return
    }

    const stored = localStorage[STORAGE_KEYS.DARK_MODE]

    // If stored preference exists, use it
    if (stored === '1') {
      set(true, false)
    } else if (stored === '0') {
      set(false, false)
    } else {
      // No preference stored, check system preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        set(true, false)
      }
    }
  }

  function reset(): void {
    localStorage.removeItem(STORAGE_KEYS.DARK_MODE)
    init()
  }

  function set(payload: null | boolean = null, persist: boolean = false): void {
    const setIsEnabled: boolean = payload !== null ? payload : !isEnabled.value

    isEnabled.value = setIsEnabled
    isInProgress.value = true

    if (typeof document !== 'undefined') {
      if (setIsEnabled) {
        document.documentElement.classList.add('dark')
        document.body.classList.add('dark-scrollbars')
      } else {
        document.documentElement.classList.remove('dark')
        document.body.classList.remove('dark-scrollbars')
      }
    }

    setTimeout(() => {
      isInProgress.value = false
    }, 200)

    if (persist && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.DARK_MODE, setIsEnabled ? '1' : '0')
    }
  }

  return {
    isEnabled,
    isInProgress,
    init,
    reset,
    set,
  }
})
