<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  HomeIcon,
  ServerIcon,
  DocumentTextIcon,
  AtSymbolIcon,
  ListBulletIcon,
  MapPinIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'

/**
 * 404 Not Found page
 * @component NotFoundPage
 */
interface PageLink {
  label: string
  path: string
  icon: typeof HomeIcon
  description: string
}

const router = useRouter()

const availablePages: PageLink[] = [
  {
    label: 'Главная',
    path: '/',
    icon: HomeIcon,
    description: 'Панель управления и статистика системы',
  },
  {
    label: 'DNS Серверы',
    path: '/dns',
    icon: ServerIcon,
    description: 'Управление DNS серверами',
  },
  {
    label: 'Списки Доменов',
    path: '/domains/lists',
    icon: DocumentTextIcon,
    description: 'Управление списками доменов',
  },
  {
    label: 'Домены',
    path: '/domains',
    icon: AtSymbolIcon,
    description: 'Управление доменами',
  },
  {
    label: 'Списки IP Адресов',
    path: '/ips/lists',
    icon: ListBulletIcon,
    description: 'Управление списками IP адресов',
  },
  {
    label: 'IP Адреса',
    path: '/ips',
    icon: MapPinIcon,
    description: 'Управление IP адресами',
  },
  {
    label: 'Конфигурации RoS',
    path: '/ros',
    icon: Cog6ToothIcon,
    description: 'Управление конфигурациями RouterOS',
  },
  {
    label: 'Команды',
    path: '/commands',
    icon: CommandLineIcon,
    description: 'Выполнение команд для конфигураций',
  },
]

const goToHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-16rem)] items-center justify-center">
    <div class="w-full max-w-4xl px-4">
      <!-- Error Icon and Code -->
      <div class="mb-8 text-center">
        <div class="mb-4 flex justify-center">
          <ExclamationTriangleIcon class="h-24 w-24 text-yellow-500 dark:text-yellow-400" />
        </div>
        <h1 class="mb-2 text-6xl font-bold text-gray-900 dark:text-gray-100">404</h1>
        <p class="text-xl text-gray-600 dark:text-gray-400">Страница не найдена</p>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-500">
          К сожалению, запрашиваемая страница не существует или была перемещена
        </p>
      </div>

      <!-- Quick Return Home Button -->
      <div class="mb-8 flex justify-center">
        <button
          @click="goToHome"
          class="rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          <HomeIcon class="mr-2 inline-block h-5 w-5" />
          Вернуться на главную
        </button>
      </div>

      <!-- Available Pages -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Доступные страницы</h2>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">Выберите один из доступных разделов приложения:</p>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <router-link
            v-for="page in availablePages"
            :key="page.path"
            :to="page.path"
            class="group flex items-start gap-3 rounded-lg border border-gray-200 p-4 transition-all hover:border-blue-400 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
          >
            <component
              :is="page.icon"
              class="h-6 w-6 flex-shrink-0 text-gray-400 transition-colors group-hover:text-blue-600 dark:text-gray-500 dark:group-hover:text-blue-400"
            />
            <div class="flex-1">
              <div class="font-medium text-gray-900 dark:text-gray-100">{{ page.label }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ page.description }}</div>
            </div>
          </router-link>
        </div>
      </div>

      <!-- Additional Help -->
      <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Если вы считаете, что это ошибка, пожалуйста, свяжитесь с администратором</p>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
