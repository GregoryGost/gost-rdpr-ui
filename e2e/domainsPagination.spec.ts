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
  await expect(page.getByRole('cell', { name: 'pager-120.test', exact: true })).toBeVisible()
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
      await expect(page.getByRole('cell', { name: 'layout-0.test', exact: true })).toBeVisible()
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
        await expect(page.getByRole('cell', { name: 'layout-120.test', exact: true })).toBeVisible()
        await expect(bottom.locator('[aria-current="page"]')).toHaveText('7')
        await expect(bottom.getByRole('button', { name: 'Вперёд', exact: true })).toBeDisabled()
        await bottom.getByRole('button', { name: 'Назад', exact: true }).click()
        await expect(top.locator('[aria-current="page"]')).toHaveText('6')
        await expect(page.getByRole('cell', { name: 'layout-100.test', exact: true })).toBeVisible()
      }
      expect(api.mutations).toEqual([])
    })
  }
}
