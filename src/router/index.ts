import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import type { Router, RouteLocationNormalized } from 'vue-router'

import routes from './routes'

const defaultDocumentTitle = document.title

const router: Router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.afterEach((to: RouteLocationNormalized) => {
  nextTick(() => {
    document.title = to.meta?.title ? `${to.meta.title} - ${defaultDocumentTitle}` : defaultDocumentTitle
  })
})

export { router }
