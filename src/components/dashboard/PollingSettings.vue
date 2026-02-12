<script setup lang="ts">
import BaseSelect from '@/ui/forms/BaseSelect.vue'
import { useSettingsStore } from '@/stores/settings'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'

/**
 * Polling settings component
 * @component PollingSettings
 */
interface Props {
  isActive: boolean
  isManualRefreshing?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  manualRefresh: []
}>()

const settingsStore = useSettingsStore()
</script>

<template>
  <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex items-center gap-3">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Частота обновления статуса:
        </label>
        <div class="w-48">
          <BaseSelect
            :model-value="settingsStore.pollingInterval"
            :options="settingsStore.pollingIntervalOptions"
            placeholder="Выберите интервал"
            @update:model-value="settingsStore.setPollingInterval($event as number)"
          />
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-if="settingsStore.pollingInterval === 0"
          @click="emit('manualRefresh')"
          :disabled="isManualRefreshing"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg transition-colors"
        >
          <ArrowPathIcon :class="['h-4 w-4', isManualRefreshing ? 'animate-spin' : '']" />
          {{ isManualRefreshing ? 'Обновление...' : 'Обновить вручную' }}
        </button>
        <span
          v-else
          class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full"
          :class="[
            isActive
              ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
          ]"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="[isActive ? 'bg-green-600 dark:bg-green-400 animate-pulse' : 'bg-gray-400']"
          />
          {{ isActive ? 'Автообновление' : 'Остановлено' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
