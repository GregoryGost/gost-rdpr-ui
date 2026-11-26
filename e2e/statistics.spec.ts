import type { Locator, Page } from '@playwright/test'
import { expect, test, type BrowserApi } from './fixtures'

/** Backend path without the preview prefix, shared by the request and hold assertions. */
const metricsPath = '/metrics'

/** Captured request identifier for scrapes only, excluding overview and growth traffic. */
const metricsRequest = 'GET /api/metrics'

/**
 * Creates a scrape with a distinct latest-run marker and an independent success counter. Each histogramStep adds
 * one 125 ms DNS observation, two 250 ms DoH observations, and four 62.5 ms writer queue observations.
 */
function activityBody(marker: number, successes: number, histogramStep = 0): string {
  return [
    '# TYPE resolution_run_snapshot gauge',
    `resolution_run_snapshot{mode="new",field="selected"} ${marker}`,
    'resolution_run_snapshot{mode="new",field="attempted"} 47',
    'resolution_run_snapshot{mode="new",field="confirmed"} 31',
    'resolution_run_snapshot{mode="new",field="pending"} 16',
    'resolution_run_snapshot{mode="stale",field="selected"} 74',
    'resolution_run_snapshot{mode="stored",field="pending"} 13',
    `resolution_run_events_total{mode="new",event="success"} ${successes}`,
    `resolution_run_events_total{mode="stale",event="partial"} ${8 + histogramStep}`,
    `resolution_run_events_total{mode="stored",event="failure"} ${5 + histogramStep * 2}`,
    `resolution_dns_duration_seconds_sum{server_id="1",transport="classic",record_type="A",outcome="ok",reason=""} ${2 + histogramStep * 0.125}`,
    `resolution_dns_duration_seconds_count{server_id="1",transport="classic",record_type="A",outcome="ok",reason=""} ${20 + histogramStep}`,
    `resolution_dns_duration_seconds_sum{server_id="2",transport="doh",record_type="AAAA",outcome="ok",reason=""} ${5 + histogramStep * 0.5}`,
    `resolution_dns_duration_seconds_count{server_id="2",transport="doh",record_type="AAAA",outcome="ok",reason=""} ${30 + histogramStep * 2}`,
    `resolution_queue_duration_seconds_sum{queue="writer",phase="residence",outcome="dequeued"} ${6 + histogramStep * 0.25}`,
    `resolution_queue_duration_seconds_count{queue="writer",phase="residence",outcome="dequeued"} ${40 + histogramStep * 4}`,
    '# EOF',
    '',
  ].join('\n')
}

/** Loads a separate route with timers running, then freezes page time before the Statistics timer is created. */
async function openWithPausedClock(page: Page): Promise<void> {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.goto('/#/dns')
  await expect(page.getByRole('heading', { name: 'DNS Серверы', exact: true })).toBeVisible()
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
}

/** Counts exact requests on this test's isolated API; each predicate match represents one metrics scrape. */
function scrapeCount(api: BrowserApi): number {
  return api.requests.filter((request) => request === metricsRequest).length
}

/** Locates the latest runs article so gauge numbers cannot match the growth chart's axis labels. */
function latestRuns(page: Page): Locator {
  return page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Последние проходы', exact: true }) })
}

/** Waits until marker from a specific response appears in the latest runs card. */
async function expectRunMarker(page: Page, marker: number): Promise<void> {
  await expect(latestRuns(page).getByText(String(marker), { exact: true })).toBeVisible()
}

/** Checks visible chart legend content, locating the article by its heading so values from other charts cannot match. */
async function expectReading(page: Page, chartName: string, reading: RegExp): Promise<void> {
  await expect(
    page.getByRole('article').filter({ has: page.getByRole('heading', { name: chartName, exact: true }) }),
  ).toContainText(reading)
}

