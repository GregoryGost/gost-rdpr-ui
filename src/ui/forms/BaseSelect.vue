<script setup lang="ts">
import { computed } from 'vue'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/20/solid'

/**
 * Base select component using Headless UI Listbox
 * @component BaseSelect
 */
interface SelectOption {
  value: string | number
  label: string
}

interface Props {
  modelValue: string | number | null
  options: SelectOption[]
  placeholder?: string
  error?: string
  isDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Выберите опцию',
  isDisabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
}>()

const selectedOption = computed(() => props.options.find((opt) => opt.value === props.modelValue) || null)
</script>

<template>
  <div class="w-full">
    <Listbox :model-value="modelValue" :disabled="isDisabled" @update:model-value="emit('update:modelValue', $event)">
      <div class="relative">
        <ListboxButton
          class="relative w-full cursor-pointer rounded-lg border border-gray-300 bg-white py-2 pr-10 pl-3 text-left focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
        >
          <span class="block truncate text-gray-900 dark:text-gray-100">
            {{ selectedOption?.label || placeholder }}
          </span>
          <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
          </span>
        </ListboxButton>

        <transition
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="ring-opacity-5 absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-black focus:outline-none dark:bg-gray-800"
          >
            <ListboxOption
              v-for="option in options"
              :key="option.value"
              v-slot="{ active, selected }"
              :value="option.value"
              as="template"
            >
              <li
                :class="[
                  active ? 'bg-blue-100 dark:bg-blue-900/20' : '',
                  'relative cursor-pointer py-2 pr-4 pl-10 text-gray-900 select-none dark:text-gray-100',
                ]"
              >
                <span :class="[selected ? 'font-semibold' : 'font-normal', 'block truncate']">
                  {{ option.label }}
                </span>
                <span
                  v-if="selected"
                  class="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400"
                >
                  <CheckIcon class="h-5 w-5" aria-hidden="true" />
                </span>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </div>
    </Listbox>
    <p v-if="error" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>

<style scoped></style>
