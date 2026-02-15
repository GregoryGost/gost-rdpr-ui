# Руководство по разработке

## Что уже реализовано

### 1. API Слой ✅
- `src/api/client.ts` - HTTP клиент с обработкой ошибок
- `src/api/types/` - TypeScript типы для всех API endpoints
- `src/api/endpoints/dns.ts` - методы для работы с DNS
- `src/api/endpoints/commands.ts` - методы для выполнения команд

### 2. Composables ✅
- `src/composables/index.ts` - централизованный экспорт всех композаблов
- `src/composables/useApi.ts` - wrapper для API с loading/error states
- `src/composables/usePagination.ts` - базовое управление состоянием пагинации
- `src/composables/usePaginatedData.ts` - автоматическая пагинация с загрузкой данных
- `src/composables/usePolling.ts` - периодический опрос данных
- `src/composables/README.md` - полная документация с примерами

### 3. UI Kit (10 компонентов) ✅
- **Buttons:** BaseButton
- **Forms:** BaseInput, BaseTextarea, BaseSelect
- **Tables:** DataTable, PaginationControl
- **Modals:** BaseModal, ConfirmDialog
- **Feedback:** LoadingSpinner, EmptyState

### 4. Components (6 компонентов) ✅
- **General:** AppLogo
- **Dashboard:** HealthStatusCard, VersionInfoCard, QuickActionsCard, ConnectionAlert, PollingSettings

### 5. Layout ✅
- `src/layouts/MainLayout.vue` - основной layout с sidebar, header, footer
- `src/layouts/AppHeader.vue` - заголовок с логотипом и переключателем темы
- `src/layouts/AppFooter.vue` - подвал с информацией

### 6. Страницы ✅
- `src/pages/HomePage.vue` - dashboard с метриками и автообновлением
- `src/pages/dns/DnsServersPage.vue` - полный CRUD для DNS серверов (эталон с `usePaginatedData`)
- `src/pages/commands/CommandsPage.vue` - выполнение системных команд

## Что нужно реализовать

### Приоритет 1: Domains (Домены)

#### 1.1 API Endpoints
Создать `src/api/endpoints/domains.ts` (использовать паттерн из `dns.ts`):
```typescript
import { apiRequest } from '../client'
import type { DomainsList, Domain, DomainsListCreateData, DomainCreateData } from '../types/domains'
import type { PaginatedResponse, PaginationParams, OkResponse } from '../types/common'

/**
 * Convert pagination params to URLSearchParams
 */
function toSearchParams(params: Record<string, unknown>): URLSearchParams {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    searchParams.append(key, String(value))
  })
  return searchParams
}

export const domainsListsApi = {
  getAll: (params?: PaginationParams & { attempts?: number }) => {
    const queryString = params ? `?${toSearchParams(params)}` : ''
    return apiRequest<PaginatedResponse<DomainsList>>(`/domains/lists${queryString}`)
  },
  // ... остальные методы
}

export const domainsApi = {
  getAll: (params?: PaginationParams & { resolved?: boolean }) => {
    const queryString = params ? `?${toSearchParams(params)}` : ''
    return apiRequest<PaginatedResponse<Domain>>(`/domains${queryString}`)
  },
  // ... остальные методы
}
```

**Важно:** Не использовать тип `any`, применять типобезопасные хелперы

#### 1.2 Страницы
- `src/pages/domains/DomainsListsPage.vue` - управление списками доменов
- `src/pages/domains/DomainsPage.vue` - управление доменами

**Копировать паттерн из DnsServersPage.vue:**
1. Импорты API и типов из централизованных экспортов
2. Использовать `usePaginatedData` для автоматической пагинации
3. Модальные окна (add, delete confirm)
4. Table columns configuration
5. Шаблон с DataTable, PaginationControl, Modals

**Преимущества `usePaginatedData`:**
- Автоматическая загрузка при изменении страницы/размера
- Встроенное управление состоянием загрузки
- Уменьшение кода на ~40 строк
- Единообразие API для всех страниц

