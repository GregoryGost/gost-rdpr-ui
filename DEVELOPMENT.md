# Руководство по разработке

## Что реализовано

### 1. API Слой ✅

- `src/api/client.ts` — HTTP клиент с обработкой ошибок
- `src/api/types/` — TypeScript типы для всех API endpoints
- `src/api/endpoints/dns.ts` — методы для работы с DNS серверами
- `src/api/endpoints/domains-lists.ts` — методы для списков доменов
- `src/api/endpoints/domains.ts` — методы для доменов
- `src/api/endpoints/ips-lists.ts` — методы для списков IP
- `src/api/endpoints/ips.ts` — методы для IP адресов
- `src/api/endpoints/ros.ts` — методы для конфигураций RouterOS
- `src/api/endpoints/commands.ts` — методы для выполнения команд
- `src/api/endpoints/stats.ts` — глобальная статистика (`getStats()`, `getGrowth()`)
- `src/api/endpoints/index.ts` — централизованный экспорт

### 2. Composables ✅

- `src/composables/useApi.ts` — wrapper для API с loading/error states
- `src/composables/usePagination.ts` — базовое управление состоянием пагинации
- `src/composables/usePaginatedData.ts` — автоматическая пагинация с загрузкой данных
- `src/composables/usePolling.ts` — периодический опрос данных
- `src/composables/README.md` — полная документация с примерами

### 3. UI Kit (10 компонентов) ✅

- **Buttons:** `BaseButton`
- **Forms:** `BaseInput`, `BaseTextarea`, `BaseSelect`
- **Tables:** `DataTable` (с сортировкой и фильтрами по колонкам), `PaginationControl`
- **Modals:** `BaseModal`, `ConfirmDialog`
- **Feedback:** `LoadingSpinner`, `EmptyState`

### 4. Components ✅

- **General:** `AppLogo`, `ErrorNotification`
- **Dashboard:** `HealthStatusCard`, `VersionInfoCard`, `QuickActionsCard`, `ConnectionAlert`, `PollingSettings`, `ConfigurationCard`
- **Charts:** `LineChart`, `BarChart`, `PieChart`

### 5. Layout ✅

- `src/layouts/MainLayout.vue` — основной layout с sidebar, header, footer
- `src/layouts/AppHeader.vue` — заголовок с логотипом и переключателем темы
- `src/layouts/AppFooter.vue` — подвал с информацией

### 6. Страницы ✅

| Страница      | Путь               | Файл                                     |
| ------------- | ------------------ | ---------------------------------------- |
| Home          | `/`                | `src/pages/HomePage.vue`                 |
| DNS Servers   | `/dns`             | `src/pages/dns/DnsServersPage.vue`       |
| Domains Lists | `/domains/lists`   | `src/pages/domains/DomainsListsPage.vue` |
| Domains       | `/domains`         | `src/pages/domains/DomainsPage.vue`      |
| IPs Lists     | `/ips/lists`       | `src/pages/ips/IpsListsPage.vue`         |
| IPs           | `/ips`             | `src/pages/ips/IpsPage.vue`              |
| ROS Configs   | `/ros`             | `src/pages/ros/RosConfigsPage.vue`       |
| Commands      | `/commands`        | `src/pages/commands/CommandsPage.vue`    |
| Statistics    | `/stats`           | `src/pages/stats/StatisticsPage.vue`     |
| 404 Not Found | `/:pathMatch(.*)*` | `src/pages/NotFoundPage.vue`             |

---

## Шаблон для новой страницы (с usePaginatedData)

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { someApi } from '@/api/endpoints'
import type { SomeType } from '@/api/types/some'
import { usePaginatedData } from '@/composables'
import DataTable from '@/ui/tables/DataTable.vue'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'

const {
  data: items,
  isLoading,
  pagination,
  load: loadItems,
  refresh: refreshItems,
  goToPage,
  changePageSize,
} = usePaginatedData<SomeType>(async (params) => someApi.getAll(params), 20)

const isAddModalOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const itemToDelete = ref<number | null>(null)
const formData = ref({})

const TABLE_COLUMNS = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Название', sortable: true, filterPlaceholder: 'Название' },
]

const createItem = async () => {
  await someApi.create([formData.value])
  refreshItems()
}

const deleteItem = async () => {
  if (itemToDelete.value === null) return
  await someApi.deleteOne(itemToDelete.value)
  refreshItems()
}

