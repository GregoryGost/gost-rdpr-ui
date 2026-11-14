import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