#### 1.3 Обновить Router
```typescript
{
  path: 'domains/lists',
  name: 'domains-lists',
  component: () => import('@/pages/domains/DomainsListsPage.vue'),
  meta: { title: 'Списки Доменов' },
},
{
  path: 'domains',
  name: 'domains',
  component: () => import('@/pages/domains/DomainsPage.vue'),
  meta: { title: 'Домены' },
},
```

### Приоритет 2: IPs (IP Адреса)

Аналогично Domains:

#### 2.1 API Endpoints
`src/api/endpoints/ips.ts` - создать аналогично domains

#### 2.2 Страницы
- `src/pages/ips/IpsListsPage.vue`
- `src/pages/ips/IpsPage.vue`

#### 2.3 Обновить Router

### Приоритет 3: ROS (Конфигурации RouterOS)

#### 3.1 API Endpoints
`src/api/endpoints/ros.ts`:
```typescript
export const rosApi = {
  getAll: (params?: PaginationParams) => { /* ... */ },
  getOne: (id: number) => { /* ... */ },
  create: (data: RosConfigCreateData[]) => { /* ... */ },
  deleteOne: (id: number) => { /* ... */ },
  deleteAll: () => { /* ... */ },
  search: (text: string, params?: PaginationParams) => { /* ... */ },
}
```

#### 3.2 Страница
`src/pages/ros/ConfigurationsPage.vue`

**Особенность:** поле password должно быть скрыто (type="password")

#### 3.3 Обновить Router

## Шаблон для новой страницы (с usePaginatedData)

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { /* API */ } from '@/api/endpoints/...'
import type { /* Types */ } from '@/api/types/...'
import { usePaginatedData } from '@/composables'
import DataTable from '@/ui/tables/DataTable.vue'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
// ... другие импорты

// Paginated data management (автоматическая пагинация)
const {
  data: items,
  isLoading,
  pagination,
  load: loadItems,
  refresh: refreshItems,
  goToPage,
  changePageSize,
} = usePaginatedData<ItemType>(async (params) => itemsApi.getAll(params), 20)

// Модалки
const isAddModalOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const itemToDelete = ref<number | null>(null)

// Форма
const formData = ref({})
const formErrors = ref({})

// Конфигурация таблицы
const TABLE_COLUMNS = [/* ... */]

// CRUD методы
const createItem = async () => {
  // ... создание
  refreshItems() // автоматически обновит данные
}

const deleteItem = async () => {
  // ... удаление
  refreshItems() // автоматически обновит данные
}

