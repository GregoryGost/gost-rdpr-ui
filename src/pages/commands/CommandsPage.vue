<script setup lang="ts">
import { ref } from 'vue'
import { commandsApi } from '@/api/endpoints/commands'
import { ipsApi } from '@/api/endpoints/ips'
import type { OkResponse } from '@/api/types/common'
import { COMMANDS_TEXTS } from '@/constants'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
import BaseSelect from '@/ui/forms/BaseSelect.vue'
import {
  ArrowPathIcon,
  ClockIcon,
  GlobeAltIcon,
  ServerIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import { showSuccess, showInfo } from '@/utils/notifications'
import { errorHandler } from '@/utils/errorHandler'

type CommandType = 'lists' | 'domains-new' | 'domains-stale' | 'ros' | 'ips-cleanup-not-allowed'
type DomainResolveCommand = 'domains-new' | 'domains-stale'

/**
 * Commands execution page
 * @component CommandsPage
 */
const isLoadingLists = ref(false)
const isLoadingNewDomains = ref(false)
const isLoadingStaleDomains = ref(false)
const isLoadingRouterOS = ref(false)
const isLoadingNotAllowedIpsCleanup = ref(false)

const isConfirmOpen = ref(false)
const confirmCommand = ref<CommandType | null>(null)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmVariant = ref<'danger' | 'primary'>('primary')

const forcedReload = ref(false)
const rosIpType = ref<number | null>(4)

/** Holds the latest request outcome until the next confirmation opens. */
const lastResult = ref<{
  /** Controls how the outcome is presented, including informational replies about background work. */
  type: 'success' | 'error' | 'info'
  /** User-facing text displayed in the inline command outcome. */
  message: string
} | null>(null)

/** Border, surface and text colors for the inline outcome in both themes. */
const COMMAND_RESULT_CLASSES = {
  /** Success colors used by list loading and IP cleanup. */
  success: 'border-green-500 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  /** Failure colors used when a request rejects. */
  error: 'border-red-500 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300',
  /** Informational colors used for responses about background command admission. */
  info: 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
}

/** Exact HTTP 200 result returned when the server already has an active or queued RouterOS update. */
const ROUTER_OS_ALREADY_ACTIVE_RESULT = 'Job [ros_update] is now active'

const IP_TYPE_OPTIONS = [
  { value: '', label: 'Все типы IP', disabled: true },
  { value: 4, label: 'Только IPv4', disabled: false },
  { value: 6, label: 'Только IPv6', disabled: true },
]

/** Confirmation text, request feedback and known duplicate replies for both domain resolution modes. */
const DOMAIN_RESOLVE_COMMAND_CONFIG = {
  /** NEW resolves only new domains and has no distinct duplicate reply in the API. */
  'domains-new': {
    /** Resolution mode included in error reports. */
    mode: 'new',
    /** Heading of the NEW confirmation dialog. */
    confirmTitle: COMMANDS_TEXTS.DOMAIN_RESOLVE_NEW_CONFIRM_TITLE,
    /** Scope of the work described before the request is sent. */
    confirmMessage: COMMANDS_TEXTS.DOMAIN_RESOLVE_NEW_CONFIRM_MESSAGE,
    /** Text shown after the server accepts the request. */
    acceptedMessage: COMMANDS_TEXTS.DOMAIN_RESOLVE_NEW_ACCEPTED,
    /** NEW returns no separate result for a repeated request. */
    alreadyActiveResult: undefined,
  },
  /** STALE resolves outdated domains and can wait for a RouterOS update to finish. */
  'domains-stale': {
    /** Resolution mode included in error reports. */
    mode: 'stale',
    /** Heading of the STALE confirmation dialog. */
    confirmTitle: COMMANDS_TEXTS.DOMAIN_RESOLVE_STALE_CONFIRM_TITLE,
    /** Scope and expected duration of the work described before submission. */
    confirmMessage: COMMANDS_TEXTS.DOMAIN_RESOLVE_STALE_CONFIRM_MESSAGE,
    /** Text shown after the server accepts the request. */
    acceptedMessage: COMMANDS_TEXTS.DOMAIN_RESOLVE_STALE_ACCEPTED,
    /** Exact HTTP 200 result for a STALE request that is already active or queued. */
    alreadyActiveResult: 'Job [domains_resolve] is now active',
  },
} as const

const isDomainResolveCommand = (command: CommandType): command is DomainResolveCommand =>
  command === 'domains-new' || command === 'domains-stale'

/**
 * Open confirmation dialog
 */
const openConfirm = (command: CommandType) => {
  confirmCommand.value = command
  lastResult.value = null
  confirmVariant.value = command === 'ips-cleanup-not-allowed' ? 'danger' : 'primary'

  switch (command) {
    case 'lists':
      confirmTitle.value = 'Загрузить списки'
      confirmMessage.value = forcedReload.value
        ? 'Списки доменов и IP адресов будут принудительно перезагружены. Продолжить?'
        : 'Списки доменов и IP адресов будут загружены (только если изменились). Продолжить?'
      break
    case 'domains-new':
    case 'domains-stale':
      confirmTitle.value = DOMAIN_RESOLVE_COMMAND_CONFIG[command].confirmTitle
      confirmMessage.value = DOMAIN_RESOLVE_COMMAND_CONFIG[command].confirmMessage
      break
    case 'ros':
      confirmTitle.value = 'Обновить RouterOS'
      confirmMessage.value = `Firewall и маршрутизация будут обновлены на всех устройствах RouterOS${rosIpType.value ? ` (только IPv${rosIpType.value})` : ''}. Продолжить?`
      break
    case 'ips-cleanup-not-allowed':
      confirmTitle.value = COMMANDS_TEXTS.IP_NOT_ALLOWED_CLEANUP_CONFIRM_TITLE
      confirmMessage.value = COMMANDS_TEXTS.IP_NOT_ALLOWED_CLEANUP_CONFIRM_MESSAGE
      break
  }

  isConfirmOpen.value = true
}

/**
 * Shows the same admission outcome on the page and in a toast. The API reply describes request admission.
 * response is the decoded HTTP 200 body, acceptedMessage describes this command's background work,
 * and alreadyActiveResult is the API's exact duplicate reply when the command has one.
 */
const reportBackgroundCommandResult = (response: OkResponse, acceptedMessage: string, alreadyActiveResult?: string) => {
  /** The result value is inspected at runtime because an HTTP 200 alone leaves admission undetermined. */
  const result = response?.result
  /** The API uses OK when it accepts the request for background processing. */
  const accepted = result === 'OK'
  /** Text shared by the inline outcome and the toast, including the fallback for an unknown reply. */
  let message: string = COMMANDS_TEXTS.BACKGROUND_COMMAND_UNKNOWN_RESULT

  if (accepted) {
    message = acceptedMessage
  } else if (alreadyActiveResult !== undefined && result === alreadyActiveResult) {
    message = COMMANDS_TEXTS.BACKGROUND_COMMAND_ALREADY_ACTIVE
  }

  lastResult.value = { type: 'info', message }
  showInfo(message, accepted ? COMMANDS_TEXTS.BACKGROUND_COMMAND_ACCEPTED_TITLE : undefined)
}

/** Sends the confirmed command, displays the API outcome and releases the dialog when the HTTP request settles. */
const executeCommand = async () => {
  if (!confirmCommand.value) return

  /** Command chosen in the dialog, captured before waiting for the API. */
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
      case 'domains-new':
      case 'domains-stale': {
        /** Text and duplicate response contract for the selected resolution mode. */
        const config = DOMAIN_RESOLVE_COMMAND_CONFIG[command]
        if (command === 'domains-new') {
          isLoadingNewDomains.value = true
        } else {
          isLoadingStaleDomains.value = true
        }

        /** Both resolution endpoints return the same result field for reporting request admission. */
        const response =
          command === 'domains-new' ? await commandsApi.resolveNewDomains() : await commandsApi.resolveStaleDomains()
        reportBackgroundCommandResult(response, config.acceptedMessage, config.alreadyActiveResult)
        break
      }
      case 'ros': {
        isLoadingRouterOS.value = true
        /** Admission reply to the update request with the selected IP type, normally IPv4. */
        const response = await commandsApi.updateRouterOS(rosIpType.value || undefined)
        reportBackgroundCommandResult(
          response,
          COMMANDS_TEXTS.ROUTER_OS_UPDATE_ACCEPTED,
          ROUTER_OS_ALREADY_ACTIVE_RESULT,
        )
        break
      }
      case 'ips-cleanup-not-allowed':
        isLoadingNotAllowedIpsCleanup.value = true
        showInfo(COMMANDS_TEXTS.IP_NOT_ALLOWED_CLEANUP_PROGRESS, 'Выполнение команды')
        await ipsApi.queueCleanupNotAllowed()
        lastResult.value = { type: 'success', message: COMMANDS_TEXTS.IP_NOT_ALLOWED_CLEANUP_SUCCESS }
        showSuccess(COMMANDS_TEXTS.IP_NOT_ALLOWED_CLEANUP_SUCCESS, 'Команда принята')
        break
    }
  } catch (error) {
    // error is the failed request or response parsing exception. The shared handler publishes the error toast.
    lastResult.value = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Произошла ошибка при выполнении команды',
    }
    errorHandler.handleError(error, {
      action: 'executeCommand',
      component: 'CommandsPage',
      command,
      domainResolveMode: isDomainResolveCommand(command) ? DOMAIN_RESOLVE_COMMAND_CONFIG[command].mode : undefined,
      forcedReload: command === 'lists' ? forcedReload.value : undefined,
      rosIpType: command === 'ros' ? rosIpType.value : undefined,
    })
  } finally {
    isLoadingLists.value = false
    isLoadingNewDomains.value = false
    isLoadingStaleDomains.value = false
    isLoadingRouterOS.value = false
    isLoadingNotAllowedIpsCleanup.value = false
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
    <div v-if="lastResult" class="mb-6 rounded-lg border-l-4 p-4" :class="COMMAND_RESULT_CLASSES[lastResult.type]">
      <div class="flex items-center gap-3">
        <CheckCircleIcon v-if="lastResult.type === 'success'" class="h-6 w-6 text-green-600 dark:text-green-400" />
        <InformationCircleIcon
          v-else-if="lastResult.type === 'info'"
          class="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400"
        />
        <ExclamationCircleIcon v-else class="h-6 w-6 text-red-600 dark:text-red-400" />
        <p class="font-medium">
          {{ lastResult.message }}
        </p>
      </div>
    </div>

    <!-- Commands Grid -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
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
        <div class="grid gap-3">
          <BaseButton
            @click="openConfirm('domains-new')"
            variant="primary"
            class="w-full"
            :is-loading="isLoadingNewDomains"
          >
            <SparklesIcon class="mr-2 h-5 w-5" />
            <span>{{ COMMANDS_TEXTS.DOMAIN_RESOLVE_NEW_BUTTON }}</span>
          </BaseButton>
          <BaseButton
            @click="openConfirm('domains-stale')"
            variant="secondary"
            class="w-full"
            :is-loading="isLoadingStaleDomains"
          >
            <ClockIcon class="mr-2 h-5 w-5" />
            <span>{{ COMMANDS_TEXTS.DOMAIN_RESOLVE_STALE_BUTTON }}</span>
          </BaseButton>
        </div>
        <div class="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
          <ExclamationCircleIcon class="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            {{ COMMANDS_TEXTS.DOMAIN_RESOLVE_STALE_WARNING }}
          </p>
        </div>
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
          <BaseSelect label="Тип IP адресов" v-model="rosIpType" :options="IP_TYPE_OPTIONS" />
        </div>
        <BaseButton
          @click="openConfirm('ros')"
          variant="primary"
          class="w-full"
          :is-loading="isLoadingRouterOS"
          aria-label="Отправить команду обновления RouterOS"
        >
          Отправить команду
        </BaseButton>
      </div>

      <!-- Cleanup prohibited IPs command -->
      <div class="rounded-lg border border-red-200 bg-white p-6 dark:border-red-900/50 dark:bg-gray-800">
        <div class="mb-4 flex items-center gap-3">
          <div class="rounded-lg bg-red-100 p-3 dark:bg-red-900/20">
            <TrashIcon class="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ COMMANDS_TEXTS.IP_NOT_ALLOWED_CLEANUP_TITLE }}
          </h3>
        </div>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {{ COMMANDS_TEXTS.IP_NOT_ALLOWED_CLEANUP_DESCRIPTION }}
        </p>
        <div class="mb-4 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
          <ExclamationCircleIcon class="mt-0.5 h-5 w-5 shrink-0" />
          <p>{{ COMMANDS_TEXTS.IP_NOT_ALLOWED_CLEANUP_HINT }}</p>
        </div>
        <BaseButton
          @click="openConfirm('ips-cleanup-not-allowed')"
          variant="danger"
          class="w-full"
          :is-loading="isLoadingNotAllowedIpsCleanup"
        >
          {{ COMMANDS_TEXTS.IP_NOT_ALLOWED_CLEANUP_BUTTON }}
        </BaseButton>
      </div>
    </div>

    <!-- Info Box -->
    <div class="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <p class="text-sm text-blue-800 dark:text-blue-300">
        <strong>Примечание:</strong> {{ COMMANDS_TEXTS.BACKGROUND_COMMANDS_NOTE }}
      </p>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :is-open="isConfirmOpen"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="Выполнить"
      cancel-text="Отмена"
      :variant="confirmVariant"
      :is-loading="
        isLoadingLists ||
        isLoadingNewDomains ||
        isLoadingStaleDomains ||
        isLoadingRouterOS ||
        isLoadingNotAllowedIpsCleanup
      "
      @confirm="executeCommand"
      @cancel="isConfirmOpen = false"
    />
  </div>
</template>

<style scoped></style>
