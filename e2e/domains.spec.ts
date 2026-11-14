import type { Locator, Page } from '@playwright/test'
import { test, expect, type ResolveOutcome } from './fixtures'

/** Opens the direct public hash route and waits for the domain table's initial data. */
async function openDomains(page: Page): Promise<void> {
  await page.goto('/#/domains')
  await expect(page.getByRole('heading', { level: 1, name: 'Домены', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'dated.example.test', exact: true })).toBeVisible()
}

/** Opens name's existing row card through the real table, without application-internal access. */
async function openCard(page: Page, name: string): Promise<Locator> {
  await page.getByRole('cell', { name, exact: true }).click()
  // card is the saved-domain dialog, distinguishable from background and diagnostic dialogs by its title.
  const card = page.getByRole('dialog', { name: `Домен: ${name}`, exact: true })
  await expect(card.getByRole('heading', { name: `Домен: ${name}`, exact: true })).toBeVisible()
  return card
}

/** Checks label's displayed date inside its own timestamp block, avoiding matching another date elsewhere. */
async function expectDate(card: Locator, label: string, value: string): Promise<void> {
  await expect(card.getByText(label, { exact: true }).locator('..')).toContainText(value)
}

/** Covers user navigation and document titles through direct entry, reload and browser history. */
test('navigates between home, domains, history and an unknown hash route', async ({ page, api }) => {
  expect(api.domains).toHaveLength(26)
  await page.goto('/#/')
  await expect(page.getByRole('heading', { level: 1, name: 'Главная' })).toBeVisible()
  await expect(page).toHaveTitle('Главная — GOST-RDPR Ui')
  await page.getByRole('link', { name: 'Домены', exact: true }).click()
  await expect(page).toHaveURL(/\/#\/domains$/)
  await expect(page).toHaveTitle('Домены — GOST-RDPR Ui')
  await expect(page.getByRole('cell', { name: 'dated.example.test', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Главная' })).toBeVisible()
  await expect(page).toHaveTitle('Главная — GOST-RDPR Ui')
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1, name: 'Домены', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('cell', { name: 'dated.example.test', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Домены — GOST-RDPR Ui')
  await page.goto('/#/missing-example-route')
  await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible()
  await expect(page.getByText('Страница не найдена', { exact: true })).toBeVisible()
  await expect(page).toHaveTitle('404 - Страница не найдена — GOST-RDPR Ui')
})

/** Verifies API-backed pagination, button categories, combined column filters and reset behavior. */
test('pages and combines domain filters before opening a matching card', async ({ page, api }) => {
  await openDomains(page)
  await page.getByRole('combobox', { name: 'На странице:' }).first().selectOption('10')
  await expect(page.getByText('Показано 1 - 10 из 26 результатов').first()).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Пагинация доменов сверху' })
    .getByRole('button', { name: '2', exact: true })
    .click()
  await expect(page.getByRole('cell', { name: 'page-11.example.test', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'dated.example.test', exact: true })).toHaveCount(0)
  await expect(page.getByText('Показано 11 - 20 из 26 результатов').first()).toBeVisible()
  await page.getByRole('button', { name: 'Не определен', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'unknown.example.test', exact: true })).toBeVisible()
  await expect(page.getByText('Показано 1 - 10 из 12 результатов').first()).toBeVisible()
  await page.getByRole('button', { name: 'Со списком', exact: true }).click()
  await expect(page.getByText('Домены не найдены', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'dated.example.test', exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Фильтр: Комментарий', exact: true }).fill('primary')
  await page.getByRole('searchbox', { name: 'Фильтр: Домен', exact: true }).fill('dated')
  await expect(page.getByText('Показано 1 - 1 из 1 результатов').first()).toBeVisible()
  // card is opened from the filtered table; its saved values must match the chosen entity.
  const card = await openCard(page, 'dated.example.test')
  await expectDate(card, 'Последняя попытка', '2023-11-14 22:16:40')
  /** The request predicate confirms that the visible name filter reached the public search endpoint. */
  expect(api.requests.some((request) => request.includes('/domains/search?text=dated'))).toBe(true)
})

/** The same card must preserve successful resolution dates whether opened from a list or a search result. */
test('opens the existing saved card from list and search with independent attempt and success dates', async ({
  page,
  api,
}) => {
  await openDomains(page)
  // listCard is opened before any search; searchCard is the same public dialog after search.
  const listCard = await openCard(page, 'dated.example.test')
  await expectDate(listCard, 'Последняя попытка', '2023-11-14 22:16:40')
  await expectDate(listCard, 'Последнее определение', '2023-11-14 22:15:00')
  await expect(listCard.getByText('Timestamp: 1700000200', { exact: true })).toBeVisible()
  await listCard.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await page.getByPlaceholder('Поиск по домену...').fill('dated')
  await expect(page.getByText('Показано 1 - 1 из 1 результатов').first()).toBeVisible()
  const searchCard = await openCard(page, 'dated.example.test')
  await expectDate(searchCard, 'Последняя попытка', '2023-11-14 22:16:40')
  await expectDate(searchCard, 'Последнее определение', '2023-11-14 22:15:00')
  expect(api.mutations).toEqual([])
})

// name identifies each compatibility case in a fresh independent browser context.
for (const name of ['unknown.example.test', 'legacy.example.test']) {
  /** Null and omitted attempt metadata must hide the block without changing the known successful date. */
  test(`hides unknown attempt metadata for ${name}`, async ({ page, api }) => {
    await openDomains(page)
    // card belongs to the selected null or legacy record rather than the populated control record.
    const card = await openCard(page, name)
    await expect(card.getByText('Последняя попытка', { exact: true })).toHaveCount(0)
    await expect(card.getByText('Timestamp: 0', { exact: true })).toHaveCount(0)
    await expectDate(card, 'Последнее определение', '2023-11-14 22:15:00')
    await card.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)
    await page.getByPlaceholder('Поиск по домену...').fill(name)
    await expect(page.getByText('Показано 1 - 1 из 1 результатов').first()).toBeVisible()
    // searchCard verifies the same null/omitted compatibility contract on the separately fetched search payload.
    const searchCard = await openCard(page, name)
    await expect(searchCard.getByText('Последняя попытка', { exact: true })).toHaveCount(0)
    await expect(searchCard.getByText('Timestamp: 0', { exact: true })).toHaveCount(0)
    await expectDate(searchCard, 'Последнее определение', '2023-11-14 22:15:00')
    expect(api.mutations).toEqual([])
  })
}

// outcome selects the completed backend result, not the initial acceptance acknowledgement.
for (const outcome of ['success', 'partial', 'failure'] as const satisfies readonly ResolveOutcome[]) {
  /** Accepted background work leaves saved dates unchanged until completion is observed after a refresh. */
  test(`refreshes a saved attempt after ${outcome} without confusing acceptance and completion`, async ({
    page,
    api,
  }) => {
    await openDomains(page)
    await page.getByRole('button', { name: 'Запустить фоновый резолвинг: dated.example.test', exact: true }).click()
    // confirmation is the separate background-resolve dialog.
    const confirmation = page.getByRole('dialog', { name: 'Запуск фонового резолвинга', exact: true })
    await confirmation.getByRole('button', { name: 'Запустить резолвинг', exact: true }).click()
    await expect(confirmation.getByRole('status')).toContainText('Запуск принят в обработку')
    await expect(confirmation.getByRole('status')).toContainText('не означает, что операция уже завершена')
    expect(api.mutations).toEqual([{ method: 'POST', path: '/domains/1/resolve', body: null }])
    await confirmation.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await page.reload()
    // beforeCompletion proves the 202 response alone did not invent a new saved date.
    const beforeCompletion = await openCard(page, 'dated.example.test')
    await expectDate(beforeCompletion, 'Последняя попытка', '2023-11-14 22:16:40')
    await beforeCompletion.getByRole('button', { name: 'Закрыть', exact: true }).click()
    api.completeResolve(1, outcome)
    await page.reload()
    // afterCompletion displays newly fetched saved data, including partial and failed attempts.
    const afterCompletion = await openCard(page, 'dated.example.test')
    await expectDate(afterCompletion, 'Последняя попытка', '2023-11-14 22:18:20')
    await expectDate(
      afterCompletion,
      'Последнее определение',
      outcome === 'success' ? '2023-11-14 22:18:20' : '2023-11-14 22:15:00',
    )
    // This already-resolved domain retains its saved checkpoint after an incomplete or failed later attempt.
    await expect(afterCompletion.getByText('Определен', { exact: true })).toBeVisible()
  })
}

/** A one-time diagnostic result must never overwrite saved attempt metadata or addresses on reopen. */
test('keeps saved attempt data unchanged after a one-time resolve check', async ({ page, api }) => {
  await openDomains(page)
  await page.getByRole('button', { name: 'Проверить резолвинг домена: dated.example.test', exact: true }).click()
  // diagnostic is the one-time check dialog whose result is deliberately distinct from saved addresses.
  const diagnostic = page.getByRole('dialog', { name: 'Проверка резолвинга домена', exact: true })
  await diagnostic.getByRole('button', { name: 'Проверить', exact: true }).click()
  await expect(diagnostic.getByRole('heading', { name: 'Результат проверки', exact: true })).toBeVisible()
  await expect(diagnostic.getByText('192.0.2.99', { exact: true })).toBeVisible()
  expect(api.mutations).toEqual([{ method: 'POST', path: '/domains/resolve/check', body: { id: 1 } }])
  await diagnostic.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.reload()
  // savedCard comes from a fresh list request, so unchanged dates cannot be a stale open-modal artifact.
  const savedCard = await openCard(page, 'dated.example.test')
  await expectDate(savedCard, 'Последняя попытка', '2023-11-14 22:16:40')
  await expectDate(savedCard, 'Последнее определение', '2023-11-14 22:15:00')
  await expect(savedCard.getByText('192.0.2.10', { exact: true })).toBeVisible()
  await expect(savedCard.getByText('192.0.2.99', { exact: true })).toHaveCount(0)
})

/** Form validation must prevent requests; successful create/delete must update the fixture-backed table. */
test('validates creation, creates the submitted domain, cancels then confirms deletion', async ({ page, api }) => {
  api.domains = api.domains.slice(0, 3)
  await openDomains(page)
  await page.getByRole('button', { name: 'Добавить Домен', exact: true }).click()
  // form is the create dialog, scoped to avoid matching the page's add button.
  const form = page.getByRole('dialog', { name: 'Добавить Домен', exact: true })
  await form.getByPlaceholder('example.com', { exact: true }).fill('ab')
  await form.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(form.getByText('Укажите доменное имя (минимум 3 символа)', { exact: true })).toBeVisible()
  expect(api.mutations).toEqual([])
  await form.getByPlaceholder('example.com', { exact: true }).fill('bad domain')
  await form.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(form.getByText('Некорректный формат доменного имени', { exact: true })).toBeVisible()
  expect(api.mutations).toEqual([])
  await form.getByPlaceholder('example.com', { exact: true }).fill('created.example.test')
  await form.getByPlaceholder('Комментарий для RouterOS').fill('Browser-created record')
  await form.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(form).toHaveCount(0)
  await expect(
    page.getByRole('alert').filter({ hasText: 'Домен "created.example.test" успешно добавлен' }),
  ).toBeVisible()
  expect(api.mutations).toEqual([
    {
      method: 'POST',
      path: '/domains',
      body: [{ domain: 'created.example.test', ros_comment: 'Browser-created record' }],
    },
  ])
  // row is the newly created entity, identified by its visible name rather than a positional index.
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'created.example.test', exact: true }) })
  // The condition allows the application's real seven-second acceptance delay without replacing browser focus timers.
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.getByRole('button', { name: 'Удалить домен', exact: true }).click()
  // deletion is reused across cancellation and the second, confirmed attempt.
  const deletion = page.getByRole('dialog', { name: 'Удалить Домен', exact: true })
  await deletion.getByRole('button', { name: 'Отмена', exact: true }).click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await expect(row.getByRole('button', { name: 'Удалить домен', exact: true })).toBeFocused()
  expect(api.mutations).toHaveLength(1)
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Удалить домен', exact: true }).click()
  await deletion.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(deletion).toHaveCount(0)
  await expect(page.getByRole('alert').filter({ hasText: 'Домен #100 успешно удален' })).toBeVisible()
  // The completed range distinguishes a refreshed table from the transient loading state that also hides the row.
  await expect(page.getByText('Показано 1 - 3 из 3 результатов').first()).toBeVisible({ timeout: 10_000 })
  await expect(row).toHaveCount(0)
  expect(api.mutations.at(-1)).toEqual({ method: 'DELETE', path: '/domains/100', body: null })
})

/** Loading, legitimate empty data and a failed API request have distinct observable outcomes. */
test('shows loading, empty results, API failure notification and recovery', async ({ page, api }) => {
  api.holdDomains = true
  await page.goto('/#/domains')
  await expect(page.getByRole('cell', { name: 'Загрузка...', exact: true })).toBeVisible()
  /** The poll callback waits until the list request has reached the fixture before releasing its empty reply. */
  await expect.poll(() => api.heldDomains.length).toBe(1)
  api.domains = []
  await api.releaseDomains()
  await expect(page.getByRole('cell', { name: 'Домены не найдены', exact: true })).toBeVisible()
  api.nextDomainStatus = 500
  api.expectedConsoleErrors.push(/Failed to load resource: the server responded with a status of 500/)
  api.expectedConsoleErrors.push(/^\{type: api, severity: error, message: Контролируемая ошибка списка доменов,/)
  await page.getByRole('button', { name: 'Все', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Контролируемая ошибка списка доменов' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Домены не найдены', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Все', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Домены не найдены', exact: true })).toBeVisible()
  expect(api.nextDomainStatus).toBeNull()
})

/** New input invalidates an older in-flight search immediately, before its replacement debounce expires. */
test('rejects an old search response during the new input debounce gap', async ({ page, api }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await openDomains(page)
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'))
  api.holdSearches.add('legacy')
  api.holdSearches.add('dated')
  await page.getByPlaceholder('Поиск по домену...').fill('legacy')
  await page.clock.runFor(500)
  /** The poll callback confirms the old request is in flight before a new input invalidates it. */
  await expect.poll(() => api.heldSearches.has('legacy')).toBe(true)
  await page.getByPlaceholder('Поиск по домену...').fill('dated')
  await api.releaseSearch('legacy')
  await page.clock.runFor(100)
  await expect(page.getByRole('cell', { name: 'legacy.example.test', exact: true })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Загрузка...', exact: true })).toBeVisible()
  expect(api.heldSearches.has('dated')).toBe(false)
  await expect(page.getByRole('alert').filter({ hasText: 'Найдено доменов:' })).toHaveCount(0)
  await page.clock.runFor(400)
  /** The poll callback observes the replacement request only after its debounce window expires. */
  await expect.poll(() => api.heldSearches.has('dated')).toBe(true)
  await api.releaseSearch('dated')
  await page.clock.resume()
  await expect(page.getByRole('cell', { name: 'dated.example.test', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'legacy.example.test', exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert').filter({ hasText: 'Найдено доменов: 1' })).toHaveCount(1)
})

/** A later-arriving old search must not replace the already-rendered newest response. */
test('preserves the newest search when responses complete in inverse order', async ({ page, api }) => {
  await openDomains(page)
  api.holdSearches.add('legacy')
  api.holdSearches.add('dated')
  await page.getByPlaceholder('Поиск по домену...').fill('legacy')
  /** The poll callback establishes that the older query reached the backend boundary. */
  await expect.poll(() => api.heldSearches.has('legacy')).toBe(true)
  await page.getByPlaceholder('Поиск по домену...').fill('dated')
  /** The poll callback establishes that both requests are pending before inverse completion. */
  await expect.poll(() => api.heldSearches.has('dated')).toBe(true)
  await api.releaseSearch('dated')
  await expect(page.getByRole('cell', { name: 'dated.example.test', exact: true })).toBeVisible()
  // oldResponse's predicate selects the legacy response so its completion precedes the rendering check.
  const oldResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get('text') === 'legacy')
  await api.releaseSearch('legacy')
  await (await oldResponse).finished()
  /** The browser callback creates a promise whose resolve callback runs after two nested rendering callbacks,
   * allowing stale response handlers to commit any DOM change before assertions inspect the page. */
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
  await expect(page.getByRole('cell', { name: 'dated.example.test', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'legacy.example.test', exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert').filter({ hasText: 'Найдено доменов: 1' })).toHaveCount(1)
})

/** Global statistics are independent of search intent and must still arrive after a table query changes. */
test('accepts initial global statistics after the user changes the table search', async ({ page, api }) => {
  api.holdPaths.add('/stats')
  await openDomains(page)
  /** The poll callback ensures global statistics remain pending while the user changes the table query. */
  await expect.poll(() => api.heldPaths.get('/stats')?.length).toBe(1)
  await page.getByPlaceholder('Поиск по домену...').fill('dated')
  await expect(page.getByText('Показано 1 - 1 из 1 результатов').first()).toBeVisible()
  await api.releasePath('/stats')
  await expect(page.getByText('Всего доменов', { exact: true }).locator('..')).toHaveText('Всего доменов26')
  await expect(page.getByText('Показано 1 - 1 из 1 результатов').first()).toBeVisible()
})

/** Changing search during the existing background-acceptance delay must not suppress the mutation refresh. */
test('refreshes saved counts and the current search after creation during a query change', async ({ page, api }) => {
  await page.clock.install()
  api.domains = api.domains.slice(0, 3)
  await openDomains(page)
  await expect(page.getByText('Всего доменов', { exact: true }).locator('..')).toHaveText('Всего доменов3')
  await page.getByRole('button', { name: 'Добавить Домен', exact: true }).click()
  // form is the submitted create dialog; its success closes it before the delayed list refresh.
  const form = page.getByRole('dialog', { name: 'Добавить Домен', exact: true })
  await form.getByPlaceholder('example.com', { exact: true }).fill('created.example.test')
  await form.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await expect(
    page.getByRole('alert').filter({ hasText: 'Домен "created.example.test" успешно добавлен' }),
  ).toBeVisible()
  await page.getByPlaceholder('Поиск по домену...').fill('dated')
  await expect(page.getByText('Показано 1 - 1 из 1 результатов').first()).toBeVisible()
  await page.clock.fastForward(7000)
  await expect(page.getByText('Всего доменов', { exact: true }).locator('..')).toHaveText('Всего доменов4')
  await expect(page.getByRole('cell', { name: 'dated.example.test', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'created.example.test', exact: true })).toHaveCount(0)
  await page.getByPlaceholder('Поиск по домену...').fill('created')
  await expect(page.getByRole('cell', { name: 'created.example.test', exact: true })).toBeVisible()
})
