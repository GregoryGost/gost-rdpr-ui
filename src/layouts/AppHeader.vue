<script setup lang="ts">
import { useDarkModeStore } from '@/stores/darkMode'
import { Bars3Icon, SunIcon, MoonIcon } from '@heroicons/vue/24/outline'
import HeaderPatternBackground from '@/components/images/backgrounds/HeaderPatternBackground.vue'

/**
 * Application header component
 * @component AppHeader
 */
defineProps<{
  /** Opens the mobile navigation dialog. */
  onMenuToggle: () => void
  /** Indicates whether the mobile navigation dialog is open. */
  isMenuOpen: boolean
}>()

const darkMode = useDarkModeStore()
</script>

<template>
  <header class="header-with-pattern sticky top-0 z-10 border-b px-4 shadow-sm dark:border-gray-700">
    <HeaderPatternBackground />

    <div class="header-content flex h-16 items-center gap-x-4">
      <button
        type="button"
        aria-label="Открыть меню"
        aria-haspopup="dialog"
        :aria-expanded="isMenuOpen"
        class="rounded-lg p-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500 lg:hidden dark:hover:bg-gray-700"
        @click="onMenuToggle"
      >
        <Bars3Icon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
      </button>
      <div class="flex flex-1 justify-end gap-x-4">
        <button
          @click="darkMode.set(null, true)"
          class="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Переключить тему"
          :aria-pressed="darkMode.isEnabled"
        >
          <SunIcon v-if="darkMode.isEnabled" class="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <MoonIcon v-else class="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header-with-pattern {
  position: relative;
  overflow: hidden;
}

.header-content {
  position: relative;
  z-index: 1;
}
</style>
