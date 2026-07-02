interface HttpErrorEnvelope {
  requestId: string
  error: {
    code: string
    message: string
    statusCode?: number
  }
}

export type HttpQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined

export interface HttpClientOptions {
  baseURL?: string
  headers?: HeadersInit
  fetcher?: typeof fetch
}

export interface HttpRequestOptions {
  path: string
  method?: string
  query?: Readonly<Record<string, HttpQueryValue>>
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
}

export interface HttpClient {
  request<TResponse>(
    options: HttpRequestOptions,
  ): Promise<TResponse>
}

export interface HttpClientErrorDetails {
  requestId?: string
  code?: string
  statusCode?: number
}

export class HttpClientError extends Error {
  readonly requestId?: string
  readonly code?: string
  readonly statusCode?: number

  constructor(message: string, details: HttpClientErrorDetails = {}) {
    super(message)
    this.name = 'HttpClientError'
    this.requestId = details.requestId
    this.code = details.code
    this.statusCode = details.statusCode
  }
}

function normalizeRequestUrl(baseURL: string, path: string): string {
  const normalizedBaseURL = baseURL.replace(/\/+$/, '')
  const normalizedPath = path.replace(/^\/+/, '')
  return `${normalizedBaseURL}/${normalizedPath}`
}

function appendQuery(
  requestUrl: string,
  query?: HttpRequestOptions['query'],
): string {
  if (!query) {
    return requestUrl
  }

  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) {
      searchParams.set(key, String(value))
    }
  }

  const serializedQuery = searchParams.toString()
  return serializedQuery ? `${requestUrl}?${serializedQuery}` : requestUrl
}

function mergeHeaders(
  defaultHeaders?: HeadersInit,
  requestHeaders?: HeadersInit,
): Headers {
  const headers = new Headers(defaultHeaders)
  new Headers(requestHeaders).forEach((value, key) => {
    headers.set(key, value)
  })
  return headers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHttpErrorEnvelope(value: unknown): value is HttpErrorEnvelope {
  if (!isRecord(value) || typeof value.requestId !== 'string') {
    return false
  }

  const error = value.error
  return isRecord(error)
    && typeof error.code === 'string'
    && typeof error.message === 'string'
    && (
      error.statusCode === undefined
      || typeof error.statusCode === 'number'
    )
}

function toSafeResponseError(response: Response): HttpClientError {
  return new HttpClientError('The service could not complete the request.', {
    code: 'http_error',
    statusCode: response.status,
  })
}

export function createHttpClient(
  options: HttpClientOptions = {},
): HttpClient {
  const baseURL = options.baseURL ?? '/api/v1'
  const fetcher = options.fetcher ?? globalThis.fetch

  return {
    async request<TResponse>(
      requestOptions: HttpRequestOptions,
    ): Promise<TResponse> {
      const method = (requestOptions.method ?? 'GET').toUpperCase()
      const headers = mergeHeaders(
        options.headers,
        requestOptions.headers,
      )
      const supportsBody = method !== 'GET' && method !== 'HEAD'
      const hasBody = supportsBody && requestOptions.body !== undefined

      if (hasBody && !headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }

      const url = appendQuery(
        normalizeRequestUrl(baseURL, requestOptions.path),
        requestOptions.query,
      )

      let response: Response

      try {
        response = await fetcher(url, {
          method,
          headers,
          body: hasBody
            ? JSON.stringify(requestOptions.body)
            : undefined,
          signal: requestOptions.signal,
        })
      }
      catch {
        throw new HttpClientError('The service is currently unreachable.', {
          code: 'network_error',
        })
      }

      let payload: unknown

      try {
        payload = await response.json()
      }
      catch {
        throw toSafeResponseError(response)
      }

      if (isHttpErrorEnvelope(payload)) {
        throw new HttpClientError(payload.error.message, {
          requestId: payload.requestId,
          code: payload.error.code,
          statusCode: payload.error.statusCode,
        })
      }

      if (!response.ok) {
        throw toSafeResponseError(response)
      }

      return payload as TResponse
    },
  }
}
