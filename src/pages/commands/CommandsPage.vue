<script setup lang="ts">
import { ref } from 'vue'
import { commandsApi } from '@/api/endpoints/commands'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
import BaseSelect from '@/ui/forms/BaseSelect.vue'
import {
  ArrowPathIcon,
  GlobeAltIcon,
  ServerIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/vue/24/outline'
import { showSuccess, showInfo } from '@/utils/notifications'
import { errorHandler } from '@/utils/errorHandler'

/**
 * Commands execution page
 * @component CommandsPage
 */
const isLoadingLists = ref(false)
const isLoadingDomains = ref(false)
const isLoadingRouterOS = ref(false)

const isConfirmOpen = ref(false)
const confirmCommand = ref<'lists' | 'domains' | 'ros' | null>(null)
const confirmTitle = ref('')
const confirmMessage = ref('')

const forcedReload = ref(false)
const rosIpType = ref<number | null>(null)

const lastResult = ref<{ type: 'success' | 'error'; message: string } | null>(null)

const IP_TYPE_OPTIONS = [
  { value: '', label: 'Все типы IP' },
  { value: 4, label: 'Только IPv4' },
  { value: 6, label: 'Только IPv6' },
]

/**
 * Open confirmation dialog
 */
const openConfirm = (command: 'lists' | 'domains' | 'ros') => {
  confirmCommand.value = command
  lastResult.value = null

  switch (command) {
    case 'lists':
      confirmTitle.value = 'Загрузить списки'
      confirmMessage.value = forcedReload.value
        ? 'Списки доменов и IP адресов будут принудительно перезагружены. Продолжить?'
        : 'Списки доменов и IP адресов будут загружены (только если изменились). Продолжить?'
      break
    case 'domains':
      confirmTitle.value = 'Определить домены'
      confirmMessage.value = 'Все домены будут определены в IP адреса. Это может занять время. Продолжить?'
      break
    case 'ros':
      confirmTitle.value = 'Обновить RouterOS'
      confirmMessage.value = `Firewall и маршрутизация будут обновлены на всех устройствах RouterOS${rosIpType.value ? ` (только IPv${rosIpType.value})` : ''}. Продолжить?`
      break
  }

  isConfirmOpen.value = true
}

/**
 * Execute command
 */
const executeCommand = async () => {
  if (!confirmCommand.value) return

  const command = confirmCommand.value

  try {
    switch (command) {
      case 'lists':
        isLoadingLists.value = true
        showInfo('Загрузка списков...', 'Выполнение команды')
        await commandsApi.loadLists(forcedReload.value)
        lastResult.value = { type: 'success', message: 'Списки успешно загружены' }
        showSuccess(
          forcedReload.value ? 'Списки принудительно перезагружены' : 'Списки успешно загружены',
          'Команда выполнена',
        )
        break
      case 'domains':
        isLoadingDomains.value = true
        showInfo('Определение доменов... Это может занять время.', 'Выполнение команды')
        await commandsApi.resolveDomains()
        lastResult.value = { type: 'success', message: 'Домены успешно определены' }
        showSuccess('Все домены успешно определены в IP адреса', 'Команда выполнена')
        break
      case 'ros':
        isLoadingRouterOS.value = true
        const ipTypeText = rosIpType.value ? ` (IPv${rosIpType.value})` : ''
        showInfo(`Обновление RouterOS${ipTypeText}...`, 'Выполнение команды')
        await commandsApi.updateRouterOS(rosIpType.value || undefined)
        lastResult.value = { type: 'success', message: 'RouterOS успешно обновлен' }
        showSuccess(`RouterOS успешно обновлен${ipTypeText}`, 'Команда выполнена')
        break
    }
  } catch (error) {
    lastResult.value = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Произошла ошибка при выполнении команды',
    }
    errorHandler.handleError(error, {
      action: 'executeCommand',
      component: 'CommandsPage',
      command,
      forcedReload: command === 'lists' ? forcedReload.value : undefined,
      rosIpType: command === 'ros' ? rosIpType.value : undefined,
    })
  } finally {
    isLoadingLists.value = false
    isLoadingDomains.value = false
    isLoadingRouterOS.value = false
    isConfirmOpen.value = false
    confirmCommand.value = null
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Команды</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        Выполнение системных команд для обработки данных и обновления конфигураций
      </p>
    </div>

    <!-- Result Message -->
    <div
      v-if="lastResult"
      :class="[
        lastResult.type === 'success'
          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
          : 'border-red-500 bg-red-50 dark:bg-red-900/20',
        'mb-6 rounded-lg border-l-4 p-4',
      ]"
    >
      <div class="flex items-center gap-3">
        <CheckCircleIcon v-if="lastResult.type === 'success'" class="h-6 w-6 text-green-600 dark:text-green-400" />
        <ExclamationCircleIcon v-else class="h-6 w-6 text-red-600 dark:text-red-400" />
        <p
          :class="[
            lastResult.type === 'success' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300',
            'font-medium',
          ]"
        >
          {{ lastResult.message }}
        </p>
      </div>
    </div>

    <!-- Commands Grid -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Load Lists Command -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="mb-4 flex items-center gap-3">
          <div class="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/20">
            <ArrowPathIcon class="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Загрузка списков</h3>
        </div>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Загрузить списки содержащие домены и/или IP адреса. Загружает файлы, проверяет есть ли изменения через хеш.
          Если нет, то ничего не делает.
        </p>
        <div class="mb-4">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              v-model="forcedReload"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">Принудительная перезагрузка</span>
          </label>
        </div>
        <BaseButton @click="openConfirm('lists')" variant="primary" class="w-full" :is-loading="isLoadingLists">
          Отправить команду
        </BaseButton>
      </div>

      <!-- Resolve Domains Command -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="mb-4 flex items-center gap-3">
          <div class="rounded-lg bg-green-100 p-3 dark:bg-green-900/20">
            <GlobeAltIcon class="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Определение доменов</h3>
        </div>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Определяет IP адреса доменов через DNS инструменты через указанные DNS сервера. Используются все DNS сервера
          по очереди. Дополнительно для доменов определяются CNAME и они тоже попадают в базу и по ним определяются IP
          адреса.
        </p>
        <BaseButton
          @click="openConfirm('domains')"
          variant="primary"
          class="mt-10 w-full"
          :is-loading="isLoadingDomains"
        >
          Отправить команду
        </BaseButton>
      </div>

      <!-- Update RouterOS Command -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="mb-4 flex items-center gap-3">
          <div class="rounded-lg bg-purple-100 p-3 dark:bg-purple-900/20">
            <ServerIcon class="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Актуализация в RouterOS</h3>
        </div>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Обновить
          <span
            class="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 font-mono text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
            >/ip/firewall/address-list/</span
          >
          и
          <span
            class="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 font-mono text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
            >/ip/route/</span
          >
          на всех устройствах RouterOS внесенных в конфигурации
        </p>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Тип IP адресов</label>
          <BaseSelect v-model="rosIpType" :options="IP_TYPE_OPTIONS" />
        </div>
        <BaseButton @click="openConfirm('ros')" variant="primary" class="w-full" :is-loading="isLoadingRouterOS">
          Отправить команду
        </BaseButton>
      </div>
    </div>

    <!-- Info Box -->
    <div class="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <p class="text-sm text-blue-800 dark:text-blue-300">
        <strong>Примечание:</strong> Команды выполняются в фоновом режиме. Ответ всегда OK. Результат будет заметен
        через некоторое время.
      </p>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :is-open="isConfirmOpen"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="Выполнить"
      cancel-text="Отмена"
      variant="primary"
      :is-loading="isLoadingLists || isLoadingDomains || isLoadingRouterOS"
      @confirm="executeCommand"
      @cancel="isConfirmOpen = false"
    />
  </div>
</template>

<style scoped></style>
