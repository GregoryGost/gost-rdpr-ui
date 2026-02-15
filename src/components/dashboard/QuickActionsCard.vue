<script setup lang="ts">
import {
  ServerIcon,
  DocumentTextIcon,
  AtSymbolIcon,
  ListBulletIcon,
  MapPinIcon,
  Cog6ToothIcon,
  CommandLineIcon,
} from '@heroicons/vue/24/outline'

/**
 * Quick actions card component
 * @component QuickActionsCard
 */
interface QuickAction {
  label: string
  path: string
  icon: typeof ServerIcon
  color: string
}

const actions: QuickAction[] = [
  {
    label: 'DNS Серверы',
    path: '/dns',
    icon: ServerIcon,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Списки Доменов',
    path: '/domains/lists',
    icon: DocumentTextIcon,
    color: 'text-green-600 dark:text-green-400',
  },
  {
    label: 'Домены',
    path: '/domains',
    icon: AtSymbolIcon,
    color: 'text-purple-600 dark:text-purple-400',
  },
  {
    label: 'Списки IP Адресов',
    path: '/ips/lists',
    icon: ListBulletIcon,
    color: 'text-orange-600 dark:text-orange-400',
  },
  {
    label: 'IP Адреса',
    path: '/ips',
    icon: MapPinIcon,
    color: 'text-pink-600 dark:text-pink-400',
  },
  {
    label: 'Конфигурации RoS',
    path: '/ros',
    icon: Cog6ToothIcon,
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    label: 'Команды',
    path: '/commands',
    icon: CommandLineIcon,
    color: 'text-red-600 dark:text-red-400',
  },
]
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
    <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Быстрые действия</h3>
    <div class="space-y-1">
      <router-link
        v-for="action in actions"
        :key="action.path"
        :to="action.path"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <component :is="action.icon" :class="['h-5 w-5 flex-shrink-0', action.color]" />
        <span class="text-gray-700 dark:text-gray-300">{{ action.label }}</span>
      </router-link>
    </div>
  </div>
</template>

<style scoped></style>
