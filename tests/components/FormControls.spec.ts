import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import BaseInput from '@/ui/forms/BaseInput.vue'

/** A shared input must expose its label, constraints and error on the actual HTML control. */
it('associates label and error with the native input and forwards form attributes', async () => {
  // wrapper mounts a blank required field with a caller-owned ID and a displayed validation error.
  const wrapper = mount(BaseInput, {
    attachTo: document.body,
    props: { modelValue: '', label: 'Домен', isRequired: true, error: 'Укажите домен' },
    attrs: { id: 'domain-input', name: 'domain', autocomplete: 'off' },
  })
  // input receives the browser form attributes. descriptionId links it to the currently visible error.
  const input = wrapper.get('input')
  const descriptionId = input.attributes('aria-describedby')
  if (!descriptionId) throw new Error('The input has no accessible error description')
  expect(input.element.labels?.item(0)?.textContent).toContain('Домен')
  expect(input.element.validity.valueMissing).toBe(true)
  expect(input.attributes('id')).toBe('domain-input')
  expect(input.attributes('name')).toBe('domain')
  expect(input.attributes('autocomplete')).toBe('off')
  expect(input.attributes('aria-invalid')).toBe('true')
  expect(document.getElementById(descriptionId)?.textContent).toBe('Укажите домен')

  await input.setValue('example.test')
  expect(wrapper.emitted('update:modelValue')).toEqual([['example.test']])
  await wrapper.setProps({ error: undefined, isRequired: false })
  expect(input.element.required).toBe(false)
  expect(input.attributes('aria-invalid')).not.toBe('true')
  expect(document.getElementById(descriptionId)).toBeNull()
})
