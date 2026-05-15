export type SortDirection = 'asc' | 'desc' | null
export type SortType = 'default' | 'ip'
export type TableColumnFilters = Record<string, string>

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  sortType?: SortType
  filterable?: boolean
  filterPlaceholder?: string
  filterValue?: (row: T, value: unknown) => string
}

export const getColumnKey = <T>(column: TableColumn<T>): string => String(column.key)

export const isFilterableColumn = <T>(column: TableColumn<T>): boolean => {
  return column.filterable !== false && getColumnKey(column) !== 'actions'
}

export const normalizeFilterValue = (value: unknown): string => {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(' ')
  return String(value)
}

export const getFilterValue = <T extends object>(row: T, column: TableColumn<T>): string => {
  const value = (row as Record<string, unknown>)[getColumnKey(column)]
  return column.filterValue ? column.filterValue(row, value) : normalizeFilterValue(value)
}

export const hasColumnFilters = (filters: TableColumnFilters): boolean => {
  return Object.values(filters).some((value) => value.trim().length > 0)
}

export const matchesColumnFilters = <T extends object>(
  row: T,
  columns: TableColumn<T>[],
  filters: TableColumnFilters,
): boolean => {
  return columns.every((column) => {
    const query = (filters[getColumnKey(column)] ?? '').trim().toLocaleLowerCase('ru')
    if (!isFilterableColumn(column) || query.length === 0) return true

    return getFilterValue(row, column).toLocaleLowerCase('ru').includes(query)
  })
}
