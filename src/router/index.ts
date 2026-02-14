import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/pages/HomePage.vue'),
        meta: { title: 'Главная' },
      },
      {
        path: 'dns',
        name: 'dns',
        component: () => import('@/pages/dns/DnsServersPage.vue'),
        meta: { title: 'DNS Серверы' },
      },
      {
        path: 'domains',
        name: 'domains',
        component: () => import('@/pages/domains/DomainsPage.vue'),
        meta: { title: 'Домены' },
      },
      {
        path: 'domains/lists',
        name: 'domains-lists',
        component: () => import('@/pages/domains/DomainsListsPage.vue'),
        meta: { title: 'Списки Доменов' },
      },
      {
        path: 'ips/lists',
        name: 'ips-lists',
        component: () => import('@/pages/ips/IpsListsPage.vue'),
        meta: { title: 'Списки IP Адресов' },
      },
      {
        path: 'ips',
        name: 'ips',
        component: () => import('@/pages/ips/IpsPage.vue'),
        meta: { title: 'IP Адреса' },
      },
      {
        path: 'ros',
        name: 'ros',
        component: () => import('@/pages/HomePage.vue'), // Временно HomePage
        meta: { title: 'Конфигурации' },
      },
      {
        path: 'commands',
        name: 'commands',
        component: () => import('@/pages/commands/CommandsPage.vue'),
        meta: { title: 'Команды' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

export default router