onMounted(() => {
  loadItems()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h1>Заголовок</h1>
      <p>Описание</p>
    </div>

    <!-- Actions Bar -->
    <div class="mb-6 flex gap-4">
      <!-- Search -->
      <!-- Add Button -->
    </div>

    <!-- Table -->
    <DataTable :data="items" :columns="TABLE_COLUMNS" :is-loading="isLoading" />

    <!-- Pagination -->
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

    <!-- Modals -->
    <BaseModal :is-open="isAddModalOpen" @close="isAddModalOpen = false">
      <!-- Form -->
    </BaseModal>

    <ConfirmDialog 
      :is-open="isDeleteConfirmOpen" 
      @confirm="deleteItem" 
      @cancel="isDeleteConfirmOpen = false" 
    />
  </div>
</template>
```

**Преимущества:**
- Меньше кода (нет ручной обработки пагинации)
- Автоматическая перезагрузка при изменении страницы
- Единообразный подход на всех страницах
- Типобезопасность через generics

## Дополнительные улучшения

### 1. Toast Notifications (рекомендуется)
Создать `src/stores/notification.ts` и `src/ui/feedback/ToastNotification.vue`

### 2. Error Boundary
Добавить глобальный обработчик ошибок в `main.ts`

### 3. Улучшение типизации
Использовать generic типы для DataTable

### 4. Тесты
- Unit тесты для composables
- Component тесты для UI kit

## Полезная документация

- [Документация Composables](src/composables/README.md) - полное руководство по использованию композаблов
- [Vue 3 Composition API](https://vuejs.org/api/composition-api-setup.html)
- [TypeScript в Vue](https://vuejs.org/guide/typescript/overview.html)
- [Tailwind CSS v4](https://tailwindcss.com/docs)

## Полезные команды

```bash
# Запуск dev сервера
pnpm dev

# Проверка типов
pnpm type-check

# Линтинг
pnpm lint

# Форматирование
pnpm format

# Сборка
pnpm build
```

## Правила кодирования

1. **Отступы:** 2 пробела
2. **Комментарии:** английский язык
3. **UI текст:** русский язык
4. **Константы:** UPPERCASE_WITH_UNDERSCORES
5. **Компоненты:** PascalCase (минимум 2 слова)
6. **Composables:** camelCase с префиксом `use`
7. **Стили:** использовать Tailwind utility classes напрямую

## Структура API запросов

Все API запросы должны:
1. Использовать `apiRequest` из `client.ts`
2. Иметь TypeScript типы
3. Обрабатывать ошибки через try/catch
4. Показывать loading состояния

## Централизация констант

Все константы проекта находятся в `src/constants.ts` и организованы по группам:

### Конфигурационные группы

```typescript
// Идентификация приложения
APP_NAME, APP_TITLE, APP_DESCRIPTION, APP_AUTHOR

// Ключи localStorage
STORAGE_KEYS {
  DARK_MODE: 'darkMode',
  POLLING_INTERVAL: 'polling-interval'
}

// API конфигурация
API {
  TIMEOUT: 5000,
  FALLBACK_BASE_URL: 'http://127.0.0.1:4000',
  HEADERS: { CONTENT_TYPE: 'application/json' }
}

// Конфигурация Store
STORES {
  HEALTH_CACHE_TTL: 10000,
  DEFAULT_POLLING_INTERVAL: 3000
}

// Пагинация
PAGINATION {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
}

// Поиск
SEARCH {
  MIN_LENGTH: 3
}

// Валидация
VALIDATION {
  MIN_NAME_LENGTH: 3,
  MIN_URL_LENGTH: 5
}
```

### UI тексты

Все UI тексты централизованы по доменам:
- `UI_TEXTS` - общие тексты (кнопки, статусы, действия)
- `PAGE_TITLES`, `PAGE_DESCRIPTIONS` - заголовки и описания страниц
- `DOMAIN_TEXTS`, `DOMAINS_LISTS_TEXTS` - терминология доменов
- `DNS_TEXTS` - терминология DNS
- `IPS_TEXTS`, `IPS_LISTS_TEXTS` - терминология IP адресов
- `ROS_TEXTS` - терминология RouterOS
- `COMMANDS_TEXTS` - терминология команд
- `ERROR_MESSAGES` - сообщения об ошибках

### Правила использования

1. **Всегда импортируйте константы**, не используйте hardcoded значения:
   ```typescript
   // ✅ Правильно
   import { API, STORAGE_KEYS, UI_TEXTS } from '@/constants'
   timeout: API.TIMEOUT
   
   // ❌ Неправильно
   timeout: 5000
   ```

2. **Для новых констант** добавляйте их в соответствующую группу в `constants.ts`

3. **Для UI текстов** используйте существующие группы или создайте новую

4. **Для ключей localStorage** добавляйте в `STORAGE_KEYS`

## Архитектурные решения

- **Composables** для переиспользуемой логики (не дублировать код)
- **UI Kit** для всех визуальных компонентов (единообразие)
- **TypeScript** везде (строгая типизация)
- **Lazy loading** для routes и больших компонентов
- **Mobile-first** подход в стилях

---

Удачи в разработке! 🚀
