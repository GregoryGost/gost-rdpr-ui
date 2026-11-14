import type { RouteRecordRaw } from 'vue-router'

/** Shared production route records; tests supply their own router history without importing the hash singleton. */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    /** Loads layouts/MainLayout.vue only when this route is visited. */
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        /** Loads pages/HomePage.vue only when this route is visited. */
        component: () => import('@/pages/HomePage.vue'),
        meta: { title: 'Главная' },
      },
      {
        path: 'dns',
        name: 'dns',
        /** Loads pages/dns/DnsServersPage.vue only when this route is visited. */
        component: () => import('@/pages/dns/DnsServersPage.vue'),
        meta: { title: 'DNS Серверы' },
      },
      {
        path: 'domains',
        name: 'domains',
        /** Loads pages/domains/DomainsPage.vue only when this route is visited. */
        component: () => import('@/pages/domains/DomainsPage.vue'),
        meta: { title: 'Домены' },
      },
      {
        path: 'domains/lists',
        name: 'domains-lists',
        /** Loads pages/domains/DomainsListsPage.vue only when this route is visited. */
        component: () => import('@/pages/domains/DomainsListsPage.vue'),
        meta: { title: 'Списки Доменов' },
      },
      {
        path: 'ips/lists',
        name: 'ips-lists',
        /** Loads pages/ips/IpsListsPage.vue only when this route is visited. */
        component: () => import('@/pages/ips/IpsListsPage.vue'),
        meta: { title: 'Списки IP Адресов' },
      },
      {
        path: 'ips',
        name: 'ips',
        /** Loads pages/ips/IpsPage.vue only when this route is visited. */
        component: () => import('@/pages/ips/IpsPage.vue'),
        meta: { title: 'IP Адреса' },
      },
      {
        path: 'ros',
        name: 'ros',
        /** Loads pages/ros/RosConfigsPage.vue only when this route is visited. */
        component: () => import('@/pages/ros/RosConfigsPage.vue'),
        meta: { title: 'Конфигурации' },
      },
      {
        path: 'commands',
        name: 'commands',
        /** Loads pages/commands/CommandsPage.vue only when this route is visited. */
        component: () => import('@/pages/commands/CommandsPage.vue'),
        meta: { title: 'Команды' },
      },
      {
        path: 'stats',
        name: 'stats',
        /** Loads pages/stats/StatisticsPage.vue only when this route is visited. */
        component: () => import('@/pages/stats/StatisticsPage.vue'),
        meta: { title: 'Статистика' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        /** Loads pages/NotFoundPage.vue only when this route is visited. */
        component: () => import('@/pages/NotFoundPage.vue'),
        meta: { title: '404 - Страница не найдена' },
      },
    ],
  },
]
