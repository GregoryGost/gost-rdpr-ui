import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { APP_TITLE } from './constants'

import './css/main.scss'

// Error handler
import { errorHandler } from './utils/errorHandler'
import { useNotificationsStore } from './stores/notifications'

// Init Pinia
const pinia = createPinia()

// Create Vue app
const app = createApp(App)
app.use(router)
app.use(pinia)

// Setup error handlers
errorHandler.setupVueErrorHandler(app)
errorHandler.setupGlobalErrorHandlers()
errorHandler.setupRouterErrorHandler(router)

// Connect error handler to notifications store
const notificationsStore = useNotificationsStore(pinia)
errorHandler.onError((errorInfo) => {
  notificationsStore.addErrorNotification(errorInfo)
})

// Mount app
app.mount('#app')

// Dark mode
import { useDarkModeStore } from './stores/darkMode'
const darkModeStore = useDarkModeStore(pinia)
darkModeStore.init()

// Settings
import { useSettingsStore } from './stores/settings'
const settingsStore = useSettingsStore(pinia)
settingsStore.init()

// Default title tag
router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} — ${APP_TITLE}` : APP_TITLE
})
