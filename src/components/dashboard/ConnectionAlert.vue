<script setup lang="ts">
/**
 * Connection error alert component
 * @component ConnectionAlert
 */
</script>

<template>
  <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
    <div class="flex items-center gap-2">
      <svg class="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span class="text-sm font-medium text-red-800 dark:text-red-300">
        Нет связи с сервером. Данные могут быть устаревшими.
      </span>
    </div>
  </div>
</template>

<style scoped></style>
