import { test, expect } from './fixtures'

// width covers the project's mobile, tablet and desktop card boundaries.
for (const width of [375, 768, 1440]) {
  // theme controls the system preference before a fresh context's application initialization.
  for (const theme of ['light', 'dark'] as const) {
    /** Card content must remain readable and horizontally contained at each required width and theme. */
    test(`keeps the ${theme} domain card usable at ${width}px`, async ({ page, api }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto('/#/domains')
      await page.getByRole('button', { name: 'Открыть карточку: dated.example.test', exact: true }).click()
      // card identifies the visible saved-domain dialog; heading identifies its public title.
      const card = page.getByRole('dialog', { name: 'Домен: dated.example.test', exact: true })
      const heading = card.getByRole('heading', { name: 'Домен: dated.example.test', exact: true })
      await expect(heading).toBeVisible()
      await expect(card.getByText('Последняя попытка', { exact: true }).locator('..')).toContainText(
        '2023-11-14 22:16:40',
      )
      await expect(card.getByText('Последнее определение', { exact: true }).locator('..')).toContainText(
        '2023-11-14 22:15:00',
      )
      // bounds is the rendered title rectangle; it must stay within the viewport rather than being clipped.
      const bounds = await heading.boundingBox()
      expect(bounds).not.toBeNull()
      if (!bounds) throw new Error('Visible card heading has no geometry')
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      /** The DOM callback measures the actual dialog panel's horizontal content extent. */
      expect(
        await heading.evaluate((element) => {
          // panel is the title's grandparent in the shared modal's rendered public DOM structure.
          const panel = element.parentElement?.parentElement
          if (!panel) throw new Error('Missing dialog panel')
          return panel.scrollWidth <= panel.clientWidth
        }),
      ).toBe(true)
      await card.getByRole('button', { name: 'Закрыть', exact: true }).click()
      await expect(card).toHaveCount(0)
      expect(api.mutations).toEqual([])
    })
  }
}

/** Escape must dismiss a real Headless UI dialog and return focus to its keyboard-reachable opener. */
test('closes a modal with Escape and restores focus to its opener', async ({ page, api }) => {
  await page.goto('/#/domains')
  await expect(page.getByRole('button', { name: 'Открыть карточку: dated.example.test', exact: true })).toBeVisible()
  // opener is the normal create action; dialog is its keyboard-managed modal.
  const opener = page.getByRole('button', { name: 'Добавить Домен', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Добавить Домен', exact: true })
  await opener.focus()
  await opener.press('Enter')
  await expect(dialog.getByRole('heading', { name: 'Добавить Домен', exact: true })).toBeVisible()
  /** The poll callback's DOM predicate checks whether element, the dialog root, contains keyboard focus. */
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await expect(opener).toBeFocused()
  expect(api.mutations).toEqual([])
})

/** At mobile width, keyboard access enters the labelled drawer and Escape returns focus to its trigger. */
test('opens and dismisses the mobile navigation by keyboard', async ({ page, api }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/domains')
  await expect(page.getByRole('heading', { level: 1, name: 'Домены', exact: true })).toBeVisible()
  // menuButton opens the mobile navigation. drawer is the modal that owns focus while open.
  const menuButton = page.getByRole('button', { name: 'Открыть меню', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true })
  await menuButton.focus()
  await menuButton.press('Enter')
  await expect(drawer.getByRole('button', { name: 'Закрыть меню', exact: true })).toBeVisible()
  /** The browser callback checks that the rendered mobile dialog contains the active element. */
  await expect.poll(() => drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(menuButton).toBeFocused()

  await menuButton.press('Space')
  await drawer
    .getByRole('navigation', { name: 'Основная навигация', exact: true })
    .getByRole('link', { name: 'DNS Серверы', exact: true })
    .press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'DNS Серверы', exact: true })).toBeVisible()
  await expect(drawer).toHaveCount(0)
  expect(api.mutations).toEqual([])
})

