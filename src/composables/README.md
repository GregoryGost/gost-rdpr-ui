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
  20 // начальный размер страницы (опционально, по умолчанию 20)
)

// Начальная загрузка
onMounted(() => load())
```

#### В шаблоне

```vue
<template>
  <DataTable
    :data="servers"
    :columns="TABLE_COLUMNS"
    :is-loading="isLoading"
  />

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

| Свойство | Тип | Описание |
|----------|-----|----------|
| `data` | `Ref<T[]>` | Массив загруженных данных |
| `isLoading` | `Ref<boolean>` | Состояние загрузки |
| `pagination` | `UsePagination` | Объект с параметрами пагинации |
| `load()` | `() => Promise<void>` | Загрузить данные с текущими параметрами |
| `refresh()` | `() => Promise<void>` | Перезагрузить текущую страницу |
| `reset()` | `() => void` | Сбросить пагинацию и перезагрузить |
| `goToPage(page)` | `(page: number) => void` | Перейти на страницу и загрузить данные |
| `changePageSize(size)` | `(size: number) => void` | Изменить размер страницы и перезагрузить |
| `nextPage()` | `() => void` | Следующая страница с загрузкой |
| `prevPage()` | `() => void` | Предыдущая страница с загрузкой |

#### Параметры pagination

| Свойство | Тип | Описание |
|----------|-----|----------|
| `currentPage` | `Ref<number>` | Текущая страница |
| `pageSize` | `Ref<number>` | Размер страницы |
| `totalItems` | `Ref<number>` | Общее количество элементов |
| `totalPages` | `ComputedRef<number>` | Общее количество страниц |
| `offset` | `ComputedRef<number>` | Смещение для API запроса |
| `hasNextPage` | `ComputedRef<boolean>` | Есть ли следующая страница |
| `hasPrevPage` | `ComputedRef<boolean>` | Есть ли предыдущая страница |
| `PAGE_SIZE_OPTIONS` | `number[]` | Доступные размеры страницы [10, 20, 50, 100] |

### Примеры использования

#### С поиском

```typescript
const searchQuery = ref('')

const { data, isLoading, pagination, load, goToPage, changePageSize } = 
  usePaginatedData<DnsServer>(async (params) => dnsApi.getAll(params))

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
const { refresh } = usePaginatedData<DnsServer>(
  async (params) => dnsApi.getAll(params)
)

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
    }
  }
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

const { data, isLoading, hasError, errorMessage, execute } = useApi(
  async () => await dnsApi.getAll()
)

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
