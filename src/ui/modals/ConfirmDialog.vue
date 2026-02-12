<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild } from '@headlessui/vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import BaseButton from '../buttons/BaseButton.vue'

/**
 * Confirm dialog component
 * @component ConfirmDialog
 */
interface Props {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Подтвердить',
  cancelText: 'Отмена',
  variant: 'danger',
  isLoading: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <TransitionRoot :show="isOpen" as="template">
    <Dialog @close="emit('cancel')" class="relative z-50">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              class="w-full max-w-md transform rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all"
            >
              <div class="flex items-start gap-4">
                <div
                  :class="[
                    variant === 'danger' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-blue-100 dark:bg-blue-900/20',
                    'flex-shrink-0 rounded-full p-3',
                  ]"
                >
                  <ExclamationTriangleIcon
                    :class="[
                      variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400',
                      'h-6 w-6',
                    ]"
                  />
                </div>
                <div class="flex-1">
                  <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {{ title }}
                  </DialogTitle>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ message }}
                  </p>
                </div>
              </div>

              <div class="mt-6 flex gap-3 justify-end">
                <BaseButton variant="ghost" @click="emit('cancel')" :is-disabled="isLoading">
                  {{ cancelText }}
                </BaseButton>
                <BaseButton :variant="variant" @click="emit('confirm')" :is-loading="isLoading">
                  {{ confirmText }}
                </BaseButton>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<style scoped>
/* No styles - using Tailwind classes directly */
</style>