/** Crossing to desktop dismisses mobile navigation so the drawer cannot trap keyboard focus on return. */
test('keeps the mobile drawer closed after resizing across the desktop breakpoint', async ({ page, api }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/domains')
  // menuButton exposes the drawer state. drawer is the mobile dialog; desktopNavigation replaces it at 1440 px.
  const menuButton = page.getByRole('button', { name: 'Открыть меню', exact: true })
  const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true })
  const desktopNavigation = page.getByRole('navigation', { name: 'Основная навигация', exact: true })
  await menuButton.press('Enter')
  await expect(drawer.getByRole('button', { name: 'Закрыть меню', exact: true })).toBeVisible()

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(desktopNavigation.getByRole('link', { name: 'Домены', exact: true })).toBeVisible()

  await page.setViewportSize({ width: 375, height: 900 })
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(drawer).toHaveCount(0)
  // cardOpener exercises focus and activation on the page that was inert while the drawer was open.
  const cardOpener = page.getByRole('button', { name: 'Открыть карточку: dated.example.test', exact: true })
  await cardOpener.focus()
  await expect(cardOpener).toBeFocused()
  await page.keyboard.press('Enter')
  // card scopes the visible heading to the dialog, whose fixed panel leaves the root without a visible box.
  const card = page.getByRole('dialog', { name: 'Домен: dated.example.test', exact: true })
  await expect(card.getByRole('heading', { name: 'Домен: dated.example.test', exact: true })).toBeVisible()
  expect(api.mutations).toEqual([])
})

/** Theme persistence is observed through rendered text color after reload and a return to the original theme. */
test('persists the selected theme across a full reload', async ({ page, api }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/#/domains')
  // heading is the same public element before/after reload; initialColor's DOM callback reads its rendered color.
  const heading = page.getByRole('heading', { level: 1, name: 'Домены', exact: true })
  await expect(heading).toBeVisible()
  const initialColor = await heading.evaluate((element) => getComputedStyle(element).color)
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click()
  /** The poll callback and its DOM callback sample heading's rendered color until the new theme is applied. */
  await expect.poll(() => heading.evaluate((element) => getComputedStyle(element).color)).not.toBe(initialColor)
  // darkColor's DOM callback reads the applied rendering that must survive a new document and initialization.
  const darkColor = await heading.evaluate((element) => getComputedStyle(element).color)
  await page.reload()
  await expect(heading).toBeVisible()
  await expect(heading).toHaveCSS('color', darkColor)
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click()
  await expect(heading).toHaveCSS('color', initialColor)
  expect(api.mutations).toEqual([])
})

/** A failed storage write must retain the applied theme and report why the setting did not change. */
test('preserves the old theme and notifies when browser settings cannot be saved', async ({ page, api }) => {
  api.expectedConsoleErrors.push(/^Failed to save dark mode preference:/)
  /** This initialization callback fails only theme writes, leaving unrelated browser storage behavior intact. */
  await page.addInitScript(() => {
    // originalSetItem retains the native implementation for all unrelated storage keys.
    const originalSetItem = Storage.prototype.setItem
    /** Rejects the theme preference with a browser-like quota failure; other writes delegate normally. */
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key === 'darkMode') throw new DOMException('Synthetic quota failure', 'QuotaExceededError')
      originalSetItem.call(this, key, value)
    }
  })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/#/domains')
  // heading is the visible preference; previousColor's DOM callback reads its rendering before the rejected write.
  const heading = page.getByRole('heading', { level: 1, name: 'Домены', exact: true })
  await expect(heading).toBeVisible()
  const previousColor = await heading.evaluate((element) => getComputedStyle(element).color)
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Не удалось сохранить тему. Предыдущее значение сохранено.' }),
  ).toBeVisible()
  await expect(heading).toHaveCSS('color', previousColor)
  await page.reload()
  await expect(heading).toHaveCSS('color', previousColor)
})
