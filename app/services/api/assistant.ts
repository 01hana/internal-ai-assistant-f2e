import type {
  AssistantApiRequestOptions,
  AssistantMessageId,
  AssistantHistoryQuery,
  AssistantSession,
  AssistantSessionId,
  AssistantSuccessEnvelope,
  CreateAssistantSessionRequest,
  FeedbackRequest,
  SendAssistantMessageRequest,
  SessionMessagesResponse,
} from '../../types/assistant'
import {
  createHttpClient,
  type HttpClient,
} from '..'

export interface AssistantServiceOptions {
  httpClient?: HttpClient
}

interface AssistantFeedbackAcceptedData {
  feedbackEventId: string
  messageId: AssistantMessageId
  rating: FeedbackRequest['rating']
  intent: FeedbackRequest['intent']
  reviewItemId?: string | null
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
      silent: options.silent,
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
      silent: options.silent,
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
      silent: options.silent,
    })
  }

  sendMessageStream(
    sessionId: AssistantSessionId,
    request: SendAssistantMessageRequest,
    options: AssistantApiRequestOptions,
  ): Promise<Response> {
    const headers = toRequestHeaders(options.identityHeaders)
    headers.set('accept', 'text/event-stream')

    return this.httpClient.stream({
      method: 'POST',
      path: `assistant/sessions/${encodeURIComponent(sessionId)}/messages`,
      body: request,
      headers,
      signal: options.signal,
      silent: options.silent,
    })
  }

  submitFeedback(
    messageId: AssistantMessageId,
    request: FeedbackRequest,
    options: AssistantApiRequestOptions,
  ): Promise<AssistantSuccessEnvelope<AssistantFeedbackAcceptedData>> {
    return this.httpClient.request({
      method: 'POST',
      path: `assistant/messages/${encodeURIComponent(messageId)}/feedback`,
      body: request,
      headers: toRequestHeaders(options.identityHeaders),
      signal: options.signal,
      silent: options.silent,
    })
  }
}
