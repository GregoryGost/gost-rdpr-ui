# GOST-RDPR UI

Административная панель для REST API проекта [GOST-RDPR](https://github.com/GregoryGost/gost-rdpr).

Реализует CRUD-интерфейс для управления DNS-серверами, доменами, IP-адресами, конфигурациями RouterOS и командами с поиском, пагинацией, сортировкой и фильтрацией таблиц, а также страницу статистики с интерактивными графиками.

## Скриншоты

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/dashboard-light.png" alt="Dashboard — светлая тема" />
      <p align="center"><i>Главная — светлая тема</i></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/dashboard-dark.png" alt="Dashboard — тёмная тема" />
      <p align="center"><i>Главная — тёмная тема</i></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/domains-page-light.png" alt="Домены — светлая тема" />
      <p align="center"><i>Домены — светлая тема</i></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/domains-page-dark.png" alt="Домены — тёмная тема" />
      <p align="center"><i>Домены — тёмная тема</i></p>
    </td>
  </tr>
</table>

## Быстрый старт

```bash
pnpm install
```

Создайте файл `.env.development`:

```env
VITE_API_BASE_URL=http://127.0.0.1:4000
```

```bash
pnpm dev        # http://localhost:5000
pnpm build      # production сборка
pnpm type-check # проверка TypeScript
pnpm lint-dry-run # проверка ESLint без записи исправлений
pnpm format     # форматирование кода
```

> В режиме разработки запросы к `/api` автоматически проксируются к `VITE_API_BASE_URL`.

## Технологии

| Категория             | Технология                                     |
| --------------------- | ---------------------------------------------- |
| Framework             | Vue 3.5.33 (Composition API, `<script setup>`) |
| Язык                  | TypeScript 6.0.3                               |
| Сборщик               | Vite 8.0.10                                    |
| Стили                 | Tailwind CSS 4.2.4                             |
| UI-компоненты         | Headless UI 1.7.23, Heroicons 2.2.0            |
| Роутинг               | Vue Router 5.0.6                               |
| Управление состоянием | Pinia 3.0.4                                    |
| Линтинг               | ESLint 10.2.1 + Prettier 3.8.3                 |

**Требования:** Node.js `^20.19.0 || >=24.13.0`, пакетный менеджер `pnpm`.

## Разделы

- **Главная** — health, версии, конфигурация, обзорные метрики, автообновление
- **DNS Серверы** — управление серверами (Classic / DoH)
- **Списки доменов** — источники доменов, попытки загрузки, статистика ошибок
- **Домены** — домены, резолвинг, IPv4 / IPv6, фильтры по статусу и спискам
- **Списки IP** — источники IP-адресов, IPv4 / IPv6, попытки загрузки
- **IP Адреса** — адреса (IPv4 / IPv6), связи со списками и доменами, базовый Gateway
- **Конфигурации RoS** — конфигурации RouterOS для BGP, firewall и маршрутизации
- **Команды** — загрузка списков, резолвинг доменов, обновление RouterOS в IPv4-only режиме
- **Статистика** — обзор, live-активность, динамика роста, разбивка по спискам

## Рекомендуемая IDE

[VS Code](https://code.visualstudio.com/) + расширение [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Документация

- [Руководство по разработке](DEVELOPMENT.md)
- [OpenAPI спецификация](TARGET_OPENAPI.md)
- [Документация composables](src/composables/README.md)

## Лицензия

Все исходные материалы проекта распространяются под лицензией [GPL v3](./LICENSE). Автор не предоставляет гарантий работоспособности и не несёт ответственности за претензии или причинённый ущерб.

## Об авторе

GregoryGost — <https://gregory-gost.ru>
