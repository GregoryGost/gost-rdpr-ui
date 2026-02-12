<script setup lang="ts">
import { computed } from 'vue'

/**
 * Base textarea component
 * @component BaseTextarea
 */
interface Props {
  modelValue: string
  placeholder?: string
  rows?: number
  error?: string
  isDisabled?: boolean
  isRequired?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rows: 3,
  isDisabled: false,
  isRequired: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaClasses = computed(() => {
  const BASE_CLASSES = 'w-full px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-vertical'
  const ERROR_CLASSES = props.error 
    ? 'border-red-500 focus:ring-red-500' 
    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
  
  return `${BASE_CLASSES} ${ERROR_CLASSES}`
})
</script>

<template>
  <div class="w-full">
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="isDisabled"
      :required="isRequired"
      :class="textareaClasses"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <p v-if="error" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>

<style scoped>
/* No styles - using Tailwind classes directly */
</style>
