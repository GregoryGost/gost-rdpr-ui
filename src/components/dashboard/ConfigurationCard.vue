<script setup lang="ts">
import { computed } from 'vue'
import type { ConfigResponse } from '@/api/types/config'

/**
 * Configuration card component - displays full application configuration
 * @component ConfigurationCard
 */
interface Props {
  config: ConfigResponse | null
}

const props = defineProps<Props>()

// Group configuration into logical sections
const appConfig = computed(() => {
  if (!props.config) return null
  return {
    Название: props.config.static.app_title,
    Версия: props.config.static.app_version,
    Описание: props.config.static.app_summary,
    Хост: props.config.static.app_host,
    Порт: props.config.static.app_port,
    'Debug режим': props.config.static.app_debug ? 'Включен' : 'Выключен',
    'Уровень логирования': props.config.static.app_log_level,
  }
})

const databaseConfig = computed(() => {
  if (!props.config) return null
  return {
    'Путь к БД': props.config.dynamic.db_path,
    Соединение: props.config.dynamic.db_connection,
    Директория: props.config.static.db_base_dir,
    'Имя файла': props.config.static.db_file_name,
    'Префикс таблиц': props.config.static.db_table_prefix,
    Timeout: `${props.config.static.db_timeout}s`,
    'Размер батча': props.config.static.db_save_batch_size,
    'Timeout батча': `${props.config.static.db_save_batch_timeout}s`,
    'Уровень логирования': props.config.static.db_log_level,
  }
})

const queueConfig = computed(() => {
  if (!props.config) return null
  return {
    'Макс. размер': props.config.static.queue_max_size,
    'Timeout получения': `${props.config.static.queue_get_timeout}s`,
    'Timeout ожидания': `${props.config.static.queue_sleep_timeout}s`,
  }
})

const requestConfig = computed(() => {
  if (!props.config) return null
  return {
    'Повторы соединений': props.config.static.req_connection_retries,
    'Timeout по умолчанию': `${props.config.static.req_timeout_default}s`,
    'Timeout подключения': `${props.config.static.req_timeout_connect}s`,
    'Timeout чтения': `${props.config.static.req_timeout_read}s`,
    'Макс. соединений': props.config.static.req_max_connections,
    'Макс. keepalive': props.config.static.req_max_keepalive_connections,
    'Проверка SSL': props.config.static.req_ssl_verify ? 'Да' : 'Нет',
    'Лимит по умолчанию': props.config.static.req_default_limit,
  }
})

const domainsConfig = computed(() => {
  if (!props.config) return null
  return {
    'Мин. длина фильтра': props.config.static.domains_filtered_min_len,
    'Интервал обновления': `${props.config.static.domains_update_interval}s`,
    'Лимит семафора': props.config.static.domain_resolve_semaphore_limit,
    'Чёрный список': props.config.static.domains_black_list || '—',
  }
})

const listsConfig = computed(() => {
  if (!props.config) return null
  return {
    'Интервал обновления': `${props.config.static.lists_update_interval_sec}s`,
    'Лимит попыток': props.config.static.attempts_limit,
  }
})

const ipConfig = computed(() => {
  if (!props.config) return null
  return {
    'IP не разрешены': props.config.static.ip_not_allowed || '—',
    'Список запрещённых IP': props.config.dynamic.ip_not_allowed_list.join(', ') || '—',
  }
})

const rosConfig = computed(() => {
  if (!props.config) return null
  return {
    'REST API timeout чтения': `${props.config.static.ros_rest_api_read_timeout}s`,
  }
})

