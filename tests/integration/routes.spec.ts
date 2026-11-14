import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { routes } from '@/router/routes'

/** Verifies the real production records with a fresh history and completed lazy navigation each time. */
describe('application routes', () => {
  /** path is the public URL, name is the navigation key, title is Russian metadata and viewName identifies the page. */
  it.each([
    ['/', 'home', 'Главная', 'HomePage'],
    ['/dns', 'dns', 'DNS Серверы', 'DnsServersPage'],
    ['/domains', 'domains', 'Домены', 'DomainsPage'],
    ['/domains/lists', 'domains-lists', 'Списки Доменов', 'DomainsListsPage'],
    ['/ips/lists', 'ips-lists', 'Списки IP Адресов', 'IpsListsPage'],
    ['/ips', 'ips', 'IP Адреса', 'IpsPage'],
    ['/ros', 'ros', 'Конфигурации', 'RosConfigsPage'],
    ['/commands', 'commands', 'Команды', 'CommandsPage'],
    ['/stats', 'stats', 'Статистика', 'StatisticsPage'],
    ['/missing/nested/path', 'not-found', '404 - Страница не найдена', 'NotFoundPage'],
  ])('resolves %s with its named view and title', async (path, name, title, viewName) => {
    // routeRecord is the production child selected by its public name before navigation resolves its lazy view.
    const routeRecord = routes[0]?.children?.find(
      /** Selects the route with this scenario's stable name. */ (record) => record.name === name,
    )
    expect(typeof routeRecord?.component).toBe('function')
    // router is isolated from the production singleton, including all lazy component resolution state.
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(path)
    await router.isReady()
    expect(router.currentRoute.value.name).toBe(name)
    expect(router.currentRoute.value.meta.title).toBe(title)
    expect(router.currentRoute.value.matched).toHaveLength(2)
    // view is the resolved default child component, proving its lazy import loaded successfully.
    const view = router.currentRoute.value.matched.at(-1)?.components?.default
    expect(typeof view).toBe('object')
    expect(view).toHaveProperty('render')
    expect(view).toHaveProperty('__name', viewName)
    await router.push({ name: 'home', query: { from: 'integration' } })
    expect(router.currentRoute.value.fullPath).toBe('/?from=integration')
  })
})
