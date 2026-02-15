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
  <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300"> Частота обновления статуса: </label>
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
          class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
        >
          <ArrowPathIcon :class="['h-4 w-4', isManualRefreshing ? 'animate-spin' : '']" />
          {{ isManualRefreshing ? 'Обновление...' : 'Обновить вручную' }}
        </button>
        <span
          v-else
          class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
          :class="[
            isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
          ]"
        >
          <span
            class="h-2 w-2 rounded-full"
            :class="[isActive ? 'animate-pulse bg-green-600 dark:bg-green-400' : 'bg-gray-400']"
          />
          {{ isActive ? 'Автообновление' : 'Остановлено' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
