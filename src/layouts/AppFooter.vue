<script setup lang="ts">
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
    <p>© {{ currentYear }} Gregory Gost · GOST-RDPR Admin Panel</p>
  </footer>
</template>

<style scoped>
/* No styles - using Tailwind classes directly */
</style>
