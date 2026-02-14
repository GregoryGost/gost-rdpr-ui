/**
 * Application constants
 */
export const APP_NAME = 'GOST-RDPR'
export const APP_TITLE = 'GOST-RDPR Ui'
export const APP_DESCRIPTION = 'Admin Panel'
export const APP_AUTHOR = 'GregoryGost'

/**
 * Storage keys
 */
export const DARK_MODE_KEY = 'darkMode'

/**
 * Author links
 */
export const AUTHOR_GITHUB = 'https://github.com/GregoryGost'
export const AUTHOR_BLOG = 'https://gregory-gost.ru'
export const AUTHOR_TELEGRAM = 'https://t.me/gregorygost'

/**
 * Pagination settings
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
}

/**
 * Search settings
 */
export const SEARCH = {
  MIN_LENGTH: 3,
}

/**
 * Validation constants
 */
export const VALIDATION = {
  MIN_NAME_LENGTH: 3,
  MIN_URL_LENGTH: 5,
}

/**
 * Error handling settings
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Ошибка сетевого соединения',
  UNKNOWN_ERROR: 'Произошла непредвиденная ошибка',
  API_ERROR: 'Ошибка при выполнении запроса',
  VALIDATION_ERROR: 'Ошибка валидации данных',
}

/**
 * UI texts - Common
 */
export const UI_TEXTS = {
  ACTIONS: 'Действия',
  CREATED: 'Создано',
  DESCRIPTION: 'Описание',
  ID: 'ID',
  NAME: 'Название',
  URL: 'URL',
  CANCEL: 'Отмена',
  CREATE: 'Создать',
  DELETE: 'Удалить',
  SEARCH_RESULTS: 'Результаты поиска',
  NOTHING_FOUND: 'ничего не найдено',
}

/**
 * Domains Lists texts
 */
export const DOMAINS_LISTS_TEXTS = {
  PAGE_TITLE: 'Списки Доменов',
  PAGE_DESCRIPTION: 'Управление списками доменов для автоматической загрузки и парсинга',
  ADD_BUTTON: 'Добавить Список',
  SEARCH_PLACEHOLDER: 'Поиск по названию или URL...',
  EMPTY_MESSAGE: 'Списки доменов не найдены',
  MODAL_TITLE: 'Добавить Список Доменов',
  DELETE_TITLE: 'Удалить Список Доменов',
  DELETE_MESSAGE: 'Вы уверены, что хотите удалить этот список доменов? Это действие нельзя отменить.',
  LABEL_NAME: 'Название списка',
  LABEL_URL: 'URL списка',
  LABEL_DESCRIPTION: 'Описание',
  PLACEHOLDER_NAME: 'voice-domains-list',
  PLACEHOLDER_URL: 'https://example.com/path/domains.txt',
  PLACEHOLDER_DESCRIPTION: 'Описание списка доменов',
  HINT_URL: 'Ссылка на текстовый файл с доменами (по одному на строку)',
  COLUMN_DOMAINS_COUNT: 'Доменов',
  COLUMN_ATTEMPTS: 'Попытки',
  VALIDATION_NAME_REQUIRED: 'Название должно содержать минимум 3 символа',
  VALIDATION_URL_REQUIRED: 'URL должен содержать минимум 5 символов',
  VALIDATION_URL_INVALID: 'Некорректный формат URL',
  SUCCESS_CREATED: 'успешно добавлен',
  SUCCESS_DELETED: 'успешно удален',
  SEARCH_FOUND_PREFIX: 'Найдено списков:',
  SEARCH_NOT_FOUND_PREFIX: 'По запросу',
  LIST_PREFIX: 'Список доменов',
  FILTER_ALL: 'Все',
  FILTER_SUCCESS: 'Без ошибок',
  FILTER_ERRORS: 'С ошибками',
  FILTER_CRITICAL: 'Критические',
  STATS_TOTAL_HINT: 'Общее количество списков доменов в системе',
  STATS_SUCCESS_HINT: 'Списки успешно загружены без ошибок (attempts = 0)',
  STATS_ERRORS_HINT: 'Списки с ошибками загрузки, но ещё не критичные (0 < attempts < 3)',
  STATS_CRITICAL_HINT: 'Списки с критическими ошибками, требуют внимания (attempts ≥ 3)',
}
