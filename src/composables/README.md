# Composables

Набор переиспользуемых композаблов для Vue 3 приложения.

## usePaginatedData

Композабл для автоматического управления пагинацией данных с загрузкой из API.

### Возможности

- Автоматическая загрузка данных при изменении параметров пагинации
- Встроенное управление состоянием загрузки
- Методы для программного управления пагинацией
- Типобезопасность через TypeScript generics

### Использование

#### Базовый пример

```typescript
import { usePaginatedData } from '@/composables'
import { dnsApi } from '@/api/endpoints/dns'
import type { DnsServer } from '@/api/types/dns'

const {
  data: servers,
  isLoading,
  pagination,
  load,
  refresh,
  goToPage,
  changePageSize,
} = usePaginatedData<DnsServer>(
  async (params) => dnsApi.getAll(params),
  20, // начальный размер страницы (опционально, по умолчанию 20)
)

// Начальная загрузка
onMounted(() => load())
```

#### В шаблоне

```vue
<template>
  <DataTable :data="servers" :columns="TABLE_COLUMNS" :is-loading="isLoading" />

  <PaginationControl
    v-if="servers.length > 0"
    :current-page="pagination.currentPage.value"
    :total-pages="pagination.totalPages.value"
    :total-items="pagination.totalItems.value"
    :page-size="pagination.pageSize.value"
    :page-size-options="pagination.PAGE_SIZE_OPTIONS"
    @update:current-page="goToPage"
    @update:page-size="changePageSize"
  />
</template>
```

### API

#### Возвращаемые значения

| Свойство               | Тип                      | Описание                                 |
| ---------------------- | ------------------------ | ---------------------------------------- |
| `data`                 | `Ref<T[]>`               | Массив загруженных данных                |
| `isLoading`            | `Ref<boolean>`           | Состояние загрузки                       |
| `pagination`           | `UsePagination`          | Объект с параметрами пагинации           |
| `load()`               | `() => Promise<void>`    | Загрузить данные с текущими параметрами  |
| `refresh()`            | `() => Promise<void>`    | Перезагрузить текущую страницу           |
| `reset()`              | `() => void`             | Сбросить пагинацию и перезагрузить       |
| `goToPage(page)`       | `(page: number) => void` | Перейти на страницу и загрузить данные   |
| `changePageSize(size)` | `(size: number) => void` | Изменить размер страницы и перезагрузить |
| `nextPage()`           | `() => void`             | Следующая страница с загрузкой           |
| `prevPage()`           | `() => void`             | Предыдущая страница с загрузкой          |

#### Параметры pagination

| Свойство            | Тип                    | Описание                                     |
| ------------------- | ---------------------- | -------------------------------------------- |
| `currentPage`       | `Ref<number>`          | Текущая страница                             |
| `pageSize`          | `Ref<number>`          | Размер страницы                              |
| `totalItems`        | `Ref<number>`          | Общее количество элементов                   |
| `totalPages`        | `ComputedRef<number>`  | Общее количество страниц                     |
| `offset`            | `ComputedRef<number>`  | Смещение для API запроса                     |
| `hasNextPage`       | `ComputedRef<boolean>` | Есть ли следующая страница                   |
| `hasPrevPage`       | `ComputedRef<boolean>` | Есть ли предыдущая страница                  |
| `PAGE_SIZE_OPTIONS` | `number[]`             | Доступные размеры страницы [10, 20, 50, 100] |

### Примеры использования

#### С поиском

```typescript
const searchQuery = ref('')

const { data, isLoading, pagination, load, goToPage, changePageSize } = usePaginatedData<DnsServer>(async (params) =>
  dnsApi.getAll(params),
)

const searchServers = async () => {
  if (!searchQuery.value || searchQuery.value.length < 3) {
    load()
    return
  }

  isLoading.value = true
  try {
    const response = await dnsApi.search(searchQuery.value, {
      limit: pagination.pageSize.value,
      offset: pagination.offset.value,
    })
    data.value = response.payload
    pagination.totalItems.value = response.total
  } catch (error) {
    console.error('Failed to search:', error)
  } finally {
    isLoading.value = false
  }
}
```

#### После создания/удаления элемента

```typescript
const { refresh } = usePaginatedData<DnsServer>(async (params) => dnsApi.getAll(params))

const createServer = async (formData: DnsServerCreateData) => {
  await dnsApi.create([formData])
  // Перезагрузить текущую страницу
  refresh()
}

const deleteServer = async (id: number) => {
  await dnsApi.deleteOne(id)
  // Перезагрузить текущую страницу
  refresh()
}
```

## usePagination

Базовый композабл для управления только состоянием пагинации (без загрузки данных).

