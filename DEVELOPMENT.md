# Руководство по разработке

## Что уже реализовано

### 1. API Слой ✅
- `src/api/client.ts` - HTTP клиент с обработкой ошибок
- `src/api/types/` - TypeScript типы для всех API endpoints
- `src/api/endpoints/dns.ts` - методы для работы с DNS
- `src/api/endpoints/commands.ts` - методы для выполнения команд

### 2. Composables ✅
- `src/composables/useApi.ts` - wrapper для API с loading/error states
- `src/composables/usePagination.ts` - логика пагинации таблиц

### 3. UI Kit (9 компонентов) ✅
- **Buttons:** BaseButton
- **Forms:** BaseInput, BaseTextarea, BaseSelect
- **Tables:** DataTable, PaginationControl
- **Modals:** BaseModal, ConfirmDialog
- **Feedback:** LoadingSpinner, EmptyState

### 4. Layout ✅
- `src/layouts/MainLayout.vue` - основной layout с sidebar, header, footer

### 5. Страницы ✅
- `src/pages/HomePage.vue` - dashboard с метриками
- `src/pages/dns/DnsServersPage.vue` - полный CRUD для DNS серверов (эталон)
- `src/pages/commands/CommandsPage.vue` - выполнение системных команд

## Что нужно реализовать

### Приоритет 1: Domains (Домены)

#### 1.1 API Endpoints
Создать `src/api/endpoints/domains.ts`:
```typescript
import { apiRequest } from '../client'
import type { DomainsList, Domain, DomainsListCreateData, DomainCreateData } from '../types/domains'
import type { PaginatedResponse, PaginationParams, OkResponse } from '../types/common'

export const domainsListsApi = {
  getAll: (params?: PaginationParams & { attempts?: number }) => { /* ... */ },
  getOne: (id: number) => { /* ... */ },
  create: (data: DomainsListCreateData[]) => { /* ... */ },
  deleteOne: (id: number) => { /* ... */ },
  deleteAll: () => { /* ... */ },
  search: (text: string, params?: PaginationParams) => { /* ... */ },
}

export const domainsApi = {
  getAll: (params?: PaginationParams & { resolved?: boolean }) => { /* ... */ },
  getOne: (id: number) => { /* ... */ },
  create: (data: DomainCreateData[]) => { /* ... */ },
  deleteOne: (id: number) => { /* ... */ },
  deleteAll: () => { /* ... */ },
  search: (text: string, params?: PaginationParams) => { /* ... */ },
}
```

#### 1.2 Страницы
- `src/pages/domains/DomainsListsPage.vue` - управление списками доменов
- `src/pages/domains/DomainsPage.vue` - управление доменами

**Копировать паттерн из DnsServersPage.vue:**
1. Импорты API и типов
2. Reactive состояния (servers, isLoading, searchQuery)
3. Pagination setup
4. Модальные окна (add, delete confirm)
5. Table columns configuration
6. CRUD методы (load, create, delete)
7. Шаблон с DataTable, PaginationControl, Modals

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

## Шаблон для новой страницы

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { /* API */ } from '@/api/endpoints/...'
import type { /* Types */ } from '@/api/types/...'
import { usePagination } from '@/composables/usePagination'
import DataTable from '@/ui/tables/DataTable.vue'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
// ... другие импорты

// Состояния
const items = ref([])
const isLoading = ref(false)
const searchQuery = ref('')
const pagination = usePagination(20)

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
const loadItems = async () => { /* ... */ }
const createItem = async () => { /* ... */ }
const deleteItem = async () => { /* ... */ }
const searchItems = async () => { /* ... */ }

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
    <PaginationControl />

    <!-- Add Modal -->
    <BaseModal :is-open="isAddModalOpen" @close="isAddModalOpen = false">
      <!-- Form -->
    </BaseModal>

    <!-- Delete Confirm -->
    <ConfirmDialog :is-open="isDeleteConfirmOpen" @confirm="deleteItem" @cancel="isDeleteConfirmOpen = false" />
  </div>
</template>
```

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

## Архитектурные решения

- **Composables** для переиспользуемой логики (не дублировать код)
- **UI Kit** для всех визуальных компонентов (единообразие)
- **TypeScript** везде (строгая типизация)
- **Lazy loading** для routes и больших компонентов
- **Mobile-first** подход в стилях

---

Удачи в разработке! 🚀
