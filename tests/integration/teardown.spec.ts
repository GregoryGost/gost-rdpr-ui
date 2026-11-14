import { afterAll, expect, it, vi } from 'vitest'
import { defineComponent, h, onUnmounted } from 'vue'
import { mount } from '@vue/test-utils'

/** Records the resources still available when automatic component cleanup runs. */
interface TeardownObservation {
  /** Whether the component releases its resources before the test clock is restored. */
  fakeTimers: boolean
  /** Whether the component still sees the transport stub belonging to its test. */
  fetchMock: boolean
  /** Whether the mount target remains in the document until the component releases it. */
  hostConnected: boolean
}

/** observation is written by the unmount hook, which runs after the single test body finishes. */
let observation: TeardownObservation | undefined

/** Checks the automatic afterEach result; checking inside the test would bypass the shared teardown path. */
afterAll(() => {
  expect(observation).toEqual({ fakeTimers: true, fetchMock: true, hostConnected: true })
})

/** A component must release resources while its test clock, transport stub and mount target still exist. */
it('unmounts components before restoring their test environment', () => {
  vi.useFakeTimers()
  /** fetchMock replaces transport only for this test; no request is sent. */
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  /** host is the test-owned mount target which shared DOM cleanup removes after unmount. */
  const host = document.createElement('div')
  document.body.append(host)
  /** ResourceOwner observes its environment while Vue releases the component. */
  const ResourceOwner = defineComponent({
    /** Registers the resource-release observation and returns a minimal render callback. */
    setup() {
      /** Captures the test resources at automatic unmount rather than requiring a manual wrapper.unmount call. */
      onUnmounted(() => {
        observation = {
          fakeTimers: vi.isFakeTimers(),
          fetchMock: globalThis.fetch === fetchMock,
          hostConnected: host.isConnected,
        }
      })
      /** Renders a real DOM node so the wrapper participates in automatic Vue Test Utils cleanup. */
      return () => h('span', 'resource owner')
    },
  })
  mount(ResourceOwner, { attachTo: host })
})