/** Locates the solid success series in the accessible chart. The grid has no explicit stroke width. */
function successPlot(page: Page): Locator {
  return page
    .getByRole('img', { name: 'Результаты резолвинга', exact: true })
    .locator('path[stroke-width]:not([stroke-dasharray])')
}

/** Checks the path geometry for the expected sequence of SVG moves and line segments. */
async function expectPlotCommands(path: Locator, commands: string): Promise<void> {
  /** The polling callback reads the plotted commands without depending on pixel coordinates or dot styling. */
  await expect.poll(async () => (await path.getAttribute('d'))?.match(/[ML]/g)?.join('')).toBe(commands)
}

/** Default cadence and actual text decoding connect a single scrape to all four activity cards. */
test('starts one immediate scrape and plots the next scrape at the default three seconds', async ({ page, api }) => {
  api.metricsBody = activityBody(101, 40)
  await openWithPausedClock(page)
  await page.goto('/#/stats')

  await expect(page.getByRole('heading', { name: 'Активность сервиса', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Последние проходы', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Интервал опроса', exact: true })).toHaveValue('3000')
  await expectRunMarker(page, 101)
  // runCard scopes the mode labels and gauges to the latest runs display.
  const runCard = latestRuns(page)
  await expect(runCard.getByText('Новые', { exact: true })).toBeVisible()
  await expect(runCard.getByText('Устаревшие', { exact: true })).toBeVisible()
  await expect(runCard.getByText('Сохранённые', { exact: true })).toBeVisible()
  await expect(runCard.getByText('47', { exact: true })).toBeVisible()
  await expect(runCard.getByText('31', { exact: true })).toBeVisible()
  await expect(runCard.getByText('16', { exact: true })).toBeVisible()
  await expect(runCard.getByText('74', { exact: true })).toBeVisible()
  await expect(runCard.getByText('13', { exact: true })).toBeVisible()
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*—/)
  expect(scrapeCount(api)).toBe(1)

  api.metricsBody = activityBody(102, 43, 1)
  await page.clock.runFor(2_999)
  expect(scrapeCount(api)).toBe(1)
  await page.clock.runFor(1)
  await expectRunMarker(page, 102)
  expect(scrapeCount(api)).toBe(2)

  await expectReading(page, 'Результаты резолвинга', /Успешно\s*60(?![\d,.])/)
  await expectReading(page, 'Результаты резолвинга', /Частично\s*20(?![\d,.])/)
  await expectReading(page, 'Результаты резолвинга', /Ошибки\s*40(?![\d,.])/)
  await expectReading(page, 'Задержка DNS и DoH', /DNS\s*125(?![\d,.])/)
  await expectReading(page, 'Задержка DNS и DoH', /DoH\s*250(?![\d,.])/)
  await expectReading(page, 'Ожидание в очереди SQLite', /Среднее\s*62[,.]5(?![\d,.])/)

  api.metricsBody = activityBody(103, 44, 1)
  await page.clock.runFor(3_000)
  await expectRunMarker(page, 103)
  await expectReading(page, 'Задержка DNS и DoH', /DoH\s*—/)
  await expectReading(page, 'Ожидание в очереди SQLite', /Среднее\s*—/)
})

/**
 * Checks the busy-request guard and the new gap threshold using held responses.
 * The page displays two disconnected runs of numeric samples when the excessive delay splits the series.
 */
