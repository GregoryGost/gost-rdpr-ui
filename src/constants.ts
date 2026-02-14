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

/**
 * IPs Lists texts
 */
export const IPS_LISTS_TEXTS = {
  PAGE_TITLE: 'Списки IP Адресов',
  PAGE_DESCRIPTION: 'Управление списками IP адресов для автоматической загрузки и парсинга',
  ADD_BUTTON: 'Добавить Список',
  SEARCH_PLACEHOLDER: 'Поиск по названию или URL...',
  EMPTY_MESSAGE: 'Списки IP адресов не найдены',
  MODAL_TITLE: 'Добавить Список IP Адресов',
  DELETE_TITLE: 'Удалить Список IP Адресов',
  DELETE_MESSAGE: 'Вы уверены, что хотите удалить этот список IP адресов? Это действие нельзя отменить.',
  LABEL_NAME: 'Название списка',
  LABEL_URL: 'URL списка',
  LABEL_DESCRIPTION: 'Описание',
  PLACEHOLDER_NAME: 'google-ips-list',
  PLACEHOLDER_URL: 'https://example.com/path/ips.txt',
  PLACEHOLDER_DESCRIPTION: 'Описание списка IP адресов',
  HINT_URL: 'Ссылка на текстовый файл с IP адресами (по одному на строку)',
  COLUMN_IPS_COUNT: 'IP адресов',
  COLUMN_IPV4_COUNT: 'IPv4',
  COLUMN_IPV6_COUNT: 'IPv6',
  COLUMN_ATTEMPTS: 'Попытки',
  VALIDATION_NAME_REQUIRED: 'Название должно содержать минимум 3 символа',
  VALIDATION_URL_REQUIRED: 'URL должен содержать минимум 5 символов',
  VALIDATION_URL_INVALID: 'Некорректный формат URL',
  SUCCESS_CREATED: 'успешно добавлен',
  SUCCESS_DELETED: 'успешно удален',
  SEARCH_FOUND_PREFIX: 'Найдено списков:',
  SEARCH_NOT_FOUND_PREFIX: 'По запросу',
  LIST_PREFIX: 'Список IP адресов',
  FILTER_ALL: 'Все',
  FILTER_SUCCESS: 'Без ошибок',
  FILTER_ERRORS: 'С ошибками',
  FILTER_CRITICAL: 'Критические',
  STATS_TOTAL_HINT: 'Общее количество списков IP адресов в системе',
  STATS_SUCCESS_HINT: 'Списки успешно загружены без ошибок (attempts = 0)',
  STATS_ERRORS_HINT: 'Списки с ошибками загрузки, но ещё не критичные (0 < attempts < 3)',
  STATS_CRITICAL_HINT: 'Списки с критическими ошибками, требуют внимания (attempts ≥ 3)',
}

/**
 * IPs texts
 */
export const IPS_TEXTS = {
  PAGE_TITLE: 'IP Адреса',
  PAGE_DESCRIPTION: 'Управление IP адресами для RouterOS конфигураций',
  ADD_BUTTON: 'Добавить IP Адрес',
  SEARCH_PLACEHOLDER: 'Поиск по IP адресу...',
  EMPTY_MESSAGE: 'IP адреса не найдены',
  MODAL_TITLE: 'Добавить IP Адрес',
  DELETE_TITLE: 'Удалить IP Адрес',
  DELETE_MESSAGE: 'Вы уверены, что хотите удалить этот IP адрес? Это действие нельзя отменить.',
  LABEL_ADDR: 'IP адрес',
  LABEL_LIST_ID: 'ID списка IP',
  LABEL_DOMAIN_ID: 'ID домена',
  LABEL_ROS_COMMENT: 'Комментарий RoS',
  PLACEHOLDER_ADDR: '192.168.1.1 или 2001:db8::1',
  PLACEHOLDER_LIST_ID: '1',
  PLACEHOLDER_DOMAIN_ID: '1',
  PLACEHOLDER_ROS_COMMENT: 'Комментарий для RouterOS',
  HINT_ADDR: 'Введите IPv4 или IPv6 адрес',
  HINT_LIST_ID: 'ID списка IP адресов (опционально)',
  HINT_DOMAIN_ID: 'ID домена (опционально, по умолчанию 0)',
  HINT_ROS_COMMENT: 'Комментарий для RouterOS конфигурации (опционально)',
  COLUMN_TYPE: 'Тип',
  COLUMN_ADDR: 'IP адрес',
  COLUMN_IP_LIST: 'Список IP',
  COLUMN_DOMAIN: 'Домен',
  COLUMN_ROS_COMMENT: 'Комментарий RoS',
  VALIDATION_ADDR_REQUIRED: 'IP адрес обязателен для заполнения',
  VALIDATION_ADDR_INVALID: 'Некорректный формат IP адреса',
  SUCCESS_CREATED: 'успешно добавлен',
  SUCCESS_DELETED: 'успешно удален',
  SEARCH_FOUND_PREFIX: 'Найдено IP адресов:',
  SEARCH_NOT_FOUND_PREFIX: 'По запросу',
  IP_PREFIX: 'IP адрес',
  FILTER_ALL: 'Все',
  FILTER_IPV4: 'IPv4',
  FILTER_IPV6: 'IPv6',
  FILTER_WITH_LIST: 'Со списком',
  FILTER_WITHOUT_LIST: 'Без списка',
  FILTER_WITH_DOMAIN: 'С доменом',
  FILTER_WITHOUT_DOMAIN: 'Без домена',
  STATS_TOTAL_HINT: 'Общее количество IP адресов в системе',
  STATS_IPV4_HINT: 'Количество IPv4 адресов (type = 4)',
  STATS_IPV6_HINT: 'Количество IPv6 адресов (type = 6)',
  STATS_WITH_LIST_HINT: 'IP адреса, связанные со списками IP',
  STATS_WITH_DOMAIN_HINT: 'IP адреса, связанные с доменами',
}
