<template>
  <teleport to="body">
    <div class="notification-container">
      <transition-group name="notification-list" tag="div">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="['notification-item', `notification-${notification.severity}`]"
          role="alert"
        >
          <div class="notification-content">
            <div class="notification-icon">
              <component :is="getIcon(notification.severity)" class="icon-size" />
            </div>
            <div class="notification-body">
              <h4 class="notification-title">{{ notification.title }}</h4>
              <p class="notification-message">{{ notification.message }}</p>
            </div>
            <button
              v-if="notification.dismissible"
              type="button"
              class="notification-close"
              @click="handleDismiss(notification.id)"
              aria-label="Закрыть уведомление"
            >
              <XMarkIcon class="icon-close-size" />
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications'
import {
  XMarkIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ShieldExclamationIcon,
} from '@heroicons/vue/24/outline'
import { ErrorSeverity } from '@/utils/errorHandler'
import type { Component } from 'vue'

const notificationsStore = useNotificationsStore()
const { notifications } = storeToRefs(notificationsStore)

const handleDismiss = (id: string) => {
  notificationsStore.removeNotification(id)
}

const getIcon = (severity: string): Component => {
  switch (severity) {
    case ErrorSeverity.INFO:
      return InformationCircleIcon
    case ErrorSeverity.WARNING:
      return ExclamationTriangleIcon
    case ErrorSeverity.ERROR:
      return XCircleIcon
    case ErrorSeverity.CRITICAL:
      return ShieldExclamationIcon
    default:
      return InformationCircleIcon
  }
}
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  max-width: 24rem;
  width: 100%;
  pointer-events: none;
}

.notification-item {
  pointer-events: auto;
  margin-bottom: 0.75rem;
  border-radius: 0.5rem;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
  background: white;
  border-width: 1px;
  border-color: rgb(229 231 235);
  overflow: hidden;
}

.notification-item:last-child {
  margin-bottom: 0;
}

.dark .notification-item {
  background: rgb(31 41 55);
  border-color: rgb(75 85 99);
}

.notification-content {
  display: flex;
  padding: 1rem;
  gap: 0.75rem;
  align-items: flex-start;
}

.notification-icon {
  flex-shrink: 0;
}

.icon-size {
  width: 1.5rem;
  height: 1.5rem;
}

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(17 24 39);
  margin: 0 0 0.25rem 0;
}

.dark .notification-title {
  color: rgb(243 244 246);
}

.notification-message {
  font-size: 0.875rem;
  color: rgb(107 114 128);
  margin: 0;
  word-wrap: break-word;
}

.dark .notification-message {
  color: rgb(156 163 175);
}

.notification-close {
  flex-shrink: 0;
  padding: 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: rgb(156 163 175);
  border-radius: 0.375rem;
  transition: all 150ms ease-in-out;
}

.notification-close:hover {
  color: rgb(17 24 39);
  background: rgb(243 244 246);
}

.dark .notification-close:hover {
  color: rgb(243 244 246);
  background: rgb(55 65 81);
}

.notification-close:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}

.icon-close-size {
  width: 1.25rem;
  height: 1.25rem;
}

.notification-info .notification-icon {
  color: var(--color-info);
}

.notification-warning .notification-icon {
  color: var(--color-warning);
}

.notification-error .notification-icon {
  color: var(--color-danger);
}

.notification-critical .notification-icon {
  color: var(--color-danger);
}

.notification-critical {
  border-color: var(--color-danger);
  background: rgb(254 242 242);
}

.dark .notification-critical {
  background: rgb(127 29 29);
}

.notification-list-enter-active {
  animation: notification-slide-in 0.3s ease-out;
}

.notification-list-leave-active {
  animation: notification-slide-out 0.3s ease-in;
}

.notification-list-move {
  transition: transform 0.3s ease;
}

@keyframes notification-slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes notification-slide-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

@media (max-width: 640px) {
  .notification-container {
    left: 1rem;
    right: 1rem;
    max-width: none;
  }
}
</style>
