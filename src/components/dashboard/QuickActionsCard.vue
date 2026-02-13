<script setup lang="ts">
/**
 * Quick actions card component
 * @component QuickActionsCard
 */
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
    <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Быстрые действия</h3>
    <div class="space-y-2">
      <router-link
        to="/dns"
        class="block rounded-lg px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
      >
        Управление DNS серверами
      </router-link>
      <router-link
        to="/domains"
        class="block rounded-lg px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
      >
        Управление доменами
      </router-link>
      <router-link
        to="/commands"
        class="block rounded-lg px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
      >
        Выполнить команды
      </router-link>
    </div>
  </div>
</template>

<style scoped></style>
