<script setup lang="ts">
/**
 * Quick actions card component
 * @component QuickActionsCard
 */
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Быстрые действия</h3>
    <div class="space-y-2">
      <router-link
        to="/dns"
        class="block px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
      >
        Управление DNS серверами
      </router-link>
      <router-link
        to="/domains"
        class="block px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
      >
        Управление доменами
      </router-link>
      <router-link
        to="/commands"
        class="block px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
      >
        Выполнить команды
      </router-link>
    </div>
  </div>
</template>

<style scoped>
/* No styles - using Tailwind classes directly */
</style>
