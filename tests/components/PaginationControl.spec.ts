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

/** Last-page navigation must distinguish a real gap from adjacency and an already visible end. */
describe('optional last-page navigation', () => {
  /** Compact mobile controls expose current/last pages and the same size-change events as desktop. */
  it('navigates the compact mobile panel and handles its final and empty boundaries', async () => {
    // wrapper exposes both responsive branches; mobile selects the first navigation landmark's branch.
    const wrapper = mount(PaginationControl, {
      props: {
        currentPage: 1,
        totalPages: 100,
        totalItems: 995,
        pageSize: 10,
        compactMobile: true,
        showLastPage: true,
      },
    })
    const mobile = wrapper.get('nav')
    expect(mobile.get('[aria-label="Текущая страница: 1"]').text()).toBe('1')
    expect(mobile.findAll('button')[0]!.element.disabled).toBe(true)
    await mobile.get('button[aria-label="Последняя страница: 100"]').trigger('click')
    expect(wrapper.emitted('update:currentPage')).toEqual([[100]])
    await wrapper.get('select').setValue('50')
    expect(wrapper.emitted('update:pageSize')).toEqual([[50]])
    await wrapper.setProps({ currentPage: 100 })
    expect(mobile.find('button[aria-label="Последняя страница: 100"]').exists()).toBe(false)
    expect(mobile.findAll('button').at(-1)!.element.disabled).toBe(true)
    await wrapper.setProps({ currentPage: 1, totalPages: 0, totalItems: 0 })
    expect(mobile.get('[aria-label="Текущая страница: 0"]').text()).toBe('0')
    expect(
      mobile
        .findAll('button')
        .every(/** No direction can leave an empty result. */ (button) => button.element.disabled),
    ).toBe(true)
  })

  /** Each case is a public page sequence required by the five-page window and final-page shortcut. */
  it.each([
    { current: 1, total: 100, labels: ['1', '2', '3', '4', '5', '100'], gaps: 1 },
    { current: 5, total: 10, labels: ['3', '4', '5', '6', '7', '10'], gaps: 1 },
    { current: 1, total: 6, labels: ['1', '2', '3', '4', '5', '6'], gaps: 0 },
    { current: 1, total: 7, labels: ['1', '2', '3', '4', '5', '7'], gaps: 1 },
    { current: 4, total: 6, labels: ['2', '3', '4', '5', '6'], gaps: 0 },
    { current: 10, total: 10, labels: ['6', '7', '8', '9', '10'], gaps: 0 },
    { current: 1, total: 1, labels: ['1'], gaps: 0 },
    { current: 1, total: 0, labels: [], gaps: 0 },
  ])('renders distinct page buttons for $current of $total', ({ current, total, labels, gaps }) => {
    // wrapper renders the optional shortcut; current/total define its window, labels/gaps are the independent expected sequence.
    const wrapper = mount(PaginationControl, {
      props: { currentPage: current, totalPages: total, totalItems: total * 10, pageSize: 10, showLastPage: true },
    })
    expect(
      wrapper
        .findAll('nav button')
        .map(/** Reads numeric page labels without depending on arrow markup. */ (button) => button.text())
        .filter(/** Excludes nonnumeric arrow labels. */ (label) => /^\d+$/.test(label)),
    ).toEqual(labels)
    expect(
      wrapper
        .findAll('nav span')
        .filter(/** Counts the visible noninteractive gap marker. */ (span) => span.text() === '...'),
    ).toHaveLength(gaps)
    expect(
      wrapper
        .findAll('nav button')
        .some(/** A gap must never be an interactive page target. */ (button) => button.text() === '...'),
    ).toBe(false)
  })

  /** A final-page shortcut emits exactly the last page while the parent retains page ownership. */
  it('emits one direct last-page request', async () => {
    // wrapper keeps page ownership in the parent while exposing a distant final-page action.
    const wrapper = mount(PaginationControl, {
      props: { currentPage: 1, totalPages: 100, totalItems: 995, pageSize: 10, showLastPage: true },
    })
    await wrapper
      .findAll('nav button')
      .find(/** Selects the final numbered target. */ (button) => button.text() === '100')!
      .trigger('click')
    expect(wrapper.emitted('update:currentPage')).toEqual([[100]])
    await wrapper.setProps({ currentPage: 100 })
    expect(wrapper.get('p').text()).toBe('Показано 991 - 995 из 995 результатов')
  })

  /** Loading retains the existing range while disabling every route to another page or page size. */
  it('blocks page and size interactions while loading', async () => {
    // wrapper starts in a middle page so both directional actions would otherwise be enabled.
    const wrapper = mount(PaginationControl, {
      props: {
        currentPage: 4,
        totalPages: 100,
        totalItems: 995,
        pageSize: 10,
        showLastPage: true,
        compactMobile: true,
        isLoading: true,
      },
    })
    expect(
      wrapper
        .findAll('button')
        .every(
          /** Native disabled controls block mouse and keyboard activation. */ (button) => button.element.disabled,
        ),
    ).toBe(true)
    expect(wrapper.get('select').element.disabled).toBe(true)
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('update:currentPage')).toBeUndefined()
    expect(wrapper.emitted('update:pageSize')).toBeUndefined()
  })

  /** Reusing the component must keep each label associated with its own selector. */
  it('assigns unique select IDs to independently labelled panels', () => {
    // host renders both panels under the same Vue app, matching the real repeated-control lifecycle.
    const host = mount({
      components: { PaginationControl },
      template:
        '<div><PaginationControl :current-page="1" :total-pages="2" :total-items="20" :page-size="10" compact-mobile aria-label="Пагинация доменов сверху" /><PaginationControl :current-page="1" :total-pages="2" :total-items="20" :page-size="10" compact-mobile aria-label="Пагинация доменов снизу" /></div>',
    })
    // first and second are sibling instances whose IDs share one application namespace.
    const [first, second] = host.findAllComponents(PaginationControl)
    if (!first || !second) throw new Error('Expected two sibling panels')
    expect(first.get('select').attributes('id')).toBeTruthy()
    expect(first.get('select').attributes('id')).not.toBe(second.get('select').attributes('id'))
    expect(first.get('label').attributes('for')).toBe(first.get('select').attributes('id'))
    expect(second.get('label').attributes('for')).toBe(second.get('select').attributes('id'))
    expect(first.find('[aria-label="Пагинация доменов сверху"]').exists()).toBe(true)
    expect(second.find('[aria-label="Пагинация доменов снизу"]').exists()).toBe(true)
    // ids covers all four selectors, including markup hidden by responsive CSS in a real browser.
    const ids = host
      .findAll('select')
      .map(/** Reads each selector's label target. */ (select) => select.attributes('id'))
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    expect(
      ids.every(
        /** Every selector has exactly one matching label in the shared app. */ (id) =>
          host.findAll(`label[for="${id}"]`).length === 1,
      ),
    ).toBe(true)
  })
})
