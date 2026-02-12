import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import './css/main.scss'

// Init Pinia
const pinia = createPinia()

// Create Vue app
createApp(App).use(router).use(pinia).mount('#app')

// Dark mode
import { useDarkModeStore } from './stores/darkMode'
const darkModeStore = useDarkModeStore(pinia)
darkModeStore.init()

// Default title tag
const defaultDocumentTitle = 'GOST-RDPR Ui'

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} — ${defaultDocumentTitle}` : defaultDocumentTitle
})
