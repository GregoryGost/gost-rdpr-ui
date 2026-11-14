import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PaginationControl from '@/ui/tables/PaginationControl.vue'

/** Verifies navigation boundaries and the displayed range through the rendered controls. */
describe('PaginationControl', () => {
  /** Empty data has no first item and cannot navigate in either direction. */
  it('shows a zero range and disables empty-result navigation', async () => {
    // wrapper uses the actual empty state emitted by page composables.
    const wrapper = mount(PaginationControl, { props: { currentPage: 1, totalPages: 0, totalItems: 0, pageSize: 10 } })
    expect(wrapper.get('p').text()).toBe('Показано 0 - 0 из 0 результатов')
    expect(
      wrapper
        .findAll('button')
        .every(/** Checks the native disabled state of every navigation button. */ (button) => button.element.disabled),
    ).toBe(true)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:currentPage')).toBeUndefined()
  })

  /** Buttons emit requested pages without changing parent-owned props; the final range is capped by the total. */
  it('emits navigation and size changes and respects first and last boundaries', async () => {
    // wrapper starts on the first of three pages with a partial last page.
    const wrapper = mount(PaginationControl, { props: { currentPage: 1, totalPages: 3, totalItems: 25, pageSize: 10 } })
    expect(wrapper.get('p').text()).toBe('Показано 1 - 10 из 25 результатов')
    expect(wrapper.findAll('button')[0]?.element.disabled).toBe(true)
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('update:currentPage')).toEqual([[2]])
    expect(wrapper.props('currentPage')).toBe(1)
    await wrapper.setProps({ currentPage: 3 })
    expect(wrapper.get('p').text()).toBe('Показано 21 - 25 из 25 результатов')
    expect(wrapper.findAll('button')[1]?.element.disabled).toBe(true)
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('update:currentPage')?.at(-1)).toEqual([2])
    await wrapper.get('select').setValue('50')
    expect(wrapper.emitted('update:pageSize')).toEqual([[50]])
    expect(wrapper.props('pageSize')).toBe(10)
  })

  /** The five-page window includes both middle neighbors and the final page near the end. */
  it('renders a bounded page window and emits a direct page request', async () => {
    // wrapper starts in the middle of ten pages to exercise both window positions.
    const wrapper = mount(PaginationControl, {
      props: { currentPage: 5, totalPages: 10, totalItems: 100, pageSize: 10 },
    })
    expect(
      wrapper
        .findAll('nav button')
        .map(/** Reads the page labels; arrow buttons have no text. */ (button) => button.text()),
    ).toEqual(['', '3', '4', '5', '6', '7', ''])
    await wrapper.findAll('nav button')[4]!.trigger('click')
    expect(wrapper.emitted('update:currentPage')).toEqual([[6]])
    await wrapper.setProps({ currentPage: 10 })
    expect(
      wrapper.findAll('nav button').map(/** Reads the final window's page labels. */ (button) => button.text()),
    ).toEqual(['', '6', '7', '8', '9', '10', ''])
  })
})
