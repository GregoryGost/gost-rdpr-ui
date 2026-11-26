import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { h } from 'vue'
import ErrorNotification from '@/components/ErrorNotification.vue'
import { API } from '@/constants'
import CommandsPage from '@/pages/commands/CommandsPage.vue'
import { useNotificationsStore } from '@/stores/notifications'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
import { errorHandler, type ErrorInfo } from '@/utils/errorHandler'
import { deferred } from '../fixtures/unit/harness'

/** Mounts the commands page with the production toast component and forwards errors as the application does. */
function mountPage() {
  /** Fresh Pinia instance shared by the page and its notifications. */
  const pinia = createPinia()
  /** Test-owned store, including timers for notifications. */
  const notifications = useNotificationsStore(pinia)
  /** Forwards the error info emitted by the page to the notification renderer. */
  const notifyError = (info: ErrorInfo) => notifications.addErrorNotification(info)
  errorHandler.onError(notifyError)
  /** Releases the error subscription and all timers owned by this test's notification store. */
  onTestFinished(() => {
    errorHandler.offError(notifyError)
    notifications.clearAll()
  })

  /** Wrapper owns the mounted page and the toast renderer, including teleported markup. */
  const wrapper = mount(
    {
      /** Renders the same page and notification components as the application shell. */
      render() {
        return h('div', [h(CommandsPage), h(ErrorNotification)])
      },
    },
    { attachTo: document.body, global: { plugins: [pinia] } },
  )
  return wrapper.getComponent(CommandsPage)
}

/** Finds the named button on the page or in the real teleported dialog. */
function getButton(scope: Element, name: string) {
  /** The matching native button uses the explicit accessible name or visible text. */
  const button = new DOMWrapper(scope).findAll('button').find(
    /** Matches the text when a button has no explicit accessible name. */
    (candidate) => (candidate.attributes('aria-label') ?? candidate.text()) === name,
  )
  if (!button) throw new Error(`Button not found: ${name}`)
  return button
}

/** Exact repeat message shared by both background command routes. */
const REPEATED_COMMAND = 'Команда уже выполняется или ожидает запуска'
/** Submit button for a full pass over outdated domains. */
const STALE_BUTTON = 'Определить устаревшие домены'
/** Accessible name of the RouterOS card's submit button. */
const ROUTER_OS_BUTTON = 'Отправить команду обновления RouterOS'
/** Russian phrases the previous UI used to claim completion on HTTP 200. */
const COMPLETION_TEXT = /Команда выполнена|домены успешно определены|RouterOS успешно обновл[её]н/i