Используйте `usePagination`, если вам нужно только управление состоянием пагинации без автоматической загрузки.
Для большинства случаев рекомендуется использовать `usePaginatedData`.

### Использование

```typescript
import { usePagination } from '@/composables'

const pagination = usePagination(20)

// Методы
pagination.goToPage(2)
pagination.changePageSize(50)
pagination.nextPage()
pagination.prevPage()
pagination.reset()
```

## usePolling

Композабл для периодического опроса данных.

### Использование

```typescript
import { usePolling } from '@/composables'

const { start, stop, isActive } = usePolling(
  async () => {
    // Ваша функция загрузки
    await loadData()
  },
  {
    interval: 5000, // интервал в миллисекундах
    immediate: true, // запустить сразу при создании
    onError: (error) => {
      console.error('Polling error:', error)
    },
  },
)

// Запустить опрос
start()

// Остановить опрос
stop()
```

## useApi

Композабл для работы с API запросами с обработкой ошибок.

### Использование

```typescript
import { useApi } from '@/composables'

const { data, isLoading, hasError, errorMessage, execute } = useApi(async () => await dnsApi.getAll())

// Выполнить запрос
await execute()
```

## Централизованный экспорт

Все композаблы экспортируются через `src/composables/index.ts`:

```typescript
// Импорт композаблов
import { usePaginatedData, usePolling, useApi } from '@/composables'

// Импорт типов
import type { PaginationParams, PaginatedResponse } from '@/composables'
```

Это упрощает импорты и делает код более чистым и поддерживаемым.

## Использование централизованных констант

Все композаблы используют централизованные константы из `src/constants.ts`:

### Константы пагинации (usePaginatedData)
- **`PAGINATION.DEFAULT_PAGE_SIZE`** - размер страницы по умолчанию (20)
- **`PAGINATION.PAGE_SIZE_OPTIONS`** - доступные размеры страниц `[10, 20, 50, 100]`

### Константы поиска (используются в страницах с поиском)
- **`SEARCH.MIN_LENGTH`** - минимальная длина поискового запроса (3)

### Константы API (useApi, usePaginatedData)
- **`API.TIMEOUT`** - timeout для API запросов (5000 мс)
- **`API.FALLBACK_BASE_URL`** - fallback URL для production
- **`API.HEADERS.CONTENT_TYPE`** - Content-Type заголовок

### Константы Store (usePolling)
- **`STORES.DEFAULT_POLLING_INTERVAL`** - интервал polling по умолчанию (3000 мс)
- **`STORES.HEALTH_CACHE_TTL`** - TTL кеша health data (10000 мс)

Эти константы обеспечивают единообразие во всем приложении и упрощают глобальное изменение настроек.

```typescript
// Пример: изменить размер страницы по умолчанию
const { data, pagination } = usePaginatedData<DnsServer>(
  async (params) => dnsApi.getAll(params),
  50 // использовать 50 вместо значения по умолчанию
)
```

## Обработка ошибок

Все композаблы интегрированы с глобальной системой обработки ошибок:

- **ErrorHandler** - автоматически перехватывает и обрабатывает ошибки
- **NotificationsStore** - управляет отображением уведомлений
- **ErrorNotification** - отображает уведомления пользователю

### Уровни серьезности ошибок

| Severity | Описание | Длительность |
|----------|----------|--------------|
| `INFO` | Информационные сообщения | 3 секунды |
| `WARNING` | Предупреждения | 5 секунд |
| `ERROR` | Ошибки | 7 секунд |
| `CRITICAL` | Критические ошибки | 10 секунд |

### Как это работает

1. При возникновении ошибки в композабле она автоматически перехватывается
2. ErrorHandler анализирует тип ошибки и определяет severity
3. Создается уведомление с соответствующим сообщением
4. Уведомление отображается в правом верхнем углу экрана
5. Автоматически закрывается по истечении таймера

```typescript
// Ошибки обрабатываются автоматически
const { data, isLoading, load } = usePaginatedData<DnsServer>(
  async (params) => dnsApi.getAll(params)
)

// Если запрос упадет, пользователь увидит уведомление
await load() // Ошибка будет перехвачена и показана автоматически
```

## Дополнительная информация

- [Основная документация проекта](../../README.md) - общая информация, установка, функциональность
- [Статус проекта](../../PROJECT_STATUS.md) - детальный статус разработки, история изменений
- [Руководство по разработке](../../DEVELOPMENT.md) - шаблоны и best practices
- [OpenAPI спецификация](../../TARGET_OPENAPI.md) - документация REST API backend

---

**Последнее обновление:** 2026-02-15
