import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from './routes'

/** Production router retains hash URLs and the existing saved-position scroll behavior. */
const router = createRouter({
  history: createWebHashHistory(),
  routes,
  /**
   * Restores savedPosition after history navigation, otherwise scrolls to the page top.
   * to and from describe the destination and source routes; neither changes this scroll policy.
   */
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

export default router
