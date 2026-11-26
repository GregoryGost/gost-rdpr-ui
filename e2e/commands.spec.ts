import type { Page } from '@playwright/test'
import { expect, test, type BrowserApi } from './fixtures'

/** The public browser and API contract exercised for each of the two commands. */
interface BackgroundCommand {
  /** Command name used in the scenario title to show the order of submission. */
  name: string
  /** Accessible name of the button that opens the confirmation. */
  buttonName: string
  /** API path without the preview prefix or query, used to hold the HTTP response. */
  path: string
  /** Exact URL query expected from the default form selection. */
  query: string
  /** Text shown on the page and in the toast when the API accepts the request. */
  acceptedMessage: string
  /** API result shared by active and queued repeats of this command. */
  duplicateResult: string
}

/** STALE resolves outdated domains using a bodyless POST. */
const stale: BackgroundCommand = {
  name: 'STALE',
  buttonName: 'Определить устаревшие домены',
  path: '/commands/domains/resolve/stale',
  query: '',
  acceptedMessage: 'Команда определения устаревших доменов принята в обработку. Определение выполняется в фоне.',
  duplicateResult: 'Job [domains_resolve] is now active',
}

/** RouterOS uses IPv4 by default, which must remain part of the bodyless POST URL. */
const routerOs: BackgroundCommand = {
  name: 'RouterOS',
  buttonName: 'Отправить команду обновления RouterOS',
  path: '/commands/ros/update',
  query: '?type=4',
  acceptedMessage: 'Команда обновления RouterOS принята в обработку. Обновление выполняется в фоне.',
  duplicateResult: 'Job [ros_update] is now active',
}

/** Duplicate requests use the same message whether the job has started or is waiting. */
const duplicateMessage = 'Команда уже выполняется или ожидает запуска'

/**
 * Submits command through page using the per-test api. The supplied result controls the held HTTP 200 reply,
 * and message is the expected visible outcome. Dismissing the toast makes the next repeat prove a new notification.
 */
async function submitCommand(
  page: Page,
  api: BrowserApi,
  command: BackgroundCommand,
  result: string,
  message: string,
): Promise<void> {
  api.nextCommandResults.set(`${command.path}${command.query}`, result)
  api.holdPaths.add(command.path)

  // trigger opens this command's confirmation and must become available when the HTTP request settles.
  const trigger = page.getByRole('button', { name: command.buttonName, exact: true })
  await trigger.click()
  // dialog scopes the two controls to the currently open confirmation.
  const dialog = page.getByRole('dialog')
  // confirm sends the command and becomes disabled while the fixture withholds the response.
  const confirm = dialog.getByRole('button', { name: 'Выполнить', exact: true })
  await confirm.click()
  /** The poll callback waits for the browser's POST to reach the fixture before checking the pending UI. */
  await expect.poll(() => api.heldPaths.get(command.path)?.length).toBe(1)
  await expect(confirm).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled()
  await expect(page.getByText(message, { exact: true })).toHaveCount(0)

  await api.releasePath(command.path)
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeEnabled()
  await expect(page.getByRole('main').getByText(message, { exact: true })).toBeVisible()

  // toast selects the exact outcome in the alert independently of the inline message in main.
  const toast = page.getByRole('alert').filter({ has: page.getByText(message, { exact: true }) })
  await expect(toast).toBeVisible()
  await expect(
    page.getByText(/Команда выполнена|Устаревшие домены успешно определены|RouterOS успешно обновлен/),
  ).toHaveCount(0)
  if (result === command.duplicateResult) {
    await expect(page.getByText('Команда принята', { exact: true })).toHaveCount(0)
    await expect(page.getByText(command.acceptedMessage, { exact: true })).toHaveCount(0)
  }
  await toast.getByRole('button', { name: 'Закрыть уведомление', exact: true }).click()
  await expect(toast).toHaveCount(0)
}

// active is submitted first and stays unfinished in the scenario. queued is accepted while active is still running.
for (const [active, queued] of [
  [stale, routerOs],
  [routerOs, stale],
] as const) {
  /** The callback uses a fresh page and api fixture to check acceptance and both repeats for this submission order. */
  test(`reports acceptance and active and queued repeats for ${active.name} → ${queued.name}`, async ({
    page,
    api,
  }) => {
    await page.goto('/#/commands')
    await expect(page.getByRole('heading', { name: 'Команды', exact: true })).toBeVisible()
    await expect(page.getByText(/STALE.*RouterOS.*по очереди в фоне.*может ждать завершения другой/)).toBeVisible()

    await submitCommand(page, api, active, 'OK', active.acceptedMessage)
    await submitCommand(page, api, queued, 'OK', queued.acceptedMessage)
    await submitCommand(page, api, active, active.duplicateResult, duplicateMessage)
    await submitCommand(page, api, queued, queued.duplicateResult, duplicateMessage)

    /** The filter collects all command endpoint requests, including an unexpected method or extra call. */
    expect(api.requests.filter((request) => request.includes(' /api/commands/'))).toEqual([
      `POST /api${active.path}${active.query}`,
      `POST /api${queued.path}${queued.query}`,
      `POST /api${active.path}${active.query}`,
      `POST /api${queued.path}${queued.query}`,
    ])
  })
}
