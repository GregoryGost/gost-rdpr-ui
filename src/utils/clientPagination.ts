import type { PaginatedResponse } from '@/api/types/common'
import { PAGINATION } from '@/constants'

export interface RequiredPaginationParams {
  limit: number
  offset: number
}

export interface ClientPageFetcher<T, R extends PaginatedResponse<T> = PaginatedResponse<T>> {
  (params: RequiredPaginationParams): Promise<R>
}

export interface ClientFilteredPaginationOptions {
  forceClientPagination?: boolean
  knownTotal?: number
  stopWhenPageFilled?: boolean
}

interface ClientPageState<T> {
  payload: T[]
  total: number
}

type ResponseWithQueryTotal<T> = PaginatedResponse<T> & {
  total_query?: number
}

const CLIENT_FETCH_LIMIT = Math.max(...PAGINATION.PAGE_SIZE_OPTIONS)
const CLIENT_FETCH_CONCURRENCY = 8

const getDeclaredTotal = <T, R extends ResponseWithQueryTotal<T>>(response: R): number => {
  return typeof response.total_query === 'number' ? response.total_query : response.total
}

const getResponseLimit = <T, R extends PaginatedResponse<T>>(response: R): number => {
  return response.limit > 0 ? response.limit : CLIENT_FETCH_LIMIT
}

const appendPageItems = <T>(
  state: ClientPageState<T>,
  source: T[],
  params: RequiredPaginationParams,
  filterItem: (item: T) => boolean,
) => {
  source.forEach((item) => {
    if (!filterItem(item)) return

    if (state.total >= params.offset && state.payload.length < params.limit) {
      state.payload.push(item)
    }

    state.total += 1
  })
}

const createClientResponse = <T, R extends ResponseWithQueryTotal<T>>(
  response: R,
  state: ClientPageState<T>,
  params: RequiredPaginationParams,
  knownTotal: number | undefined,
): R => {
  const total = knownTotal ?? state.total
  const result = {
    ...response,
    limit: params.limit,
    offset: params.offset,
    count: state.payload.length,
    total,
    payload: state.payload,
  } as R

  if ('total_query' in result) {
    const resultWithQueryTotal = result as R & { total_query: number }
    resultWithQueryTotal.total_query = total
  }

  return result
}

/**
 * Load enough backend pages to apply client-only filters before pagination.
 *
 * Some API endpoints filter rows but still return an unfiltered total, and
 * other filters exist only in the UI. This helper keeps table rows and
 * pagination totals based on the same filtered dataset.
 */
export const loadClientFilteredPage = async <T, R extends ResponseWithQueryTotal<T> = PaginatedResponse<T>>(
  fetchPage: ClientPageFetcher<T, R>,
  params: RequiredPaginationParams,
  filterItem: (item: T) => boolean = () => true,
  options: boolean | ClientFilteredPaginationOptions = true,
): Promise<R> => {
  const paginationOptions =
    typeof options === 'boolean'
      ? {
          forceClientPagination: options,
        }
      : {
          forceClientPagination: true,
          ...options,
        }

  if (!paginationOptions.forceClientPagination) return fetchPage(params)

  const state: ClientPageState<T> = {
    payload: [],
    total: 0,
  }

  let latestResponse = await fetchPage({
    limit: CLIENT_FETCH_LIMIT,
    offset: 0,
  })

  appendPageItems(state, latestResponse.payload, params, filterItem)

  const declaredTotal = getDeclaredTotal(latestResponse)
  let nextOffset = CLIENT_FETCH_LIMIT
  let shouldStop = latestResponse.payload.length < getResponseLimit(latestResponse)
  shouldStop =
    shouldStop ||
    Boolean(
      paginationOptions.stopWhenPageFilled &&
      paginationOptions.knownTotal !== undefined &&
      (state.total >= params.offset + params.limit || state.total >= paginationOptions.knownTotal),
    )

  while (!shouldStop) {
    const offsets: number[] = []

    for (let index = 0; index < CLIENT_FETCH_CONCURRENCY; index += 1) {
      if (declaredTotal > 0 && nextOffset >= declaredTotal) break

      offsets.push(nextOffset)
      nextOffset += CLIENT_FETCH_LIMIT
    }

    if (offsets.length === 0) break

    const responses = await Promise.all(
      offsets.map((pageOffset) =>
        fetchPage({
          limit: CLIENT_FETCH_LIMIT,
          offset: pageOffset,
        }),
      ),
    )

    for (const response of responses) {
      latestResponse = response

      if (response.payload.length === 0) {
        shouldStop = true
        break
      }

      appendPageItems(state, response.payload, params, filterItem)

      if (
        response.payload.length < getResponseLimit(response) ||
        (paginationOptions.stopWhenPageFilled &&
          paginationOptions.knownTotal !== undefined &&
          (state.total >= params.offset + params.limit || state.total >= paginationOptions.knownTotal))
      ) {
        shouldStop = true
        break
      }
    }
  }

  return createClientResponse(latestResponse, state, params, paginationOptions.knownTotal)
}
