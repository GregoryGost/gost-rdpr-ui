import type { Locator, Page } from '@playwright/test'
import { test, expect, makeDomain, type BrowserDomain, type ResolveOutcome } from './fixtures'

/** Builds a legacy-compatible record with both saved processing dates omitted; listId sets membership. */
function freshDomain(id: number, name: string, listId: number | null = null): BrowserDomain {
  // record starts from the full API shape, then removes dates to model a never-processed domain.
  const record = { ...makeDomain(id, name), resolved: false, domains_list_id: listId, ips_v4: [], ips_v6: [] }
  delete record.last_attempt_at
  delete record.last_attempt_at_hum
  delete record.last_resolved_at
  delete record.last_resolved_at_hum
  return record
}

/** Selects the statistic caption's value block, excluding the identically named filter button. */
function unprocessedCard(page: Page): Locator {
  return page.getByText('Не обработано', { exact: true }).and(page.locator('div')).locator('..')
}

/** The server selects untouched records globally; any known date, including zero, excludes a record. */
test('distinguishes missing processing dates from saved attempts and zero timestamps', async ({ page, api }) => {
  // never has explicit null dates; legacy omits them. These are the two expected members.
  // attempted/successful each have one known zero date; failed/partial model saved unsuccessful attempts.
  const never = { ...freshDomain(31, 'never-null.test', 7), last_attempt_at: null, last_resolved_at: null }
  const legacy = freshDomain(32, 'never-missing.test')
  const attempted = { ...freshDomain(33, 'attempt-only.test'), last_attempt_at: 0 }
  const successful = { ...freshDomain(34, 'success-only.test'), last_resolved_at: 0 }
  const failed = { ...freshDomain(35, 'failed.test'), last_attempt_at: 1700000300 }
  const partial = { ...freshDomain(36, 'partial.test'), last_attempt_at: 1700000300, ips_v4: ['192.0.2.20'] }
  api.domains = [
    ...api.domains,
    never,
    legacy,
    attempted,
    successful,
    failed,
    partial,
    makeDomain(37, 'completed.test'),
    freshDomain(0, 'service-zero.test'),
    freshDomain(-1, 'service-negative.test'),
  ]
  await page.goto('/#/domains')
  await expect(unprocessedCard(page)).toHaveText('Не обработано2')
  await expect(page.getByRole('cell', { name: 'never-null.test', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Не обработано', exact: true }).click()
  await expect(
    page.getByRole('group', { name: 'Статус доменов', exact: true }).getByRole('button', { pressed: true }),
  ).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Не обработано', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Показано 1 - 2 из 2 результатов')).toHaveCount(2)
  await expect(page.getByRole('cell', { name: 'never-null.test', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'never-missing.test', exact: true })).toBeVisible()
  // name identifies each explicit negative case, rather than recomputing the fixture's predicate in the assertion.
  for (const name of [
    'attempt-only.test',
    'success-only.test',
    'failed.test',
    'partial.test',
    'completed.test',
    'service-zero.test',
    'service-negative.test',
  ]) {
    await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(0)
  }
  expect(api.requests.at(-1)).toContain('unprocessed=true')
  expect(api.requests.at(-1)).not.toContain('resolved=false')
  await page.getByRole('button', { name: 'Со списком', exact: true }).click()
  await expect(page.getByText('Показано 1 - 1 из 1 результатов')).toHaveCount(2)
  await expect(page.getByRole('cell', { name: 'never-null.test', exact: true })).toBeVisible()
  await expect(unprocessedCard(page)).toHaveText('Не обработано2')
  await page.getByRole('button', { name: 'Без списка', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'never-missing.test', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'never-null.test', exact: true })).toHaveCount(0)
  await page.getByPlaceholder('Поиск по домену...').fill('never-missing')
  /** The search keeps the same one-row range, so the request itself distinguishes it from the preceding list. */
  await expect.poll(() => api.requests.at(-1)).toContain('/domains/search?text=never-missing')
  await expect(page.getByRole('combobox', { name: 'На странице:', exact: true }).first()).toBeEnabled()
  await expect(page.getByText('Показано 1 - 1 из 1 результатов')).toHaveCount(2)
  expect(api.requests.at(-1)).toContain('/domains/search?text=never-missing')
  expect(api.requests.at(-1)).toContain('unprocessed=true')
  await page.getByRole('searchbox', { name: 'Фильтр: Комментарий', exact: true }).fill('absent-comment')
  await expect(page.getByRole('cell', { name: 'Домены не найдены', exact: true })).toBeVisible()
  await expect(unprocessedCard(page)).toHaveText('Не обработано2')
  await page.getByRole('searchbox', { name: 'Фильтр: Комментарий', exact: true }).fill('')
  await expect(page.getByRole('cell', { name: 'never-missing.test', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click()
  /** Reset preserves the current search and rows; its new public request must lose the status flag. */
  await expect.poll(() => api.requests.at(-1)).not.toContain('unprocessed=')
  await expect(page.getByRole('combobox', { name: 'На странице:', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('cell', { name: 'never-missing.test', exact: true })).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Статус доменов', exact: true }).getByRole('button', { pressed: true }),
  ).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Все', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(api.requests.at(-1)).not.toContain('unprocessed=')
  await expect(unprocessedCard(page)).toHaveText('Не обработано2')
})

/** List membership is a client-side filter, so its exact total must scan every server-filtered batch. */
test('counts and pages combined unprocessed and list filters beyond the first backend batch', async ({ page, api }) => {
  /** Gives index one never-processed domain; even indices belong to the saved list, including index 100. */
  api.domains = Array.from({ length: 101 }, (_, index) =>
    freshDomain(index + 1000, `fresh-${index}.test`, index % 2 === 0 ? 7 : null),
  )
  api.domains.push(makeDomain(2000, 'processed-listed.test'))
  await page.goto('/#/domains')
  await expect(unprocessedCard(page)).toHaveText('Не обработано101')
  await page.getByRole('combobox', { name: 'На странице:', exact: true }).first().selectOption('10')
  await page.getByRole('button', { name: 'Не обработано', exact: true }).click()
  await expect(page.getByText('Показано 1 - 10 из 101 результатов')).toHaveCount(2)
  await page.getByRole('button', { name: 'Со списком', exact: true }).click()
  await expect(page.getByText('Показано 1 - 10 из 51 результатов')).toHaveCount(2)
  expect(
    api.requests.some(
      /** A second filtered batch is required to establish the true list total. */ (request) =>
        request.includes('offset=100') && request.includes('unprocessed=true'),
    ),
  ).toBe(true)
  await page
    .getByRole('navigation', { name: 'Пагинация доменов сверху', exact: true })
    .getByRole('button', { name: 'Последняя страница: 6', exact: true })
    .click()
  await expect(page.getByText('Показано 51 - 51 из 51 результатов')).toHaveCount(2)
  await expect(page.getByRole('cell', { name: 'fresh-100.test', exact: true })).toBeVisible()
  await expect(unprocessedCard(page)).toHaveText('Не обработано101')
  await page.getByRole('button', { name: 'Не определен', exact: true }).click()
  /** This category has the same count as unprocessed here; observe the changed request before checking its total. */
  await expect.poll(() => api.requests.at(-1)).toContain('resolved=false')
  await expect(page.getByRole('combobox', { name: 'На странице:', exact: true }).first()).toBeEnabled()
  await expect(page.getByText('Показано 1 - 10 из 51 результатов')).toHaveCount(2)
  expect(api.requests.at(-1)).toContain('resolved=false')
  expect(api.requests.at(-1)).not.toContain('unprocessed=')
  await page.getByRole('button', { name: 'Определен', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'processed-listed.test', exact: true })).toBeVisible()
  expect(api.requests.at(-1)).toContain('resolved=true')
  expect(api.requests.at(-1)).not.toContain('unprocessed=')
  await page.getByRole('button', { name: 'Все', exact: true }).click()
  await expect(page.getByText('Показано 1 - 10 из 52 результатов')).toHaveCount(2)
  expect(api.requests.at(-1)).not.toContain('resolved=')
  expect(api.requests.at(-1)).not.toContain('unprocessed=')
  await expect(unprocessedCard(page)).toHaveText('Не обработано101')
})

// outcome names each persisted first-attempt result; every completed attempt is processing even without success.
for (const outcome of ['success', 'partial', 'failure'] as const satisfies readonly ResolveOutcome[]) {
  /** Diagnostics and acceptance leave a domain untouched; completion removes it after a normal reload. */
  test(`removes a domain from unprocessed only after its first saved ${outcome} attempt`, async ({ page, api }) => {
    api.domains = [freshDomain(1, 'fresh.test')]
    await page.goto('/#/domains')
    await expect(unprocessedCard(page)).toHaveText('Не обработано1')
    await page.getByRole('button', { name: 'Проверить резолвинг домена: fresh.test', exact: true }).click()
    // diagnostic is the read-only one-time check dialog; confirmation starts separately saved background work.
    const diagnostic = page.getByRole('dialog', { name: 'Проверка резолвинга домена', exact: true })
    await diagnostic.getByRole('button', { name: 'Проверить', exact: true }).click()
    await expect(diagnostic.getByRole('heading', { name: 'Результат проверки', exact: true })).toBeVisible()
    await diagnostic.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await page.reload()
    await expect(unprocessedCard(page)).toHaveText('Не обработано1')
    await page.getByRole('button', { name: 'Запустить фоновый резолвинг: fresh.test', exact: true }).click()
    const confirmation = page.getByRole('dialog', { name: 'Запуск фонового резолвинга', exact: true })
    await confirmation.getByRole('button', { name: 'Запустить резолвинг', exact: true }).click()
    await expect(confirmation.getByRole('status')).toContainText('Запуск принят в обработку')
    await confirmation.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await page.reload()
    await expect(unprocessedCard(page)).toHaveText('Не обработано1')
    api.completeResolve(1, outcome)
    await page.reload()
    await expect(unprocessedCard(page)).toHaveText('Не обработано0')
    await page.getByRole('button', { name: 'Не обработано', exact: true }).click()
    await expect(page.getByRole('cell', { name: 'Домены не найдены', exact: true })).toBeVisible()
    await expect(page.getByText('Показано 0 - 0 из 0 результатов')).toHaveCount(2)
  })
}

/** A legitimate zero is visible alongside the original independently meaningful statistics. */
test('renders zero unprocessed domains without changing the original counters', async ({ page, api }) => {
  await page.goto('/#/domains')
  await expect(unprocessedCard(page)).toHaveText('Не обработано0')
  await expect(page.getByText('Всего доменов', { exact: true }).locator('..')).toHaveText('Всего доменов26')
  await expect(page.getByText('Определено', { exact: true }).and(page.locator('div')).locator('..')).toHaveText(
    'Определено14',
  )
  await expect(page.getByText('Не определено', { exact: true }).locator('..')).toHaveText('Не определено12')
  expect(api.mutations).toEqual([])
})
