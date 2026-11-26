import type { Locator } from '@playwright/test'
import { test, expect, makeDomain } from './fixtures'

/** Checks that locator has a rendered box contained horizontally by the current viewport width. */
async function expectContained(locator: Locator, width: number): Promise<void> {
  // bounds describes the rendered public control, including borders and padding.
  const bounds = await locator.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) throw new Error('Visible control has no geometry')
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
}

/** Both panels update one selection and expose a direct shortcut to the final matching page. */
test('shares pagination state and one request per action across both panels', async ({ page, api }) => {
  /** Each index receives a unique record after the existing semantic fixture's ID range. */
  api.domains = Array.from({ length: 121 }, (_, index) =>
    makeDomain(index + 1000, `pager-${String(index).padStart(3, '0')}.test`),
  )
  await page.goto('/#/domains')
  // top/bottom identify separate landmarks; sizes contains their associated public size selectors.
  const top = page.getByRole('navigation', { name: 'Пагинация доменов сверху', exact: true })
  const bottom = page.getByRole('navigation', { name: 'Пагинация доменов снизу', exact: true })
  const sizes = page.getByRole('combobox', { name: 'На странице:', exact: true })
  await expect(page.getByText('Показано 1 - 20 из 121 результатов')).toHaveCount(2)
  expect(
    api.requests.filter(
      /** Counts list requests, excluding independent statistics. */ (request) => /^GET \/api\/domains\?/.test(request),
    ),
  ).toHaveLength(1)
  await sizes.first().selectOption('10')
  await expect(page.getByText('Показано 1 - 10 из 121 результатов')).toHaveCount(2)
  await expect(sizes.last()).toHaveValue('10')
  expect(
    api.requests.filter(
      /** Counts requests after the top size change. */ (request) => /^GET \/api\/domains\?/.test(request),
    ),
  ).toHaveLength(2)
  await expect(top.getByText('...', { exact: true })).toHaveCount(1)
  await expect(top.getByRole('button', { name: 'Последняя страница: 13', exact: true })).toHaveCount(1)
  await top.getByRole('button', { name: 'Последняя страница: 13', exact: true }).click()
  await expect(page.getByText('Показано 121 - 121 из 121 результатов')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Открыть карточку: pager-120.test', exact: true })).toBeVisible()
  await expect(bottom.getByRole('button', { name: '13', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(bottom.getByText('...', { exact: true })).toHaveCount(0)
  expect(
    api.requests.filter(
      /** One shortcut click starts one request despite two panels. */ (request) =>
        /^GET \/api\/domains\?/.test(request),
    ),
  ).toHaveLength(3)
  await bottom.getByRole('button', { name: '9', exact: true }).click()
  await expect(page.getByText('Показано 81 - 90 из 121 результатов')).toHaveCount(2)
  await bottom.getByRole('button', { name: 'Последняя страница: 13', exact: true }).click()
  await expect(page.getByText('Показано 121 - 121 из 121 результатов')).toHaveCount(2)
  expect(
    api.requests.filter(
      /** Bottom controls use the same single-request path. */ (request) => /^GET \/api\/domains\?/.test(request),
    ),
  ).toHaveLength(5)
  await sizes.last().selectOption('50')
  await expect(page.getByText('Показано 1 - 50 из 121 результатов')).toHaveCount(2)
  await expect(sizes.first()).toHaveValue('50')
  await expect(top.getByRole('button', { name: '3', exact: true })).toHaveCount(1)
  await expect(top.getByText('...', { exact: true })).toHaveCount(0)
  await page.getByPlaceholder('Поиск по домену...').fill('pager-120')
  await expect(page.getByText('Показано 1 - 1 из 1 результатов')).toHaveCount(2)
  await expect(top.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(bottom.getByRole('button', { name: '3', exact: true })).toHaveCount(0)
})

/**
 * Deletes the only row on page two and checks that the active list filter still exposes every remaining row.
 * page drives the browser, api holds saved rows and records deletion, and baseURL keeps the stats override local.
 */
test('returns to the first filtered domain page after deletion while statistics lag', async ({
  page,
  api,
  baseURL,
}) => {
  // listedDomains keeps the original rows for assertions after the API fixture replaces its saved collection.
  // The factory uses index for a distinct saved ID and domain name. The _ argument is unused.
  const listedDomains = Array.from({ length: 21 }, (_, index) =>
    makeDomain(index + 1, `listed-${index + 1}.example.test`),
  )
  api.domains = listedDomains
  await page.clock.install()

  /**
   * The predicate checks url against this preview's statistics endpoint. The handler fulfills route with a fixed
   * pre-delete snapshot for GET requests and sends other methods through the shared network guard.
   */
  await page.route(
    (url) => url.origin === baseURL && url.pathname === '/api/stats',
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback()
        return
      }
      await route.fulfill({
        json: {
          generated_at: '2023-11-14 22:20:00',
          dns: { total: 1, classic: 1, doh: 0 },
          domains: {
            total: 21,
            resolved: 21,
            unresolved: 0,
            unprocessed: 0,
            lists_total: 1,
            per_list: [{ list_id: 7, list_name: 'Example list', total: 21, resolved: 21, unresolved: 0, attempts: 0 }],
          },
          ips: { total: 0, v4_total: 0, v6_total: 0, linked_to_domain: 0, standalone: 0, lists_total: 0, per_list: [] },
          ros: { total: 0 },
        },
      })
    },
  )

  await page.goto('/#/domains')
  // listFilter selects list members. pagination identifies the upper controls used to open page two.
  const listFilter = page.getByRole('button', { name: 'Со списком', exact: true })
  const pagination = page.getByRole('navigation', { name: 'Пагинация доменов сверху', exact: true })
  await expect(page.getByText('Показано 1 - 20 из 21 результатов', { exact: true })).toHaveCount(2)
  await listFilter.click()
  await expect(listFilter).toHaveAttribute('aria-pressed', 'true')
  await pagination.getByRole('button', { name: '2', exact: true }).click()
  await expect(page.getByText('Показано 21 - 21 из 21 результатов', { exact: true })).toHaveCount(2)

  // table scopes row assertions to saved domains. lastOpener identifies the page-two row from within each candidate row.
  const table = page.getByRole('table')
  const lastOpener = page.getByRole('button', { name: 'Открыть карточку: listed-21.example.test', exact: true })
  await expect(table.getByRole('button', { name: /^Открыть карточку: / })).toHaveCount(1)
  await table
    .getByRole('row')
    .filter({ has: lastOpener })
    .getByRole('button', { name: 'Удалить домен', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Удалить Домен', exact: true })
    .getByRole('button', { name: 'Удалить', exact: true })
    .click()
  await expect(table.getByText('Изменения сохранены. Обновляем список…', { exact: true })).toBeVisible()
  await page.clock.fastForward(7_200)

  await expect(page.getByText('Показано 1 - 20 из 20 результатов', { exact: true })).toHaveCount(2)
  await expect(pagination.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(pagination.getByRole('button', { name: '2', exact: true })).toHaveCount(0)
  await expect(listFilter).toHaveAttribute('aria-pressed', 'true')
  await expect(lastOpener).toHaveCount(0)
  await expect(table.getByRole('button', { name: /^Открыть карточку: / })).toHaveCount(20)
  // domain is each original member of the first page, which must remain individually reachable.
  for (const domain of listedDomains.slice(0, 20)) {
    await expect(table.getByRole('button', { name: `Открыть карточку: ${domain.name}`, exact: true })).toBeVisible()
  }
  expect(api.mutations).toEqual([{ method: 'DELETE', path: '/domains/21', body: null }])
})

// width is each responsive boundary; theme is initialized before application startup.
for (const width of [375, 768, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    /** Cards, filters and both pagination panels remain usable in each required layout. */
    test(`keeps domain statistics and both ${theme} pagers contained at ${width}px`, async ({ page, api }) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      /** Gives each index a stable independent row. */
      api.domains = Array.from({ length: 121 }, (_, index) => makeDomain(index + 1000, `layout-${index}.test`))
      await page.goto('/#/domains')
      await expect(page.getByRole('button', { name: 'Открыть карточку: layout-0.test', exact: true })).toBeVisible()
      // label identifies a public statistic caption; card selects its containing rendered value block.
      for (const label of ['Всего доменов', 'Определено', 'Не определено', 'Не обработано']) {
        const card = page.getByText(label, { exact: true }).and(page.locator('div')).locator('..')
        await expect(card).toBeVisible()
        await expectContained(card, width)
      }
      await expectContained(page.getByRole('button', { name: 'Не обработано', exact: true }), width)
      // panel is each public navigation landmark, which must fit in compact mobile mode too.
      for (const panel of [
        page.getByRole('navigation', { name: 'Пагинация доменов сверху', exact: true }),
        page.getByRole('navigation', { name: 'Пагинация доменов снизу', exact: true }),
      ]) {
        await expect(panel).toBeVisible()
        await expectContained(panel, width)
      }
      // selector is each independently labelled size control; mobile keeps both usable.
      for (const selector of await page.getByRole('combobox', { name: 'На странице:', exact: true }).all()) {
        await expect(selector).toBeVisible()
        await expectContained(selector, width)
      }
      if (width === 375) {
        // top/bottom are the compact landmarks; navigationBounds/selectorBounds verify the agreed two-row layout.
        const top = page.getByRole('navigation', { name: 'Пагинация доменов сверху', exact: true })
        const bottom = page.getByRole('navigation', { name: 'Пагинация доменов снизу', exact: true })
        const navigationBounds = await top.boundingBox()
        const selectorBounds = await page
          .getByRole('combobox', { name: 'На странице:', exact: true })
          .first()
          .boundingBox()
        if (!navigationBounds || !selectorBounds) throw new Error('Missing compact pagination geometry')
        expect(selectorBounds.y).toBeGreaterThanOrEqual(navigationBounds.y + navigationBounds.height)
        await top.getByRole('button', { name: 'Последняя страница: 7', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Открыть карточку: layout-120.test', exact: true })).toBeVisible()
        await expect(bottom.locator('[aria-current="page"]')).toHaveText('7')
        await expect(bottom.getByRole('button', { name: 'Вперёд', exact: true })).toBeDisabled()
        await bottom.getByRole('button', { name: 'Назад', exact: true }).click()
        await expect(top.locator('[aria-current="page"]')).toHaveText('6')
        await expect(page.getByRole('button', { name: 'Открыть карточку: layout-100.test', exact: true })).toBeVisible()
      }
      expect(api.mutations).toEqual([])
    })
  }
}
