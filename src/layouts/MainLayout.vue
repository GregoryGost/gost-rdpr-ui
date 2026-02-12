<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  XMarkIcon,
  HomeIcon,
  ServerIcon,
  GlobeAltIcon,
  CommandLineIcon,
} from '@heroicons/vue/24/outline'
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
import { APP_NAME } from '@/constants'

/**
 * Main application layout
 * @component MainLayout
 */
const route = useRoute()
const isSidebarOpen = ref(false)

const NAVIGATION_ITEMS = [
  { name: 'Главная', path: '/', icon: HomeIcon },
  { name: 'DNS Серверы', path: '/dns', icon: ServerIcon },
  { name: 'Домены', path: '/domains', icon: GlobeAltIcon },
  { name: 'IP Адреса', path: '/ips', icon: GlobeAltIcon },
  { name: 'Конфигурации', path: '/ros', icon: ServerIcon },
  { name: 'Команды', path: '/commands', icon: CommandLineIcon },
]

const closeSidebar = () => {
  isSidebarOpen.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Mobile sidebar backdrop -->
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 z-40 lg:hidden"
      @click="closeSidebar"
    >
      <div class="fixed inset-0 bg-gray-600 bg-opacity-75" />
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
        class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white dark:bg-gray-800 shadow-xl lg:hidden"
      >
        <div class="flex h-16 items-center justify-between px-4 border-b dark:border-gray-700">
          <span class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ APP_NAME }}</span>
          <button @click="closeSidebar" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <XMarkIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <nav class="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
          <router-link
            v-for="item in NAVIGATION_ITEMS"
            :key="item.path"
            :to="item.path"
            @click="closeSidebar"
            class="flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            exact-active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            :class="[
              route.path === item.path
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
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
      <div class="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r dark:border-gray-700">
        <div class="flex h-16 items-center px-4 border-b dark:border-gray-700">
          <span class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ APP_NAME }}</span>
        </div>
        <nav class="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
          <router-link
            v-for="item in NAVIGATION_ITEMS"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            exact-active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            :class="[
              route.path === item.path
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
            ]"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.name }}
          </router-link>
        </nav>
      </div>
    </div>

    <!-- Main content -->
    <div class="lg:pl-64 flex flex-col min-h-screen">
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

<style scoped>
/* No styles - using Tailwind classes directly */
</style>
