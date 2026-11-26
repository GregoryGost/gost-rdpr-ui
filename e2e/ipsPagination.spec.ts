import { expect, test } from './fixtures'

// source selects the server-paged list, text search, or the IPv4 button filter.
for (const source of ['list', 'search', 'ipv4'] as const) {
  // isFiltered selects the successful refresh scenario with lagging statistics.
  const isFiltered = source === 'ipv4'
  // title distinguishes recovery from a failed refresh and recovery from a stale count.
  const title = isFiltered
    ? 'returns to the first IPv4 page after deleting the last-page address while statistics lag'
    : `returns to the first IP ${source} page after a failed refresh following deletion`

  /**
   * Deletes the only matching address on page two and checks that the remaining rows are reachable.
   * page drives the user flow, api guards the isolated network and console, and baseURL scopes the route overrides.
   */
  test(title, async ({ page, api, baseURL }) => {
    // addresses holds the saved records. The 21st IPv4 record is alone on page two of the matching results.
    // The factory gives each row an ID and a distinct documentation address based on index. The _ argument is unused.
    const addresses = Array.from({ length: 21 }, (_, index) => ({
      id: index + 1,
      addr: `192.0.2.${index + 1}`,
      type: 4,
      created_at: 1700000000,
      created_at_hum: '2023-11-14 22:13:20',
    }))
    if (isFiltered) {
      addresses.push({
        id: 22,
        addr: '2001:db8::22',
        type: 6,
        created_at: 1700000000,
        created_at_hum: '2023-11-14 22:13:20',
      })
    }

    // deleteCount tracks confirmed deletions. The list and search cases use it to arm the one-time refresh error.
    // refreshOffsets records post-delete reads so each case can verify its table refresh.
    let deleteCount = 0
    const refreshOffsets: number[] = []

    if (!isFiltered) {
      api.expectedConsoleErrors.push(/Failed to load resource: the server responded with a status of 500/)
      api.expectedConsoleErrors.push(/^\{type: api, severity: error, message: Контролируемая ошибка загрузки IP,/)
    }
    await page.clock.install()

    /** The predicate matches url only for this preview's IP endpoints and statistics. The handler serves the test's
     * saved state over route and leaves all other operations to the shared fixture's network guard.
     */
    await page.route(
      (url) => url.origin === baseURL && /^\/api\/(?:ips(?:\/search|\/21)?|stats)$/.test(url.pathname),
      async (route) => {
        // url supplies the requested endpoint and query. method distinguishes reads from the one supported deletion.
        const url = new URL(route.request().url())
        const method = route.request().method()
        if (method === 'DELETE' && url.pathname === '/api/ips/21') {
          deleteCount++
          addresses.splice(20, 1)
          await route.fulfill({ json: { result: 'OK' } })
          return
        }
        if (method === 'GET' && url.pathname === '/api/stats') {
          // total and ipv4Total keep the pre-delete snapshot throughout the filtered refresh.
          const total = isFiltered ? 22 : addresses.length
          const ipv4Total = isFiltered ? 21 : addresses.length
          await route.fulfill({
            json: {
              generated_at: '2023-11-14 22:13:20',
              dns: { total: 0, classic: 0, doh: 0 },
              domains: { total: 0, resolved: 0, unresolved: 0, unprocessed: 0, lists_total: 0, per_list: [] },
              ips: {
                total,
                v4_total: ipv4Total,
                v6_total: total - ipv4Total,
                linked_to_domain: 0,
                standalone: total,
                lists_total: 0,
                per_list: [],
              },
              ros: { total: 0 },
            },
          })
          return
        }
        if (method !== 'GET' || (url.pathname !== '/api/ips' && url.pathname !== '/api/ips/search')) {
          await route.fallback()
          return
        }

        // limit and offset select the API slice, text holds the search query, and type is the selected IP version.
        const limit = Number(url.searchParams.get('limit'))
        const offset = Number(url.searchParams.get('offset'))
        const text = url.searchParams.get('text') ?? ''
        const type = url.searchParams.get('type')
        if (isFiltered) expect(url.searchParams.has('default_gw')).toBe(false)
        if (deleteCount > 0) {
          expect(url.pathname).toBe(source === 'search' ? '/api/ips/search' : '/api/ips')
          expect(text).toBe(source === 'search' ? '192.0.2.' : '')
          if (isFiltered) expect(type).toBe('4')
          refreshOffsets.push(offset)
          if (!isFiltered && refreshOffsets.length === 1) {
            await route.fulfill({ status: 500, json: { error: 'Контролируемая ошибка загрузки IP' } })
            return
          }
        }

        // matching holds addresses selected by the filter callback, which checks each address against the query and type.
        // payload is the requested slice, which may be empty even when the query still matches other rows.
        const matching = addresses.filter(
          (address) => address.addr.includes(text) && (type === null || String(address.type) === type),
        )
        const payload = matching.slice(offset, offset + limit)
        await route.fulfill({
          json: { limit, offset, duration: 0.001, count: payload.length, total: matching.length, payload },
        })
      },
    )

    await page.goto('/#/ips')
    // searchInput edits the public search field, ipv4Filter selects the IP version and pagination navigates its pages.
    const searchInput = page.getByRole('searchbox', { name: 'Поиск по IP адресу', exact: true })
    const ipv4Filter = page.getByRole('button', { name: 'IPv4', exact: true })
    const pagination = page.getByRole('navigation', { name: 'Пагинация', exact: true })
    await expect(
      page.getByText(`Показано 1 - 20 из ${isFiltered ? 22 : 21} результатов`, { exact: true }),
    ).toBeVisible()
    if (isFiltered) {
      await ipv4Filter.click()
      await expect(ipv4Filter).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByText('Показано 1 - 20 из 21 результатов', { exact: true })).toBeVisible()
    }
    if (source === 'search') {
      await searchInput.fill('192.0.2.')
      await expect(page.getByRole('alert').filter({ hasText: 'Найдено IP адресов: 21' })).toBeVisible()
    }
    await pagination.getByRole('button', { name: '2', exact: true }).click()
    await expect(page.getByText('Показано 21 - 21 из 21 результатов', { exact: true })).toBeVisible()

    // table scopes assertions to the persistent table region, independently of the transient notifications.
    const table = page.getByRole('region', { name: 'Таблица данных', exact: true })
    await table.getByRole('button', { name: 'Удалить IP-адрес: 192.0.2.21', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Удалить IP Адрес', exact: true })
      .getByRole('button', { name: 'Удалить', exact: true })
      .click()
    await expect(table.getByText('Изменения сохранены. Обновляем список…', { exact: true })).toBeVisible()
    await page.clock.fastForward(7_000)
    if (!isFiltered) {
      await expect(table.getByRole('alert')).toHaveText('Не удалось загрузить данные')
      expect(refreshOffsets).toEqual([source === 'list' ? 20 : 0])

      await page.clock.fastForward(10_000)
      await expect(table.getByRole('alert')).toHaveText('Не удалось загрузить данные')
      await expect(table.getByText('IP адреса не найдены', { exact: true })).toHaveCount(0)
      await table.getByRole('button', { name: 'Повторить', exact: true }).click()
    }

    await expect(page.getByText('Показано 1 - 20 из 20 результатов', { exact: true })).toBeVisible()
    await expect(pagination.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(pagination.getByRole('button', { name: '2', exact: true })).toHaveCount(0)
    await expect(table.getByRole('button', { name: /^Открыть карточку: / })).toHaveCount(20)
    await expect(table.getByRole('button', { name: 'Открыть карточку: 192.0.2.1', exact: true })).toBeVisible()
    await expect(table.getByRole('button', { name: 'Открыть карточку: 192.0.2.20', exact: true })).toBeVisible()
    await expect(table.getByRole('button', { name: 'Открыть карточку: 192.0.2.21', exact: true })).toHaveCount(0)
    await expect(table.getByRole('alert')).toHaveCount(0)
    if (isFiltered) {
      await expect(ipv4Filter).toHaveAttribute('aria-pressed', 'true')
      await expect(table.getByRole('button', { name: 'Открыть карточку: 2001:db8::22', exact: true })).toHaveCount(0)
      expect(refreshOffsets.length).toBeGreaterThan(0)
    } else {
      expect(refreshOffsets).toEqual(source === 'list' ? [20, 20, 0] : [0, 0, 0])
    }
    expect(deleteCount).toBe(1)
  })
}
