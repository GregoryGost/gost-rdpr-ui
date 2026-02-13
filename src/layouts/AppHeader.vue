<script setup lang="ts">
import { useDarkModeStore } from '@/stores/darkMode'
import { Bars3Icon, SunIcon, MoonIcon } from '@heroicons/vue/24/outline'

/**
 * Application header component
 * @component AppHeader
 */
defineProps<{
  onMenuToggle: () => void
}>()

const darkMode = useDarkModeStore()
</script>

<template>
  <header
    class="sticky top-0 z-10 flex h-16 items-center gap-x-4 border-b bg-white px-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <button @click="onMenuToggle" class="rounded-lg p-2 hover:bg-gray-100 lg:hidden dark:hover:bg-gray-700">
      <Bars3Icon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
    </button>
    <div class="flex flex-1 justify-end gap-x-4">
      <button
        @click="darkMode.set(null, true)"
        class="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Переключить тему"
      >
        <SunIcon v-if="darkMode.isEnabled" class="h-5 w-5 text-gray-600 dark:text-gray-400" />
        <MoonIcon v-else class="h-5 w-5 text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  </header>
</template>

<style scoped></style>
