import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

/** A manually settled promise for choosing response order without real timers. */
export interface Deferred<T> {
  /** Result awaited by the code under test. */
  promise: Promise<T>
  /** Publishes the supplied successful value. */
  resolve: (value: T) => void
  /** Publishes the supplied failure. */
  reject: (reason: unknown) => void
}

/** Creates a promise whose result and completion order belong to the test. */
export function deferred<T>(): Deferred<T> {
  /** resolve publishes a successful value; reject publishes a failure; both come from the synchronous executor. */
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  /** promise remains pending; its executor captures resolvePromise and rejectPromise for the test controls. */
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

/** Runs setup inside a mounted Vue scope so unmount cleanup is exercised without lifecycle warnings. */
export function mountComposable<T>(setup: () => T) {
  /** result keeps the original composable refs, without component proxy unwrapping. */
  let result!: T
  /** wrapper owns the Vue scope; setup captures the composable and render supplies an inert element. */
  const wrapper = mount(
    defineComponent({
      /** Calls the supplied setup once inside the component lifecycle. */
      setup() {
        result = setup()
        /** Produces an inert root; the tested behavior is exposed by result. */
        return () => h('div')
      },
    }),
  )
  return { result, wrapper }
}
