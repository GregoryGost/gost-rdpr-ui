<script setup lang="ts">
import { APP_NAME, APP_DESCRIPTION, APP_AUTHOR } from '@/constants'

/**
 * Application footer component
 * @component AppFooter
 */
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer
    class="border-t bg-white dark:bg-gray-800 dark:border-gray-700 px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400"
  >
    <p>© {{ currentYear }} {{ APP_AUTHOR }} · {{ APP_NAME }} {{ APP_DESCRIPTION }}</p>
  </footer>
</template>

<style scoped>
</style>
