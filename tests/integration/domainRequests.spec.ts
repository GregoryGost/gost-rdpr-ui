import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import DomainsPage from '@/pages/domains/DomainsPage.vue'
import { domainsApi, type DomainsResponse } from '@/api/endpoints/domains'
import { statsApi } from '@/api/endpoints/stats'
import type { StatsResponse } from '@/api/types/stats'
import type { OkResponse } from '@/api/types/common'
import { errorHandler } from '@/utils/errorHandler'
import * as notifications from '@/utils/notifications'
import { deferred, domain, domainPage, statistics } from '../fixtures/components/responses'

/** Notification functions are observation boundaries; store actions are tested independently with real Pinia. */
vi.mock('@/utils/notifications', () => ({ showInfo: vi.fn(), showWarning: vi.fn(), showSuccess: vi.fn() }))

/** Tests real page handlers, debounce, filtering and table rendering with only API and modal collaborators replaced. */
describe('domain request integration', () => {
  /** Rejects unexpected real transport and gives each scenario independent endpoint spies and fake time. */
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    /** Any accidental transport escape fails instead of contacting a backend. */
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected transport request')
      }),
    )
    vi.spyOn(domainsApi, 'getAll').mockResolvedValue(domainPage([domain('baseline.test')]))
    vi.spyOn(domainsApi, 'search').mockResolvedValue(domainPage([domain('latest.test')]))
    vi.spyOn(statsApi, 'getStats').mockResolvedValue(statistics())
    /** Records error publication without development logging or unrelated application subscribers. */
    vi.spyOn(errorHandler, 'handleError').mockImplementation(() => {})
  })

  /** Mounts the actual page; modal stubs retain visible forms while excluding Headless UI geometry from async tests. */
  function mountPage() {
    return mount(DomainsPage, {
      global: {
        stubs: {
          // BaseModal conditionally renders its slot so form open/close remains observable.
          BaseModal: { props: ['isOpen'], template: '<section v-if="isOpen"><slot /></section>' },
          // ConfirmDialog provides only its open/confirm/cancel collaboration contract.
          ConfirmDialog: {
            props: ['isOpen', 'isLoading'],
            emits: ['confirm', 'cancel'],
            template:
              '<section v-if="isOpen"><button :disabled="isLoading" @click="$emit(\'confirm\')">Подтвердить удаление</button></section>',
          },
          // Resolve dialogs are unrelated to table request ordering and never opened here.
          DomainResolveCheckModal: true,
          DomainResolveNowModal: true,
        },
      },
    })
  }

  /** Settling an old response before the new debounce starts cannot publish rows, counts or notifications. */
  it('invalidates earlier results as soon as the latest query is entered', async () => {
    // oldRequest remains pending across a newer input event and its 500 ms debounce gap.
    const oldRequest = deferred<DomainsResponse>()
    vi.mocked(domainsApi.search).mockReturnValueOnce(oldRequest.promise)
    // wrapper begins with accepted baseline rows before either query is entered.
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('older')
    await vi.advanceTimersByTimeAsync(500)
    expect(domainsApi.search).toHaveBeenCalledWith('older', expect.any(Object))
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('latest')
    oldRequest.resolve(domainPage([domain('obsolete.test')], 99))
    await flushPromises()
    expect(wrapper.get('tbody').text()).not.toContain('obsolete.test')
    expect(wrapper.text()).not.toContain('99 результатов')
    expect(notifications.showInfo).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(499)
    expect(domainsApi.search).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(wrapper.get('tbody').text()).toContain('latest.test')
    expect(wrapper.get('p.text-sm').text()).toContain('1 - 1 из 1')
    expect(notifications.showInfo).toHaveBeenCalledExactlyOnceWith('Найдено доменов: 1', 'Результаты поиска')
  })

  /** New success must survive a late old success or failure, including loading completion and error publication. */
  it.each(['success', 'failure'])('retains the newest result after an obsolete %s', async (outcome) => {
    // oldRequest and latestRequest allow the second request to finish first.
    const oldRequest = deferred<DomainsResponse>()
    const latestRequest = deferred<DomainsResponse>()
    vi.mocked(domainsApi.search).mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(latestRequest.promise)
    // wrapper renders both overlapping searches through the normal input handlers.
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('older')
    await vi.advanceTimersByTimeAsync(500)
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('latest')
    await vi.advanceTimersByTimeAsync(500)
    latestRequest.resolve(domainPage([domain('accepted.test')]))
    await flushPromises()
    if (outcome === 'success') oldRequest.resolve(domainPage([domain('obsolete.test')], 99))
    else oldRequest.reject(new Error('Old request failed'))
    await flushPromises()
    expect(wrapper.get('tbody').text()).toContain('accepted.test')
    expect(wrapper.get('tbody').text()).not.toContain('obsolete.test')
    expect(wrapper.get('tbody').text()).not.toContain('Загрузка...')
    expect(errorHandler.handleError).not.toHaveBeenCalled()
    expect(notifications.showInfo).toHaveBeenCalledTimes(1)
  })

  /** A query edit invalidates table intent while global counts still describe the independent full dataset. */
  it('accepts independent global statistics while search input changes', async () => {
    // pendingStats was started by mount before the new search input.
    const pendingStats = deferred<StatsResponse>()
    vi.mocked(statsApi.getStats).mockReturnValueOnce(pendingStats.promise)
    // wrapper initially has table data but no global statistics response.
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('latest')
    pendingStats.resolve(statistics())
    await flushPromises()
    expect(wrapper.text()).toMatch(/Всего доменов\s*42/)
    expect(wrapper.text()).toMatch(/Определено\s*30/)
    expect(wrapper.text()).toMatch(/Не определено\s*12/)
    expect(wrapper.text()).toMatch(/Не обработано\s*9/)
  })

  /** An already submitted creation still closes and notifies after search edits, then refreshes the current query. */
  it('completes creation independently from newer search input', async () => {
    // pendingCreate represents a submitted operation whose outcome must not depend on table search generations.
    const pendingCreate = deferred<OkResponse>()
    vi.spyOn(domainsApi, 'create').mockReturnValueOnce(pendingCreate.promise)
    // wrapper retains the real form inputs and submit event inside its modal collaborator.
    const wrapper = mountPage()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find(/** Locates the page's add action by its Russian text. */ (button) => button.text() === 'Добавить Домен')!
      .trigger('click')
    await wrapper.get('input[placeholder="example.com"]').setValue('created.test')
    await wrapper.get('form').trigger('submit')
    expect(domainsApi.create).toHaveBeenCalledWith([
      { domain: 'created.test', list_id: undefined, ros_comment: undefined },
    ])
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('latest')
    pendingCreate.resolve({ result: 'ok' })
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(notifications.showSuccess).toHaveBeenCalledWith('Домен "created.test" успешно добавлен')
    await vi.advanceTimersByTimeAsync(7000)
    await flushPromises()
    expect(domainsApi.search).toHaveBeenLastCalledWith('latest', expect.any(Object))
    expect(statsApi.getStats).toHaveBeenCalledTimes(2)
    expect(wrapper.get('tbody').text()).toContain('latest.test')
  })

  /** A confirmed deletion must close and notify even if its response arrives after a query change. */
  it('completes deletion and refreshes the currently entered query', async () => {
    // pendingDelete holds the already confirmed operation while search input changes.
    const pendingDelete = deferred<OkResponse>()
    vi.spyOn(domainsApi, 'deleteOne').mockReturnValueOnce(pendingDelete.promise)
    // wrapper displays the original stored row and its real delete action.
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('button[aria-label="Удалить домен"]').trigger('click')
    await wrapper
      .findAll('button')
      .find(
        /** Finds only the confirmation collaborator's action. */ (button) => button.text() === 'Подтвердить удаление',
      )!
      .trigger('click')
    expect(domainsApi.deleteOne).toHaveBeenCalledExactlyOnceWith(1)
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('latest')
    pendingDelete.resolve({ result: 'ok' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Подтвердить удаление')
    expect(notifications.showSuccess).toHaveBeenCalledWith('Домен #1 успешно удален')
    await vi.advanceTimersByTimeAsync(7000)
    await flushPromises()
    expect(domainsApi.search).toHaveBeenLastCalledWith('latest', expect.any(Object))
    expect(wrapper.get('tbody').text()).toContain('latest.test')
  })

  /** Query changes do not hide failures of submitted mutations; users still need the operation's outcome. */
  it('reports a submitted creation failure after search input changes', async () => {
    // pendingCreate and failure let the scenario settle the operation after a newer input event.
    const pendingCreate = deferred<OkResponse>()
    const failure = new Error('Creation failed')
    vi.spyOn(domainsApi, 'create').mockReturnValueOnce(pendingCreate.promise)
    // wrapper retains the failed form so the user can correct or retry the operation.
    const wrapper = mountPage()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find(/** Locates the page's add action by its Russian text. */ (button) => button.text() === 'Добавить Домен')!
      .trigger('click')
    await wrapper.get('input[placeholder="example.com"]').setValue('created.test')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('latest')
    pendingCreate.reject(failure)
    await flushPromises()
    expect(errorHandler.handleError).toHaveBeenCalledExactlyOnceWith(failure, {
      action: 'createDomain',
      component: 'DomainsPage',
      domain: 'created.test',
    })
    expect(notifications.showSuccess).not.toHaveBeenCalled()
    expect(wrapper.get<HTMLInputElement>('input[placeholder="example.com"]').element.value).toBe('created.test')
  })

  /** Unmount cancels pending debounce and suppresses notifications from an already running table response. */
  it('releases queued search and ignores in-flight completion after unmount', async () => {
    // oldRequest outlives the component; no later publication may escape the disposed scope.
    const oldRequest = deferred<DomainsResponse>()
    vi.mocked(domainsApi.search).mockReturnValueOnce(oldRequest.promise)
    // wrapper begins a request, queues another input and then unmounts before either can publish.
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('older')
    await vi.advanceTimersByTimeAsync(500)
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('latest')
    wrapper.unmount()
    oldRequest.resolve(domainPage([domain('obsolete.test')]))
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(domainsApi.search).toHaveBeenCalledTimes(1)
    expect(notifications.showInfo).not.toHaveBeenCalled()
    expect(errorHandler.handleError).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  /** Both rendered controls share parent state and each user action starts one list load. */
  it('synchronizes both pagers without duplicate list requests', async () => {
    vi.mocked(domainsApi.getAll).mockResolvedValue(domainPage([domain('baseline.test')], 995))
    // wrapper renders the real page; panels contains its two independently mounted pagination components.
    const wrapper = mountPage()
    await flushPromises()
    const panels = wrapper.findAllComponents(PaginationControl)
    expect(panels).toHaveLength(2)
    expect(domainsApi.getAll).toHaveBeenCalledTimes(1)
    await panels[0]!.get('select').setValue('10')
    await flushPromises()
    expect(panels[1]!.props('pageSize')).toBe(10)
    expect(domainsApi.getAll).toHaveBeenCalledTimes(2)
    expect(domainsApi.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 10, offset: 0 }))
    await panels[1]!
      .findAll('nav button')
      .find(/** Selects the bottom panel's distant final page. */ (button) => button.text() === '100')!
      .trigger('click')
    await flushPromises()
    expect(panels[0]!.props('currentPage')).toBe(100)
    expect(domainsApi.getAll).toHaveBeenCalledTimes(3)
    expect(domainsApi.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 10, offset: 990 }))
    await panels[0]!.get('select').setValue('50')
    await flushPromises()
    expect(panels[1]!.props()).toMatchObject({ currentPage: 1, pageSize: 50, totalPages: 20 })
    expect(domainsApi.getAll).toHaveBeenCalledTimes(4)
    expect(domainsApi.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50, offset: 0 }))
  })

  /** Empty and pending results keep both controls present and prevent out-of-bounds requests. */
  it('retains both pagers in loading and empty states', async () => {
    // pending holds the first list response while the controls expose their loading state.
    const pending = deferred<DomainsResponse>()
    vi.mocked(domainsApi.getAll).mockReturnValueOnce(pending.promise)
    // wrapper begins with no accepted table rows; panels remain mounted across response settlement.
    const wrapper = mountPage()
    await flushPromises()
    const panels = wrapper.findAllComponents(PaginationControl)
    expect(panels).toHaveLength(2)
    expect(
      panels.every(/** Checks shared loading state in both component instances. */ (panel) => panel.props('isLoading')),
    ).toBe(true)
    pending.resolve(domainPage([]))
    await flushPromises()
    expect(wrapper.findAllComponents(PaginationControl)).toHaveLength(2)
    expect(
      panels.every(
        /** Checks that no numbered pages are available after an empty reply. */ (panel) =>
          panel.props('totalPages') === 0,
      ),
    ).toBe(true)
    expect(
      wrapper
        .findAll('select')
        .every(/** Selectors retain the same parent-owned page size. */ (select) => select.element.value === '20'),
    ).toBe(true)
    expect(domainsApi.getAll).toHaveBeenCalledTimes(1)
  })

  /** Four status choices are exclusive server intents; switching/resetting removes the new flag and resets pages. */
  it('keeps unprocessed exclusive with the existing resolved statuses and reset', async () => {
    vi.mocked(domainsApi.getAll).mockResolvedValue(domainPage([domain('baseline.test')], 100))
    // wrapper provides real button handlers; clickStatus selects their exact Russian labels.
    const wrapper = mountPage()
    await flushPromises()
    /** Activates label through its rendered button and settles the corresponding isolated backend request. */
    async function clickStatus(label: string): Promise<void> {
      await wrapper
        .findAll('button')
        .find(
          /** Matches the status action rather than similarly worded captions. */ (button) => button.text() === label,
        )!
        .trigger('click')
      await flushPromises()
    }
    await wrapper
      .findAllComponents(PaginationControl)[0]!
      .findAll('nav button')
      .find(/** Selects a valid noninitial numbered page. */ (button) => button.text() === '3')!
      .trigger('click')
    await flushPromises()
    await clickStatus('Не обработано')
    expect(domainsApi.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ unprocessed: true, resolved: undefined, offset: 0 }),
    )
    expect(
      wrapper
        .findAllComponents(PaginationControl)
        .every(/** Both panel states reset together. */ (panel) => panel.props('currentPage') === 1),
    ).toBe(true)
    await wrapper.get('input[placeholder="Поиск по домену..."]').setValue('fresh')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(domainsApi.search).toHaveBeenLastCalledWith(
      'fresh',
      expect.objectContaining({ unprocessed: true, resolved: undefined, offset: 0 }),
    )
    await clickStatus('Определен')
    expect(domainsApi.search).toHaveBeenLastCalledWith(
      'fresh',
      expect.objectContaining({ unprocessed: undefined, resolved: true, offset: 0 }),
    )
    await clickStatus('Не определен')
    expect(domainsApi.search).toHaveBeenLastCalledWith(
      'fresh',
      expect.objectContaining({ unprocessed: undefined, resolved: false, offset: 0 }),
    )
    await clickStatus('Все')
    expect(domainsApi.search).toHaveBeenLastCalledWith(
      'fresh',
      expect.objectContaining({ unprocessed: undefined, resolved: undefined, offset: 0 }),
    )
    await clickStatus('Не обработано')
    await clickStatus('Сбросить')
    expect(domainsApi.search).toHaveBeenLastCalledWith(
      'fresh',
      expect.objectContaining({ unprocessed: undefined, resolved: undefined, offset: 0 }),
    )
    expect(statsApi.getStats).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toMatch(/Не обработано\s*9/)
  })

  /** An obsolete unprocessed result or failure must not overwrite the newer resolved selection or publish an error. */
  it.each(['success', 'failure'])('ignores an obsolete unprocessed %s after a status change', async (outcome) => {
    // oldRequest deliberately outlives the next status request; wrapper starts with accepted baseline data.
    const oldRequest = deferred<DomainsResponse>()
    const wrapper = mountPage()
    await flushPromises()
    vi.mocked(domainsApi.getAll)
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(domainPage([domain('accepted-resolved.test')]))
    await wrapper
      .findAll('button')
      .find(/** Starts the older unprocessed request. */ (button) => button.text() === 'Не обработано')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find(
        /** The latest status must remain usable while an older request is pending. */ (button) =>
          button.text() === 'Определен',
      )!
      .trigger('click')
    await flushPromises()
    if (outcome === 'success') oldRequest.resolve(domainPage([domain('obsolete-unprocessed.test')], 99))
    else oldRequest.reject(new Error('Obsolete unprocessed failure'))
    await flushPromises()
    expect(wrapper.get('tbody').text()).toContain('accepted-resolved.test')
    expect(wrapper.get('tbody').text()).not.toContain('obsolete-unprocessed.test')
    expect(wrapper.text()).not.toContain('99 результатов')
    expect(errorHandler.handleError).not.toHaveBeenCalled()
    expect(
      wrapper
        .findAllComponents(PaginationControl)
        .every(/** Completion belongs only to the newest request. */ (panel) => !panel.props('isLoading')),
    ).toBe(true)
  })

  /** A statistics failure follows the existing error path without fabricating counts from loaded table rows. */
  it('reports statistics failure and preserves zero unprocessed instead of deriving it from table rows', async () => {
    // failure is the independent global stats error; wrapper still receives a successful table response.
    const failure = new Error('Statistics unavailable')
    vi.mocked(statsApi.getStats).mockRejectedValueOnce(failure)
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toMatch(/Не обработано\s*0/)
    expect(wrapper.get('tbody').text()).toContain('baseline.test')
    expect(errorHandler.handleError).toHaveBeenCalledExactlyOnceWith(failure, {
      action: 'loadGlobalStats',
      component: 'DomainsPage',
    })
  })

  /** A changed backend total cannot leave either panel on a page outside the new selection. */
  it.each([21, 0])('clamps both panels when the requested page shrinks to %s rows', async (total) => {
    vi.mocked(domainsApi.getAll).mockResolvedValueOnce(domainPage([domain('initial.test')], 100))
    // wrapper first accepts five pages, then receives a smaller total for its final-page request.
    const wrapper = mountPage()
    await flushPromises()
    vi.mocked(domainsApi.getAll).mockResolvedValueOnce(domainPage([], total))
    if (total > 0) vi.mocked(domainsApi.getAll).mockResolvedValueOnce(domainPage([domain('new-last.test')], total))
    await wrapper
      .findAllComponents(PaginationControl)[0]!
      .findAll('nav button')
      .find(/** Requests a page that disappears before its response. */ (button) => button.text() === '5')!
      .trigger('click')
    await flushPromises()
    expect(
      wrapper
        .findAllComponents(PaginationControl)
        .every(
          /** Both panels adopt the last valid page, or one for empty results. */ (panel) =>
            panel.props('currentPage') === (total > 0 ? 2 : 1),
        ),
    ).toBe(true)
    expect(domainsApi.getAll).toHaveBeenCalledTimes(total > 0 ? 3 : 2)
    if (total > 0) {
      expect(domainsApi.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 20 }))
      expect(wrapper.get('tbody').text()).toContain('new-last.test')
    } else expect(wrapper.get('tbody').text()).toContain('Домены не найдены')
  })
})