test('skips busy ticks and applies the selected interval to the long-gap threshold', async ({ page, api }) => {
  api.metricsBody = activityBody(201, 50)
  api.holdPaths.add(metricsPath)
  await openWithPausedClock(page)
  await page.goto('/#/stats')
  /** The poll callback waits for the immediate request to enter the fixture before advancing through busy ticks. */
  await expect.poll(() => api.heldPaths.get(metricsPath)?.length).toBe(1)

  await page.clock.runFor(6_000)
  expect(scrapeCount(api)).toBe(1)
  await api.releasePath(metricsPath)
  await expectRunMarker(page, 201)

  api.holdPaths.add(metricsPath)
  api.metricsBody = activityBody(202, 56, 1)
  await page.clock.runFor(3_000)
  /** The second request is held until exactly twice the original interval has elapsed since the baseline. */
  await expect.poll(() => api.heldPaths.get(metricsPath)?.length).toBe(1)
  await page.clock.runFor(3_000)
  expect(scrapeCount(api)).toBe(2)
  await api.releasePath(metricsPath)
  await expectRunMarker(page, 202)
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*60(?![\d,.])/)

  await page.getByRole('combobox', { name: 'Интервал опроса', exact: true }).selectOption('2000')
  api.metricsBody = activityBody(203, 59, 1)
  await page.clock.runFor(1_999)
  expect(scrapeCount(api)).toBe(2)
  await page.clock.runFor(1)
  await expectRunMarker(page, 203)

  // plot tracks the success line, which already joins two numeric observations before the delayed scrape.
  const plot = successPlot(page)
  await expectPlotCommands(plot, 'ML')

  api.holdPaths.add(metricsPath)
  api.metricsBody = activityBody(204, 456, 2)
  await page.clock.runFor(2_000)
  /** The callback waits for the request at the new interval. The response completes five seconds after the baseline. */
  await expect.poll(() => api.heldPaths.get(metricsPath)?.length).toBe(1)
  await page.clock.runFor(3_000)
  expect(scrapeCount(api)).toBe(4)
  await api.releasePath(metricsPath)
  await expectRunMarker(page, 204)
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*—/)
  await expectPlotCommands(plot, 'ML')

  api.metricsBody = activityBody(205, 457, 3)
  await page.clock.runFor(1_000)
  await expectRunMarker(page, 205)
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*60(?![\d,.])/)

  api.metricsBody = activityBody(206, 458, 4)
  await page.clock.runFor(2_000)
  await expectRunMarker(page, 206)
  // A second move breaks the line across the gap. Each side still has a line connecting its two observations.
  await expectPlotCommands(plot, 'MLML')
})

/**
 * Seven minutes of observations leave one numeric point outside the five-minute window.
 * Widening the window restores that point without an additional scrape.
 */
test('switches chart periods using the existing samples without restarting the poll', async ({ page, api }) => {
  api.metricsBody = activityBody(300, 50)
  await openWithPausedClock(page)
  await page.goto('/#/stats')
  await expectRunMarker(page, 300)

  // period selects the common visible chart range. coverage reports the start of an incomplete range.
  const period = page.getByRole('combobox', { name: 'Период графиков', exact: true })
  const coverage = page.getByText(/^Наблюдения с/)
  // axis shows the resolution chart's time bounds. plot holds the visible line for the success series.
  const axis = page.getByRole('article', { name: 'Результаты резолвинга' }).locator('time')
  const plot = successPlot(page)
  await expect(period).toHaveValue('60')
  await expect(coverage).toBeVisible()
  await page.getByRole('combobox', { name: 'Интервал опроса', exact: true }).selectOption('60000')

  // elapsedMinutes is the number of minute-long polling ticks that have completed since the first sample.
  for (let elapsedMinutes = 1; elapsedMinutes <= 7; elapsedMinutes += 1) {
    api.metricsBody = activityBody(300 + elapsedMinutes, 50 + elapsedMinutes)
    await page.clock.runFor(60_000)
    await expectRunMarker(page, 300 + elapsedMinutes)
  }

  await expectReading(page, 'Результаты резолвинга', /Успешно\s*1(?![\d,.])/)
  await expectPlotCommands(plot, 'MLLLLLL')
  await period.selectOption('5')
  await expect(coverage).toBeHidden()
  await expect(axis.first()).toHaveAttribute('datetime', '2026-01-01T01:02:00.000Z')
  await expect(axis.last()).toHaveAttribute('datetime', '2026-01-01T01:07:00.000Z')
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*1(?![\d,.])/)
  // The point at 01:01 is outside the window. Six points remain, including both endpoints.
  await expectPlotCommands(plot, 'MLLLLL')
  await period.selectOption('15')
  await expect(coverage).toBeVisible()
  await expect(axis.first()).toHaveAttribute('datetime', '2026-01-01T00:52:00.000Z')
  await expectPlotCommands(plot, 'MLLLLLL')
  await period.selectOption('60')
  await expect(coverage).toBeVisible()
  await expect(axis.first()).toHaveAttribute('datetime', '2026-01-01T00:07:00.000Z')
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*1(?![\d,.])/)
  await expectPlotCommands(plot, 'MLLLLLL')
  expect(scrapeCount(api)).toBe(8)
})

