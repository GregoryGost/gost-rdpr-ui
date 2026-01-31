import { type RouteRecordRaw } from 'vue-router'

import HomePage from '../pages/HomePage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import DashboardView from '../views/DashboardView.vue'

export default [
  {
    path: '/',
    name: 'home',
    component: HomePage,
    children: [
      // 1. Main views
      {
        path: '',
        name: 'dashboard',
        meta: { title: 'Dashboard' },
        component: DashboardView,
      },
    ],
  },
  {
    path: '/404',
    name: 'not_found',
    component: NotFoundPage,
    meta: { title: '404 Not Found' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404',
  },
] satisfies RouteRecordRaw[]
