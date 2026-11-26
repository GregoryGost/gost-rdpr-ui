<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
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
/** isSidebarOpen controls the mobile navigation dialog. */
const isSidebarOpen = ref(false)
/** desktopSidebar is hidden by CSS on narrow screens and gains width when desktop navigation takes over. */
const desktopSidebar = ref<HTMLElement | null>(null)

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

/** Opens mobile navigation so the dialog takes keyboard focus. */
function openSidebar(): void {
  isSidebarOpen.value = true
}

/** Closes mobile navigation and lets the dialog release focus to its opener. */
const closeSidebar = () => {
  isSidebarOpen.value = false
}

/** Closes the mobile dialog when the desktop sidebar appears; dispose the observer with this layout. */
watchEffect((onCleanup) => {
  /** sidebar is the element whose rendered width reflects the responsive CSS. */
  const sidebar = desktopSidebar.value
  if (!sidebar || typeof ResizeObserver === 'undefined') return

  /** observer watches sidebar size; its callback closes the mobile dialog when desktop links become visible. */
  const observer = new ResizeObserver(() => {
    if (sidebar.offsetWidth > 0 && isSidebarOpen.value) closeSidebar()
  })
  observer.observe(sidebar)

  /** Releases the current observation before changing the element or unmounting the layout. */
  onCleanup(() => observer.disconnect())
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <TransitionRoot :show="isSidebarOpen" :unmount="false" as="template">
      <Dialog id="mobile-navigation" class="relative z-50 lg:hidden" @close="closeSidebar">
        <div class="fixed inset-0 bg-gray-900/70" aria-hidden="true" />
        <TransitionChild
          as="template"
          enter="motion-safe:transition-transform motion-safe:duration-300 ease-in-out"
          enter-from="motion-safe:-translate-x-full"
          enter-to="motion-safe:translate-x-0"
          leave="motion-safe:transition-transform motion-safe:duration-300 ease-in-out"
          leave-from="motion-safe:translate-x-0"
          leave-to="motion-safe:-translate-x-full"
        >
          <DialogPanel class="fixed inset-y-0 left-0 flex w-64 max-w-full flex-col bg-white shadow-xl dark:bg-gray-800">
            <DialogTitle class="sr-only">Навигация</DialogTitle>
            <div class="flex h-16 shrink-0 items-center justify-between border-b px-4 dark:border-gray-700">
              <AppLogo />
              <button
                type="button"
                aria-label="Закрыть меню"
                class="rounded-lg p-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:bg-gray-700"
                @click="closeSidebar"
              >
                <XMarkIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <nav aria-label="Основная навигация" class="flex-1 space-y-1 overflow-y-auto px-2 py-4">
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
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </TransitionRoot>

    <!-- Desktop sidebar -->
    <div ref="desktopSidebar" class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div class="flex grow flex-col border-r bg-white dark:border-gray-700 dark:bg-gray-800">
        <div class="flex h-16 items-center border-b px-4 dark:border-gray-700">
          <AppLogo />
        </div>
        <nav aria-label="Основная навигация" class="flex-1 space-y-1 overflow-y-auto px-2 py-4">
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
      <AppHeader :is-menu-open="isSidebarOpen" :on-menu-toggle="openSidebar" />

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
