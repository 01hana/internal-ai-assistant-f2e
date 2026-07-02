import type {
  AssistantMessageId,
  AssistantRequestId,
  AssistantSessionId,
} from './contracts'

export interface AssistantSuccessEnvelope<TData> {
  requestId: AssistantRequestId
  data: TData
}

export interface AssistantErrorEnvelope {
  requestId: AssistantRequestId
  error: {
    code: string
    message: string
    statusCode?: number
  }
}

export type AssistantApiEnvelope<TData> =
  | AssistantSuccessEnvelope<TData>
  | AssistantErrorEnvelope

export interface AssistantIdentityHeaders {
  'x-request-id'?: AssistantRequestId
  'x-actor-id': string
  'x-organization-id': string
  'x-host-app': string
  'x-role': string
  'x-permission-scopes'?: string
}

export interface ResolvedAssistantIdentityHeaders
  extends AssistantIdentityHeaders {
  'x-request-id': AssistantRequestId
}

export interface AssistantRequestMetadata {
  requestId: AssistantRequestId
  sessionId?: AssistantSessionId
  messageId?: AssistantMessageId
}

export interface AssistantApiRequestOptions {
  identityHeaders: AssistantIdentityHeaders
  signal?: AbortSignal
  silent?: boolean
}

export type AssistantPaginationCursor = string | null

export interface AssistantPaginationState {
  nextCursor: AssistantPaginationCursor
}

export type AssistantSafeErrorCode = string

export interface AssistantDisplayError {
  requestId?: AssistantRequestId
  code: AssistantSafeErrorCode
  safeMessage: string
  statusCode?: number
  retryable: boolean
}
