import { getCurrentScope, onScopeDispose } from 'vue'

/** Creates guards that prevent obsolete async work from publishing state; transport requests continue normally. */
export function useLatestRequest() {
  // generation changes on each new request or intent, including intents waiting for a debounce timer.
  let generation = 0
  // disposed prevents pending continuations from publishing after the owning Vue scope ends.
  let disposed = false

  /** Makes all previously captured guards obsolete without starting another transport request. */
  const invalidate = () => {
    generation += 1
  }

  /** Returns a predicate that stays true only while the current generation and owning scope remain active. */
  const capture = () => {
    // capturedGeneration identifies the intent whose continuation is checking whether it can publish.
    const capturedGeneration = generation
    return () => !disposed && generation === capturedGeneration
  }

  /** Starts a new generation and returns its publication guard, invalidating earlier work immediately. */
  const begin = () => {
    invalidate()
    return capture()
  }

  /** Checks scope lifetime independently of table intent, for outcomes of already submitted mutations. */
  const isActive = () => !disposed

  if (getCurrentScope()) {
    /** Permanently rejects pending continuations when the component or effect scope is disposed. */
    onScopeDispose(() => {
      disposed = true
      invalidate()
    })
  }

  return { begin, capture, invalidate, isActive }
}
