import type { TableColumn, TableColumnFilters } from './columnFilters'

/** Describes the visible rows, columns and request state published by the page. */
export interface DataTableProps<T> {
  /** Rows available before optional local filtering and sorting. */
  data: T[]
  /** Column labels, data keys and supported interactions in display order. */
  columns: TableColumn<T>[]
  /** Whether the latest load is awaiting data. */
  isLoading?: boolean
  /** Whether the latest load failed instead of returning an empty page. */
  hasError?: boolean
  /** Status text shown while a saved change is waiting to appear in the table. */
  loadingMessage?: string
  /** Text shown when a successful load produces no matching rows. */
  emptyMessage?: string
  /** Enables a search field in each filterable column. */
  isColumnFilteringEnabled?: boolean
  /** Filter values owned by the page when filtering spans API pages. */
  columnFilters?: TableColumnFilters
  /** Key of the cell that exposes a keyboard action for opening its row. */
  rowActionColumn?: string
}
