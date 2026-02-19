<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  XMarkIcon,
  HomeIcon,
  ServerIcon,
  AtSymbolIcon,
  DocumentTextIcon,
  MapPinIcon,
  ListBulletIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  ChartBarIcon,
} from '@heroicons/vue/24/outline'
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
import AppLogo from '@/components/AppLogo.vue'

/**
 * Main application layout
 * @component MainLayout
 */
const route = useRoute()
const isSidebarOpen = ref(false)

const NAVIGATION_ITEMS = [
  { name: 'Главная', path: '/', icon: HomeIcon },
  { name: 'DNS Серверы', path: '/dns', icon: ServerIcon },
  { name: 'Списки Доменов', path: '/domains/lists', icon: DocumentTextIcon },
  { name: 'Домены', path: '/domains', icon: AtSymbolIcon },
  { name: 'Списки IP Адресов', path: '/ips/lists', icon: ListBulletIcon },
  { name: 'IP Адреса', path: '/ips', icon: MapPinIcon },
  { name: 'Конфигурации RoS', path: '/ros', icon: Cog6ToothIcon },
  { name: 'Команды', path: '/commands', icon: CommandLineIcon },
  { name: 'Статистика', path: '/stats', icon: ChartBarIcon },
]

const closeSidebar = () => {
  isSidebarOpen.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Mobile sidebar backdrop -->
    <div v-if="isSidebarOpen" class="fixed inset-0 z-40 lg:hidden" @click="closeSidebar">
      <div class="bg-opacity-75 fixed inset-0 bg-gray-600" />
    </div>

    <!-- Mobile sidebar -->
    <transition
      enter-active-class="transition-transform duration-300 ease-in-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-300 ease-in-out"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <div
        v-if="isSidebarOpen"
        class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-xl lg:hidden dark:bg-gray-800"
      >
        <div class="flex h-16 items-center justify-between border-b px-4 dark:border-gray-700">
          <AppLogo />
          <button @click="closeSidebar" class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
            <XMarkIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <nav class="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          <router-link
            v-for="item in NAVIGATION_ITEMS"
            :key="item.path"
            :to="item.path"
            @click="closeSidebar"
            class="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            exact-active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            :class="[
              route.path === item.path
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
            ]"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.name }}
          </router-link>
        </nav>
      </div>
    </transition>

    <!-- Desktop sidebar -->
    <div class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div class="flex flex-grow flex-col border-r bg-white dark:border-gray-700 dark:bg-gray-800">
        <div class="flex h-16 items-center border-b px-4 dark:border-gray-700">
          <AppLogo />
        </div>
        <nav class="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          <router-link
            v-for="item in NAVIGATION_ITEMS"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            exact-active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            :class="[
              route.path === item.path
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
            ]"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.name }}
          </router-link>
        </nav>
      </div>
    </div>

    <!-- Main content -->
    <div class="flex min-h-screen flex-col lg:pl-64">
      <!-- Header -->
      <AppHeader :on-menu-toggle="() => (isSidebarOpen = true)" />

      <!-- Page content -->
      <main class="flex-1 p-6">
        <router-view />
      </main>

      <!-- Footer -->
      <AppFooter />
    </div>
  </div>
</template>

<style scoped></style>
