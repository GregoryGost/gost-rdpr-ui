<script setup lang="ts">
import { computed, useId } from 'vue'

// Forward id-independent native attributes, such as min and autocomplete, to the field itself.
defineOptions({ inheritAttrs: false })

/**
 * Base textarea component
 * @component BaseTextarea
 */
/** Options for a controlled field and its associated feedback. */
interface Props {
  /** Current value owned by the parent. */
  modelValue: string
  /** Initial visible line count for the textarea. */
  rows?: number
  /** Visible name attached to the native control. */
  label?: string
  /** Optional caller-provided ID for an external label or other relationship. */
  id?: string
  /** Example or hint displayed when the value is empty. */
  placeholder?: string
  /** Validation message associated with the field while present. */
  error?: string
  /** Prevents editing while the parent has disabled the field. */
  isDisabled?: boolean
  /** Marks the native field as required through the existing component API. */
  isRequired?: boolean
  /** Accepts the native spelling used by existing form callers. */
  required?: boolean
}

/** props controls native field behavior and the error styling. */
const props = withDefaults(defineProps<Props>(), {
  rows: 3,
  isDisabled: false,
  isRequired: false,
  required: false,
})

/** The generated fieldId and errorId keep repeatable forms and their error messages distinct. */
const fieldId = useId()
/** errorId identifies the message appended to the field description during validation. */
const errorId = fieldId + '-error'

/** emit passes native edits back to the parent without owning the value. */
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/** textareaClasses adds an error border while preserving the same control geometry. */
const textareaClasses = computed(() => {
  /** BASE_CLASSES defines the field layout and focus styling shared by both validation states. */
  const BASE_CLASSES =
    'w-full px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-vertical'
  /** ERROR_CLASSES selects the border and focus colors for the current validation state. */
  const ERROR_CLASSES = props.error
    ? 'border-red-500 focus:ring-red-500'
    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'

  return `${BASE_CLASSES} ${ERROR_CLASSES}`
})
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id ?? fieldId" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label
      }}<span v-if="isRequired || required" aria-hidden="true" class="ml-1 text-red-700 dark:text-red-300">*</span>
    </label>
    <textarea
      v-bind="
        error
          ? {
              ...$attrs,
              'aria-invalid': true,
              'aria-describedby': [$attrs['aria-describedby'], errorId].filter(Boolean).join(' '),
            }
          : $attrs
      "
      :id="id ?? fieldId"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="isDisabled"
      :required="isRequired || required"
      :class="textareaClasses"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <p v-if="error" :id="errorId" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>

<style scoped></style>
