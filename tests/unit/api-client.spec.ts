import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, apiRequestText, ApiError, NetworkError } from '@/api/client'

/** Gives every transport scenario a virtual timeout clock; fetch is always replaced locally. */
beforeEach(() => {
  vi.useFakeTimers()
})

/** Verifies the real transport while replacing only the network boundary. */
describe('apiRequest', () => {
  /** URL prefix, custom headers, JSON body and parsed response survive the transport boundary. */
  it('sends the requested URL, method, headers and body and releases its timeout', async () => {
    /** fetchMock returns a synthetic successful JSON response without network IO. */
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"result":"accepted"}'))
    vi.stubGlobal('fetch', fetchMock)
    expect(
      await apiRequest('/domains', {
        method: 'POST',
        headers: { 'X-Request-Test': 'isolated' },
        body: '[{"domain":"example.test"}]',
      }),
    ).toEqual({ result: 'accepted' })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      '/api/domains',
      expect.objectContaining({
        method: 'POST',
        body: '[{"domain":"example.test"}]',
        signal: expect.any(AbortSignal),
      }),
    )
    /** sentHeaders checks effective HTTP header values without requiring an internal HeadersInit representation. */
    const sentHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(sentHeaders.get('Content-Type')).toBe('application/json')
    expect(sentHeaders.get('X-Request-Test')).toBe('isolated')
    expect(vi.getTimerCount()).toBe(0)
  })

  /** Caller-provided content type takes precedence over the transport's JSON default. */
  it.each([
    { kind: 'plain record', headers: { 'content-type': 'application/problem+json' } },
    { kind: 'Headers instance', headers: new Headers({ 'content-type': 'application/problem+json' }) },
    { kind: 'tuple array', headers: [['content-type', 'application/problem+json']] as [string, string][] },
  ])('preserves an explicit content type from a $kind', async ({ headers }) => {
    /** fetchMock records options while returning an empty JSON object. */
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    await apiRequest('/commands', { headers })
    /** sentHeaders applies standard case-insensitive header lookup to the actual outgoing options. */
    const sentHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(sentHeaders.get('Content-Type')).toBe('application/problem+json')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/commands')
  })

  /** RequestInit accepts Headers objects and tuple arrays as well as plain records. */
  it.each([
    { kind: 'Headers instance', headers: new Headers({ 'X-Request-Test': 'isolated' }) },
    { kind: 'tuple array', headers: [['X-Request-Test', 'isolated']] as [string, string][] },
  ])('preserves caller headers from a $kind', async ({ headers }) => {
    /** fetchMock captures the effective request options while returning a synthetic JSON response. */
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    await apiRequest('/health', { headers })
    /** sentHeaders interprets the actual outgoing value using the standard HeadersInit contract. */
    const sentHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(sentHeaders.get('X-Request-Test')).toBe('isolated')
    expect(sentHeaders.get('Content-Type')).toBe('application/json')
    expect(new Headers(headers).has('Content-Type')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  /** HTTP status and useful backend text must reach callers as ApiError, including non-JSON fallback. */
  it.each([
    ['{"error":"Некорректный домен"}', 'Некорректный домен'],
    ['{"message":"Запрос отклонён"}', 'Запрос отклонён'],
    ['{}', 'Request failed'],
    ['<html>gateway failure</html>', 'Unknown error'],
  ])('preserves an HTTP failure for response %s', async (body, message) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 422 })))
    /** failure is the rejected transport result; its class, status and message are checked independently. */
    const failure = apiRequest('/domains')
    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({ status: 422, message })
    expect(vi.getTimerCount()).toBe(0)
  })

  /** Network rejection and unexpected exceptions use distinct user-facing connection messages. */
  it.each([
    [new TypeError('Failed to fetch'), 'Сервер недоступен. Проверьте подключение к сети'],
    [new Error('unexpected transport failure'), 'Неизвестная ошибка подключения'],
    [Object.assign(new Error('aborted'), { name: 'AbortError' }), 'Превышено время ожидания ответа от сервера'],
  ])('classifies %s and releases its timeout', async (error, message) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(error))
    /** failure contains the caller-visible network error after classification. */
    const failure = apiRequest('/health')
    await expect(failure).rejects.toBeInstanceOf(NetworkError)
    await expect(failure).rejects.toMatchObject({ message })
    expect(vi.getTimerCount()).toBe(0)
  })

  /** A fetch observing AbortSignal must abort at the configured deadline, never before it. */
  it('aborts a pending fetch at the timeout boundary and clears the timer', async () => {
    /** fetchMock waits for the transport signal and rejects only when that signal aborts. */
    const fetchMock = vi.fn<typeof fetch>(
      (_input, options) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(Object.assign(new Error('timeout'), { name: 'AbortError' })),
            {
              once: true,
            },
          )
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    /** outcome captures the rejected value immediately so assertion failures cannot become unhandled rejections. */
    const outcome = apiRequest('/health', undefined, 250).catch((error: unknown) => error)
    /** signal is the actual AbortSignal supplied to the mocked fetch. */
    const signal = fetchMock.mock.calls[0]?.[1]?.signal
    await vi.advanceTimersByTimeAsync(249)
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toMatchObject({ name: 'NetworkError', message: 'Превышено время ожидания ответа от сервера' })
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  /** Malformed successful JSON is observable as rejection and must not leave the request deadline scheduled. */
  it('releases its timer when a successful response contains invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('invalid json')))
    await expect(apiRequest('/health')).rejects.toBeInstanceOf(SyntaxError)
    expect(vi.getTimerCount()).toBe(0)
  })
})

/** HTTP failure releases the response body before another metrics request can start. */
describe('apiRequestText', () => {
  /** An HTTP error can arrive before the body, so the request signal must abort even when fetch has resolved. */
  it('aborts an unread error body and preserves its HTTP status', async () => {
    /** response provides the error headers while its synthetic body remains readable. */
    const response = new Response(new ReadableStream<Uint8Array>(), { status: 503 })
    /** fetchMock exposes the actual signal passed to fetch so the cancellation is observable. */
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequestText('/metrics', new AbortController().signal)).rejects.toMatchObject({ status: 503 })
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