/** Checks admission, repetition and errors at the normal UI and API boundaries. */
describe('background commands', () => {
  /** Supplies the observation API used by Headless UI and controls transport and toast timers. */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    /** Satisfies Headless UI subscriptions because jsdom does not calculate layout. */
    vi.stubGlobal(
      'ResizeObserver',
      class {
        /** No layout changes are dispatched in these tests. */
        observe() {}
        /** The test creates no live observations. */
        unobserve() {}
        /** Teardown owns no observer resources. */
        disconnect() {}
      },
    )
  })

  /**
   * Each row specifies a command, its POST URL, the HTTP result and the expected message.
   * The test holds the reply, checks loading, then checks the outcome in the page and toast.
   */
  it.each([
    [
      'Определить новые домены',
      '/api/commands/domains/resolve/new',
      'OK',
      'Команда определения новых доменов принята в обработку. Определение выполняется в фоне.',
    ],
    [
      STALE_BUTTON,
      '/api/commands/domains/resolve/stale',
      'OK',
      'Команда определения устаревших доменов принята в обработку. Определение выполняется в фоне.',
    ],
    [
      ROUTER_OS_BUTTON,
      '/api/commands/ros/update?type=4',
      'OK',
      'Команда обновления RouterOS принята в обработку. Обновление выполняется в фоне.',
    ],
    [STALE_BUTTON, '/api/commands/domains/resolve/stale', 'Job [domains_resolve] is now active', REPEATED_COMMAND],
    [ROUTER_OS_BUTTON, '/api/commands/ros/update?type=4', 'Job [ros_update] is now active', REPEATED_COMMAND],
    [
      STALE_BUTTON,
      '/api/commands/domains/resolve/stale',
      'Job [ros_update] is now active',
      'Сервер вернул неожиданный ответ. Статус приёма команды неизвестен.',
    ],
  ])('reports the response to %s (%s, %s)', async (name, path, result, message) => {
    /** reply keeps the HTTP request unresolved until the loading assertions complete. */
    const reply = deferred<Response>()
    /** fetchMock holds the actual request so its public URL and method can be checked. */
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(reply.promise)
    vi.stubGlobal('fetch', fetchMock)
    /** page gives access to the inline feedback and the selected command button. */
    const page = mountPage()
    /** body includes the teleported confirmation dialog and notifications. */
    const body = new DOMWrapper(document.body)
    /** trigger is the command's button, which stays disabled while the HTTP request is pending. */
    const trigger = getButton(page.element, name)
    await trigger.trigger('click')
    await flushPromises()
    /** confirm submits the request from the real dialog. */
    const confirm = getButton(body.get('[role="dialog"]').element, 'Выполнить')
    await confirm.trigger('click')
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(path, expect.objectContaining({ method: 'POST' }))
    expect(trigger.element.disabled).toBe(true)
    expect(confirm.element.disabled).toBe(true)
    expect(page.text()).not.toContain(message)
    expect(body.find('[role="alert"]').exists()).toBe(false)

    if (result === 'Job [domains_resolve] is now active') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flushPromises()
      expect(page.getComponent(ConfirmDialog).props('isOpen')).toBe(false)
      expect(trigger.element.disabled).toBe(true)
    }

    reply.resolve(Response.json({ result }, { status: 200 }))
    await flushPromises()

    expect(page.text()).toContain(message)
    expect(body.get('[role="alert"]').text()).toContain(message)
    expect(body.text()).not.toMatch(COMPLETION_TEXT)
    if (result !== 'OK') expect(body.get('[role="alert"]').text()).not.toContain('Команда принята')
    expect(trigger.element.disabled).toBe(false)
  })

  /**
   * Each row specifies a transport failure and its expected text. The test injects the failure during loading
   * and checks that both error surfaces render, the dialog closes and a later submission is available.
   */
  it.each([
    ['http', 'Сервер отклонил запрос'],
    ['network', 'Сервер недоступен. Проверьте подключение к сети'],
    ['timeout', 'Превышено время ожидания ответа от сервера'],
  ])('releases loading after a %s failure', async (failure, message) => {
    /** Suppresses the expected console output from the error handler for this induced failure. */
    vi.spyOn(console, 'error').mockImplementation(() => {})
    /** reply allows the transport failure to occur only after the UI enters its loading state. */
    const reply = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        /** Registers a fetch abort listener to reproduce the actual client timeout without waiting a minute. */
        (_input, init) => {
          init?.signal?.addEventListener(
            'abort',
            /** Rejects fetch with the error shape handled by the production transport. */
            () => reply.reject(Object.assign(new Error('Request aborted'), { name: 'AbortError' })),
            { once: true },
          )
          return reply.promise
        },
      ),
    )
    /** page and body expose inline and teleported UI output. */
    const page = mountPage()
    const body = new DOMWrapper(document.body)
    /** trigger must be available again after the failure. */
    const trigger = getButton(page.element, STALE_BUTTON)
    await trigger.trigger('click')
    await flushPromises()
    await getButton(body.get('[role="dialog"]').element, 'Выполнить').trigger('click')
    expect(trigger.element.disabled).toBe(true)

    if (failure === 'http') {
      reply.resolve(Response.json({ error: 'Сервер отклонил запрос' }, { status: 503 }))
    } else if (failure === 'network') {
      reply.reject(new TypeError('Failed to fetch'))
    } else {
      await vi.advanceTimersByTimeAsync(API.TIMEOUT - 1)
      expect(trigger.element.disabled).toBe(true)
      await vi.advanceTimersByTimeAsync(1)
    }
    await flushPromises()

    expect(page.text()).toContain(message)
    expect(body.get('[role="alert"]').text()).toContain(message)
    expect(body.text()).not.toMatch(COMPLETION_TEXT)
    expect(body.text()).not.toContain('принята в обработку')
    expect(page.getComponent(ConfirmDialog).props('isOpen')).toBe(false)
    expect(trigger.element.disabled).toBe(false)
  })
})
