import { h, toRaw } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataTable from '@/ui/tables/DataTable.vue'
import type { TableColumn } from '@/ui/tables/columnFilters'

/** Exercises the table through rendered cells, accessible controls and emitted events. */
describe('DataTable', () => {
  /** Loading takes precedence over existing rows; empty and populated results remain distinct. */
  it('renders loading, custom empty text and data in order', async () => {
    // wrapper starts with an existing row to detect stale content during loading.
    const wrapper = mount(DataTable, {
      props: { columns: [{ key: 'name', label: 'Домен' }], data: [{ name: 'example.test' }], isLoading: true },
    })
    expect(wrapper.get('tbody').text()).toBe('Загрузка...')
    await wrapper.setProps({ data: [], isLoading: false, emptyMessage: 'Домены не найдены' })
    expect(wrapper.get('tbody').text()).toBe('Домены не найдены')
    await wrapper.setProps({ data: [{ name: 'example.test' }] })
    expect(wrapper.get('tbody').text()).toBe('example.test')
  })

  /** A failed load replaces stale rows and offers a retry distinct from a legitimate empty result. */
  it('shows a failed load and requests a retry before rendering recovered rows', async () => {
    // wrapper starts with an old row so the failure cannot be mistaken for an empty response.
    const wrapper = mount(DataTable, {
      props: { columns: [{ key: 'name', label: 'Домен' }], data: [{ name: 'old.example.test' }], hasError: true },
    })
    expect(wrapper.get('tbody').text()).toContain('Не удалось загрузить данные')
    expect(wrapper.get('tbody').text()).not.toContain('old.example.test')
    // retry is the native button in the failed table body, separate from header and row controls.
    const retry = wrapper.get('tbody button')
    expect(retry.text()).toBe('Повторить')
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])

    await wrapper.setProps({ isLoading: true })
    expect(wrapper.get('tbody').text()).toBe('Загрузка...')
    expect(wrapper.find('tbody button').exists()).toBe(false)
    await wrapper.setProps({ isLoading: false, hasError: false, data: [{ name: 'recovered.example.test' }] })
    expect(wrapper.get('tbody').text()).toBe('recovered.example.test')
    expect(wrapper.find('tbody button').exists()).toBe(false)
  })

  /** Numeric sorting must use arithmetic order, preserve input and reset on the third click. */
  it('cycles numeric sorting and emits directions without mutating input', async () => {
    // data uses lexically misleading numbers; columns enables the public sorting control.
    const data = [{ value: 10 }, { value: 2 }, { value: 30 }]
    const columns: TableColumn<Record<string, unknown>>[] = [{ key: 'value', label: 'Количество', sortable: true }]
    // wrapper renders the supplied input order before any sorting is requested.
    const wrapper = mount(DataTable, { props: { data, columns } })
    /** Reads displayed row text, excluding headers; the map callback extracts each row's visible text. */
    const values = () => wrapper.findAll('tbody tr').map((row) => row.text())
    expect(values()).toEqual(['10', '2', '30'])
    await wrapper.get('thead button').trigger('click')
    expect(values()).toEqual(['2', '10', '30'])
    expect(wrapper.get('th').attributes('aria-sort')).toBe('ascending')
    expect(wrapper.get('thead button').attributes('aria-sort')).toBeUndefined()
    await wrapper.get('thead button').trigger('click')
    expect(values()).toEqual(['30', '10', '2'])
    expect(wrapper.get('th').attributes('aria-sort')).toBe('descending')
    await wrapper.get('thead button').trigger('click')
    expect(values()).toEqual(['10', '2', '30'])
    expect(wrapper.get('th').attributes('aria-sort') ?? 'none').toBe('none')
    expect(wrapper.emitted('sort')).toEqual([
      ['value', 'asc'],
      ['value', 'desc'],
      ['value', null],
    ])
    expect(data).toEqual([{ value: 10 }, { value: 2 }, { value: 30 }])
  })

  /** IPv4 octets and compressed IPv6 groups must sort numerically, with IPv4 before IPv6. */
  it('orders IPv4 and IPv6 addresses by address value', async () => {
    // wrapper deliberately mixes families, compression and values that defeat lexical sorting.
    const wrapper = mount(DataTable, {
      props: {
        data: [
          { ip: '2001:db8::10' },
          { ip: '10.0.0.10' },
          { ip: '::1' },
          { ip: '10.0.0.2' },
          { ip: '2001:db8::2' },
          { ip: '2.255.255.255' },
        ],
        columns: [{ key: 'ip', label: 'IP Адрес', sortable: true, sortType: 'ip' }],
      },
    })
    await wrapper.get('thead button').trigger('click')
    expect(wrapper.findAll('tbody td').map(/** Extracts each displayed address cell. */ (cell) => cell.text())).toEqual(
      ['2.255.255.255', '10.0.0.2', '10.0.0.10', '::1', '2001:db8::2', '2001:db8::10'],
    )
    await wrapper.get('thead button').trigger('click')
    expect(
      wrapper
        .findAll('tbody td')
        .map(/** Extracts each displayed address cell after descending sort. */ (cell) => cell.text()),
    ).toEqual(['2001:db8::10', '2001:db8::2', '::1', '10.0.0.10', '10.0.0.2', '2.255.255.255'])
  })

  /** Local filters combine across columns and ignore case and surrounding whitespace. */
  it('applies local filters and removes blank filters', async () => {
    // wrapper has two matching names but only one matching status.
    const wrapper = mount(DataTable, {
      props: {
        data: [
          { name: 'Alpha', status: 'Готов' },
          { name: 'ALPHABET', status: 'Ожидание' },
          { name: 'Beta', status: 'Готов' },
        ],
        columns: [
          { key: 'name', label: 'Домен' },
          { key: 'status', label: 'Статус' },
          { key: 'actions', label: 'Действия' },
        ],
      },
    })
    expect(wrapper.findAll('input')).toHaveLength(2)
    await wrapper.get('input[aria-label="Фильтр: Домен"]').setValue(' ALPHA ')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    await wrapper.get('input[aria-label="Фильтр: Статус"]').setValue('готов')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('Alpha')
    await wrapper.get('input[aria-label="Фильтр: Домен"]').setValue('  ')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.emitted('update:columnFilters')).toBeUndefined()
    await wrapper.setProps({ isColumnFilteringEnabled: false })
    expect(wrapper.findAll('input')).toHaveLength(0)
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
  })

  /** Controlled filters describe server intent and must never remove already supplied backend rows locally. */
  it('emits controlled filter changes while retaining server rows and parent-owned values', async () => {
    // wrapper receives a nonmatching backend row to detect accidental second filtering.
    const wrapper = mount(DataTable, {
      props: {
        data: [{ name: 'server-result.test' }],
        columns: [{ key: 'name', label: 'Домен' }],
        columnFilters: { name: 'parent' },
      },
    })
    expect(wrapper.get('tbody').text()).toBe('server-result.test')
    await wrapper.get('input').setValue('next')
    expect(wrapper.emitted('update:columnFilters')).toEqual([[{ name: 'next' }]])
    expect(wrapper.get('tbody').text()).toBe('server-result.test')
    await wrapper.setProps({ columnFilters: { name: 'accepted' } })
    expect(wrapper.get('input').element.value).toBe('accepted')
    await wrapper.get('input').setValue(' ')
    expect(wrapper.emitted('update:columnFilters')?.at(-1)).toEqual([{}])
  })

  /** Cell slots receive the original row and value, and row clicks return that row unchanged. */
  it('provides slot values and emits the selected row', async () => {
    // row is shared with the assertion so identity changes cannot be hidden by an equivalent object.
    const row = { name: 'example.test', id: 7 }
    // wrapper replaces one cell with a slot; its callback renders value (the cell value) and row (the complete record).
    const wrapper = mount(DataTable, {
      props: { data: [row], columns: [{ key: 'name', label: 'Домен' }] },
      slots: { 'cell-name': ({ value, row }) => h('strong', `${row.id}: ${value}`) },
    })
    expect(wrapper.get('strong').text()).toBe('7: example.test')
    await wrapper.get('tbody tr').trigger('click')
    expect(toRaw(wrapper.emitted('rowClick')?.[0]?.[0])).toBe(row)
  })
})
