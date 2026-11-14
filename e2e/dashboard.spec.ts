import { test, expect } from './fixtures'

/** Busy polling ticks are skipped, and the next interval may request health after the pending request finishes. */
test('keeps one health request in flight while polling ticks are busy', async ({ page, api }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  /** The initialization callback chooses the existing one-second option before the dashboard starts polling. */
  await page.addInitScript(() => localStorage.setItem('polling-interval', '1000'))
  api.holdPaths.add('/health')
  await page.goto('/#/')
  await expect(page.getByRole('heading', { level: 1, name: 'Главная' })).toBeVisible()
  /** The poll callback waits until the initial health request reaches the controlled backend boundary. */
  await expect.poll(() => api.heldPaths.get('/health')?.length).toBe(1)
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'))
  await page.clock.runFor(2000)
  /** The filter callback counts request only when it is a health poll, excluding config and statistics traffic. */
  expect(api.requests.filter((request) => request === 'GET /api/health')).toHaveLength(1)
  await api.releasePath('/health')
  await expect(page.getByText('OK', { exact: true })).toBeVisible()
  await page.clock.runFor(1000)
  /** The poll callback uses its request predicate to count health calls after the next idle interval. */
  await expect.poll(() => api.requests.filter((request) => request === 'GET /api/health').length).toBe(2)
})

/** A rejected browser save must keep the polling preference and notify rather than publishing an unsaved value. */
test('retains the polling setting when local storage rejects its update', async ({ page, api }) => {
  api.expectedConsoleErrors.push(/^Failed to save polling interval to localStorage:/)
  /** Fails only interval writes after preloading the old accepted preference in the browser's native storage. */
  await page.addInitScript(() => {
    localStorage.setItem('polling-interval', '3000')
    // originalSetItem preserves normal browser behavior for all unrelated preference keys.
    const originalSetItem = Storage.prototype.setItem
    /** Rejects only the interval setting with an explicit quota error, retaining the previous persisted value. */
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key === 'polling-interval') throw new DOMException('Synthetic quota failure', 'QuotaExceededError')
      originalSetItem.call(this, key, value)
    }
  })
  await page.goto('/#/')
  await expect(page.getByRole('button', { name: '3 секунды', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '3 секунды', exact: true }).click()
  await page.getByRole('option', { name: 'Отключено', exact: true }).click()
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Не удалось сохранить частоту обновления. Предыдущее значение сохранено.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '3 секунды', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Обновить вручную', exact: true })).toHaveCount(0)
  /** The browser callback inspects the persisted public preference without importing the application store. */
  expect(await page.evaluate(() => localStorage.getItem('polling-interval'))).toBe('3000')
})