const systemConfig = computed(() => {
  if (!props.config) return null
  return {
    'Корневой путь': props.config.static.root_path,
    'Уровень логирования': props.config.static.root_log_level,
    'Название для метрик': props.config.dynamic.app_title_metrics,
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Application Configuration -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">🚀 Приложение</h3>
      <div v-if="appConfig" class="space-y-2">
        <div
          v-for="(value, key) in appConfig"
          :key="key"
          class="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-700 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ key }}:</span>
          <span class="break-words font-mono text-sm font-medium text-gray-900 md:text-right dark:text-gray-100">{{
            value
          }}</span>
        </div>
      </div>
      <div v-else class="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
    </div>

    <!-- Database Configuration -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">💾 База данных</h3>
      <div v-if="databaseConfig" class="space-y-2">
        <div
          v-for="(value, key) in databaseConfig"
          :key="key"
          class="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-700 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ key }}:</span>
          <span class="break-all font-mono text-sm font-medium text-gray-900 md:text-right dark:text-gray-100">{{
            value
          }}</span>
        </div>
      </div>
      <div v-else class="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
    </div>

    <!-- Queue Configuration -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">📋 Очередь</h3>
      <div v-if="queueConfig" class="space-y-2">
        <div
          v-for="(value, key) in queueConfig"
          :key="key"
          class="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-700 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ key }}:</span>
          <span class="break-words font-mono text-sm font-medium text-gray-900 md:text-right dark:text-gray-100">{{
            value
          }}</span>
        </div>
      </div>
      <div v-else class="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
    </div>

    <!-- HTTP Requests Configuration -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">🌐 HTTP запросы</h3>
      <div v-if="requestConfig" class="space-y-2">
        <div
          v-for="(value, key) in requestConfig"
          :key="key"
          class="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-700 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ key }}:</span>
          <span class="break-words font-mono text-sm font-medium text-gray-900 md:text-right dark:text-gray-100">{{
            value
          }}</span>
        </div>
      </div>
      <div v-else class="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
    </div>

    <!-- Domains Configuration -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">🌍 Домены</h3>
      <div v-if="domainsConfig" class="space-y-2">
        <div
          v-for="(value, key) in domainsConfig"
          :key="key"
          class="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-700 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ key }}:</span>
          <span class="break-words font-mono text-sm font-medium text-gray-900 md:text-right dark:text-gray-100">{{
            value
          }}</span>
        </div>
      </div>
      <div v-else class="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
    </div>

    <!-- Lists Configuration -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">📜 Списки</h3>
      <div v-if="listsConfig" class="space-y-2">
        <div
          v-for="(value, key) in listsConfig"
          :key="key"
          class="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-700 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ key }}:</span>
          <span class="break-words font-mono text-sm font-medium text-gray-900 md:text-right dark:text-gray-100">{{
            value
          }}</span>
        </div>
      </div>
      <div v-else class="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
    </div>

    <!-- IP Configuration -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">🔒 IP адреса</h3>
      <div v-if="ipConfig" class="space-y-2">
        <div
          v-for="(value, key) in ipConfig"
          :key="key"
          class="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-700 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ key }}:</span>
          <span class="break-words font-mono text-sm font-medium text-gray-900 md:text-right dark:text-gray-100">{{
            value
          }}</span>
        </div>
      </div>
      <div v-else class="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
    </div>

    <!-- RouterOS Configuration -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">⚙️ RouterOS</h3>
      <div v-if="rosConfig" class="space-y-2">
        <div
          v-for="(value, key) in rosConfig"
          :key="key"
          class="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-700 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ key }}:</span>
          <span class="break-words font-mono text-sm font-medium text-gray-900 md:text-right dark:text-gray-100">{{
            value
          }}</span>
        </div>
      </div>
      <div v-else class="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
    </div>

    <!-- System Configuration -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">🖥️ Система</h3>
      <div v-if="systemConfig" class="space-y-2">
        <div
          v-for="(value, key) in systemConfig"
          :key="key"
          class="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-700 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ key }}:</span>
          <span class="break-all font-mono text-sm font-medium text-gray-900 md:text-right dark:text-gray-100">{{
            value
          }}</span>
        </div>
      </div>
      <div v-else class="text-center text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
    </div>
  </div>
</template>

<style scoped></style>
