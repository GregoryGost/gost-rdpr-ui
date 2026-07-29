import type { TableColumn, TableColumnFilters } from './columnFilters'

export interface DataTableProps<T> {
  data: T[]
  columns: TableColumn<T>[]
  isLoading?: boolean
  emptyMessage?: string
  isColumnFilteringEnabled?: boolean
  columnFilters?: TableColumnFilters
}
