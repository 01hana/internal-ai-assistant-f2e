import type {
  AssistantApiRequestOptions,
  AssistantHistoryQuery,
  AssistantSession,
  AssistantSessionId,
  AssistantSuccessEnvelope,
  CreateAssistantSessionRequest,
  SessionMessagesResponse,
} from '../../types/assistant'
import {
  createHttpClient,
  type HttpClient,
} from '..'

export interface AssistantServiceOptions {
  httpClient?: HttpClient
}

function toRequestHeaders(
  identityHeaders: AssistantApiRequestOptions['identityHeaders'],
): Headers {
  const headers = new Headers()

  for (const [key, value] of Object.entries(identityHeaders)) {
    if (value !== undefined) {
      headers.set(key, value)
    }
  }

  return headers
}

export class AssistantService {
  private readonly httpClient: HttpClient

  constructor(options: AssistantServiceOptions = {}) {
    this.httpClient = options.httpClient ?? createHttpClient()
  }

  createSession(
    request: CreateAssistantSessionRequest,
    options: AssistantApiRequestOptions,
  ): Promise<AssistantSuccessEnvelope<AssistantSession>> {
    return this.httpClient.request({
      method: 'POST',
      path: 'assistant/sessions',
      body: request,
      headers: toRequestHeaders(options.identityHeaders),
      signal: options.signal,
    })
  }

  getSession(
    sessionId: AssistantSessionId,
    options: AssistantApiRequestOptions,
  ): Promise<AssistantSuccessEnvelope<AssistantSession>> {
    return this.httpClient.request({
      method: 'GET',
      path: `assistant/sessions/${encodeURIComponent(sessionId)}`,
      headers: toRequestHeaders(options.identityHeaders),
      signal: options.signal,
    })
  }

  getSessionMessages(
    sessionId: AssistantSessionId,
    query: AssistantHistoryQuery,
    options: AssistantApiRequestOptions,
  ): Promise<AssistantSuccessEnvelope<SessionMessagesResponse>> {
    return this.httpClient.request({
      method: 'GET',
      path: `assistant/sessions/${encodeURIComponent(sessionId)}/messages`,
      query: {
        limit: query.limit,
        cursor: query.cursor,
        order: query.order ?? 'asc',
      },
      headers: toRequestHeaders(options.identityHeaders),
      signal: options.signal,
    })
  }
}
