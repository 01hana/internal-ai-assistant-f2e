const ASSISTANT_IDENTITY_EXCHANGE_URL = '/assistant-identity/identity/exchange'
const ASSISTANT_TOKEN_EXPIRY_SAFETY_WINDOW_MS = 30_000
const CONNECTOR_CONTEXT_EXPIRY_SAFETY_WINDOW_MS = 15_000
const CONNECTOR_CONTEXT_REF_PATTERN = /^ccr_[A-Za-z0-9_-]{1,128}$/
const AUTHORIZATION_UNAVAILABLE_MESSAGE = 'Assistant authorization is unavailable'

type NativeAccessTokenAccessor = () => string | null | undefined
type Clock = () => number
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface AssistantIdentityTokenProviderDependencies {
  fetch: Fetcher
  getNativeAccessToken: NativeAccessTokenAccessor
  now: Clock
}

export interface AssistantIdentityTokenProvider {
  getAssistantAccessToken: (() => Promise<string>) & {
    getConnectorContextRef: () => Promise<string | undefined>
  }
  invalidate: () => void
}

interface CachedAssistantIdentity {
  canonicalToken: string
  canonicalTokenExpiresAt: number
  connectorContextExpiresAt?: number
  connectorContextRef?: string
  nativeToken: string
}

interface InFlightExchange {
  generation: number
  nativeToken: string
  promise: Promise<CachedAssistantIdentity>
}

interface BridgeExchangeResponse {
  accessToken: string
  connectorContextExpiresIn?: number
  connectorContextRef?: string
  expiresIn: number
  tokenType: 'Bearer'
}

function authorizationUnavailable(): Error {
  return new Error(AUTHORIZATION_UNAVAILABLE_MESSAGE)
}

function normalizeNativeToken(accessor: NativeAccessTokenAccessor): string {
  try {
    return accessor()?.trim() ?? ''
  }
  catch {
    throw authorizationUnavailable()
  }
}

function isBridgeExchangeResponse(value: unknown): value is BridgeExchangeResponse {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const response = value as Record<string, unknown>
  const baseResponseIsValid = typeof response.accessToken === 'string'
    && response.accessToken.trim().length > 0
    && response.tokenType === 'Bearer'
    && typeof response.expiresIn === 'number'
    && Number.isInteger(response.expiresIn)
    && response.expiresIn > 0

  if (!baseResponseIsValid) {
    return false
  }

  const hasConnectorContextRef = response.connectorContextRef !== undefined
  const hasConnectorContextExpiresIn = response.connectorContextExpiresIn !== undefined

  if (hasConnectorContextRef !== hasConnectorContextExpiresIn) {
    return false
  }

  if (!hasConnectorContextRef) {
    return true
  }

  return typeof response.connectorContextRef === 'string'
    && CONNECTOR_CONTEXT_REF_PATTERN.test(response.connectorContextRef.trim())
    && typeof response.connectorContextExpiresIn === 'number'
    && Number.isInteger(response.connectorContextExpiresIn)
    && response.connectorContextExpiresIn > 0
}

export function createAssistantIdentityTokenProvider(
  dependencies: AssistantIdentityTokenProviderDependencies,
): AssistantIdentityTokenProvider {
  let cache: CachedAssistantIdentity | null = null
  let generation = 0
  let inFlight: InFlightExchange | null = null

  const invalidate = () => {
    generation += 1
    cache = null
    inFlight = null
  }

  const resolveIdentity = async (requireConnectorContextRef: boolean): Promise<CachedAssistantIdentity> => {
    const nativeToken = normalizeNativeToken(dependencies.getNativeAccessToken)

    if (!nativeToken) {
      invalidate()
      throw authorizationUnavailable()
    }

    if (
      (cache !== null && cache.nativeToken !== nativeToken)
      || (inFlight !== null && inFlight.nativeToken !== nativeToken)
    ) {
      invalidate()
    }

    if (
      cache !== null
      && cache.nativeToken === nativeToken
      && dependencies.now() < cache.canonicalTokenExpiresAt - ASSISTANT_TOKEN_EXPIRY_SAFETY_WINDOW_MS
      && (
        !requireConnectorContextRef
        || (
          cache.connectorContextRef !== undefined
          && cache.connectorContextExpiresAt !== undefined
          && dependencies.now() < cache.connectorContextExpiresAt - CONNECTOR_CONTEXT_EXPIRY_SAFETY_WINDOW_MS
        )
      )
    ) {
      return cache
    }

    if (
      inFlight !== null
      && inFlight.nativeToken === nativeToken
      && inFlight.generation === generation
    ) {
      return inFlight.promise
    }

    const exchangeGeneration = generation
    const exchangePromise = dependencies.fetch(ASSISTANT_IDENTITY_EXCHANGE_URL, {
      headers: {
        Authorization: `Bearer ${nativeToken}`,
      },
      method: 'POST',
    })
      .then(async (response) => {
        if (response.status !== 200) {
          throw authorizationUnavailable()
        }

        const payload: unknown = await response.json()
        if (!isBridgeExchangeResponse(payload)) {
          throw authorizationUnavailable()
        }

        const currentNativeToken = normalizeNativeToken(dependencies.getNativeAccessToken)
        if (generation !== exchangeGeneration || currentNativeToken !== nativeToken) {
          throw authorizationUnavailable()
        }

        const resolvedAt = dependencies.now()
        const connectorContextRef = payload.connectorContextRef?.trim()
        const resolvedIdentity: CachedAssistantIdentity = {
          canonicalToken: payload.accessToken.trim(),
          canonicalTokenExpiresAt: resolvedAt + payload.expiresIn * 1_000,
          ...(connectorContextRef !== undefined && payload.connectorContextExpiresIn !== undefined
            ? {
                connectorContextExpiresAt: resolvedAt + payload.connectorContextExpiresIn * 1_000,
                connectorContextRef,
              }
            : {}),
          nativeToken,
        }
        cache = resolvedIdentity

        return resolvedIdentity
      })
      .catch(() => {
        throw authorizationUnavailable()
      })
      .finally(() => {
        if (inFlight?.promise === exchangePromise) {
          inFlight = null
        }
      })

    inFlight = {
      generation: exchangeGeneration,
      nativeToken,
      promise: exchangePromise,
    }

    return exchangePromise
  }

  const getAssistantAccessToken = Object.assign(
    async (): Promise<string> => (await resolveIdentity(false)).canonicalToken,
    {
      getConnectorContextRef: async (): Promise<string | undefined> => (
        await resolveIdentity(true)
      ).connectorContextRef,
    },
  )

  return {
    getAssistantAccessToken,
    invalidate,
  }
}