onMounted(() => {
  loadItems()
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h1>Заголовок</h1>
    </div>

    <div class="mb-6 flex gap-4">
      <BaseButton @click="isAddModalOpen = true">Добавить</BaseButton>
    </div>

    <DataTable :data="items" :columns="TABLE_COLUMNS" :is-loading="isLoading" />

    <PaginationControl
      v-if="items.length > 0"
      :current-page="pagination.currentPage.value"
      :total-pages="pagination.totalPages.value"
      :total-items="pagination.totalItems.value"
      :page-size="pagination.pageSize.value"
      :page-size-options="pagination.PAGE_SIZE_OPTIONS"
      @update:current-page="goToPage"
      @update:page-size="changePageSize"
    />

    <BaseModal :is-open="isAddModalOpen" @close="isAddModalOpen = false">
      <!-- Form -->
    </BaseModal>

    <ConfirmDialog :is-open="isDeleteConfirmOpen" @confirm="deleteItem" @cancel="isDeleteConfirmOpen = false" />
  </div>
</template>
```

### Сортировка колонок

Для включения сортировки добавить `sortable: true` в конфигурацию колонки:

```typescript
const TABLE_COLUMNS = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Название', sortable: true },
  { key: 'addr', label: 'IP Адрес', sortable: true, sortType: 'ip' as const },
]
```

`sortType: 'ip'` активирует IP-компаратор (поддерживает IPv4 по октетам и IPv6 с нормализацией).

### Фильтрация колонок

`DataTable` автоматически выводит строку фильтров под заголовками таблицы. Все колонки фильтруются по умолчанию, кроме колонки `actions`.

```typescript
const TABLE_COLUMNS = [
  { key: 'id', label: 'ID', sortable: true },
  {
    key: 'resolved',
    label: 'Статус',
    sortable: true,
    filterValue: (_row: Domain, value: unknown) =>
      value ? 'определен resolved true да 1' : 'не определен unresolved false нет 0',
  },
  { key: 'actions', label: 'Действия' },
]
```

Параметры колонки:

| Поле                | Описание                                                         |
| ------------------- | ---------------------------------------------------------------- |
| `filterable`        | `false` отключает поле фильтра для колонки                       |
| `filterPlaceholder` | Плейсхолдер для input фильтра                                    |
| `filterValue`       | Преобразует значение строки в текст, по которому идет фильтрация |

Фильтрация применяется к данным, переданным в `DataTable`, и выполняется перед сортировкой. Для глобальной фильтрации по всем записям страница должна перезагружать данные через API, если backend предоставляет соответствующий query-параметр.

---

## Полезные команды

```bash
pnpm dev          # Запуск dev сервера
pnpm build        # Сборка для продакшена
pnpm type-check   # Проверка TypeScript
pnpm format       # Форматирование кода
```

---

## Правила кодирования

1. **Отступы:** 2 пробела
2. **Комментарии:** английский язык
3. **UI текст:** русский язык
4. **Константы:** `UPPERCASE_WITH_UNDERSCORES`
5. **Компоненты:** `PascalCase` (минимум 2 слова)
6. **Composables:** `camelCase` с префиксом `use`
7. **Стили:** Tailwind utility classes напрямую, без BEM, без `px`

---

## Централизация констант

Все константы проекта находятся в `src/constants.ts`:

```typescript
// Идентификация приложения
APP_NAME, APP_TITLE, APP_DESCRIPTION, APP_AUTHOR

// Ключи localStorage
STORAGE_KEYS { DARK_MODE, POLLING_INTERVAL }

// API конфигурация
API { TIMEOUT, FALLBACK_BASE_URL, HEADERS }

// Store конфигурация
STORES { HEALTH_CACHE_TTL, DEFAULT_POLLING_INTERVAL }

// Пагинация
PAGINATION { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS }

// Поиск и валидация
SEARCH { MIN_LENGTH }
VALIDATION { MIN_NAME_LENGTH, MIN_URL_LENGTH }

// UI тексты по доменам
UI_TEXTS, PAGE_TITLES, PAGE_DESCRIPTIONS,
DOMAIN_TEXTS, DOMAINS_LISTS_TEXTS,
DNS_TEXTS, IPS_TEXTS, IPS_LISTS_TEXTS,
ROS_TEXTS, COMMANDS_TEXTS, ERROR_MESSAGES
```

**Правила использования:**

```typescript
// ✅ Правильно
import { API, UI_TEXTS } from '@/constants'
timeout: API.TIMEOUT

// ❌ Неправильно
timeout: 5000
```

---

## Архитектурные решения

- **Composables** для переиспользуемой логики
- **UI Kit** для всех визуальных компонентов
- **TypeScript** везде, строгая типизация без `any`
- **Lazy loading** для routes
- **Mobile-first** подход в стилях
- **ResizeObserver + requestAnimationFrame** для адаптивных SVG-чартов
- **statsApi.getStats()** для точных глобальных метрик (не из пагинации)
- **Фильтры над таблицами** перезагружают данные через API там, где backend поддерживает параметры фильтрации; неподдерживаемые условия применяются локально после загрузки свежей страницы данных

---

## Полезная документация

- [Документация Composables](src/composables/README.md)
- [Vue 3 Composition API](https://vuejs.org/api/composition-api-setup.html)
- [TypeScript в Vue](https://vuejs.org/guide/typescript/overview.html)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