/** A failed metrics request leaves both existing statistics sections usable and breaks only activity observations. */
test('isolates a network failure and starts with a fresh baseline after recovery and route re-entry', async ({
  page,
  api,
}) => {
  api.metricsBody = activityBody(401, 50)
  api.expectedConsoleErrors.push(/^Failed to load resource: net::ERR_FAILED$/)
  await openWithPausedClock(page)
  await page.goto('/#/stats')
  await expectRunMarker(page, 401)

  api.metricsBody = activityBody(402, 52)
  await page.clock.runFor(3_000)
  await expectRunMarker(page, 402)
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*40(?![\d,.])/)

  api.failNextMetricsRequest = true
  await page.clock.runFor(3_000)
  // outage denotes the activity-only warning that disappears when a valid scrape is processed.
  const outage = page.getByText('Метрики недоступны. Опрос продолжится.', { exact: true })
  await expect(outage).toBeVisible()
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*—/)
  await expect(page.getByRole('heading', { name: 'Обзор данных', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Разбивка по спискам', exact: true })).toBeVisible()
  await expect(page.getByText('Example list', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Динамика роста', exact: true })).toBeVisible()
  await expect(page.getByText('Всего за период: 17', { exact: true })).toBeVisible()
  // growthDates selects the start and end inputs of the existing growth form, in their on-screen order.
  const growthDates = page.locator('input[type="datetime-local"]')
  await growthDates.nth(0).fill('2026-01-01T00:15')
  await growthDates.nth(1).fill('2026-01-01T00:30')
  await page.getByRole('button', { name: 'Применить', exact: true }).click()
  /** Every invocation checks for the growth request with both edited dates serialized for the backend. */
  await expect
    .poll(() =>
      api.requests.includes(
        'GET /api/stats/growth?entity=domains&granularity=hour&start_date=2026-01-01+00%3A15%3A00&end_date=2026-01-01+00%3A30%3A00&date_filter_field=created_at',
      ),
    )
    .toBe(true)
  await expect(outage).toBeVisible()

  api.metricsBody = activityBody(404, 900)
  await page.clock.runFor(3_000)
  await expectRunMarker(page, 404)
  await expect(outage).toBeHidden()
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*—/)

  api.metricsBody = activityBody(405, 903)
  await page.clock.runFor(3_000)
  await expectRunMarker(page, 405)
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*60(?![\d,.])/)

  await page.getByRole('link', { name: 'DNS Серверы', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'DNS Серверы', exact: true })).toBeVisible()
  await page.clock.runFor(9_000)
  expect(scrapeCount(api)).toBe(5)

  api.metricsBody = activityBody(406, 906)
  await page.getByRole('link', { name: 'Статистика', exact: true }).click()
  await expectRunMarker(page, 406)
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*—/)
  expect(scrapeCount(api)).toBe(6)

  api.metricsBody = activityBody(407, 907)
  await page.clock.runFor(3_000)
  await expectRunMarker(page, 407)
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*20(?![\d,.])/)

  api.metricsBody = activityBody(408, 908)
  await page.reload()
  await expectRunMarker(page, 408)
  await expectReading(page, 'Результаты резолвинга', /Успешно\s*—/)
  expect(scrapeCount(api)).toBe(8)
})
