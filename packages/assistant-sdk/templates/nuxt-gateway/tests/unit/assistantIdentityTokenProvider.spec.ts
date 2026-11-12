import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

type NativeTokenAccessor = () => string | null | undefined
type Clock = () => number
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type AssistantAccessTokenResolver = (() => Promise<string>) & {
  getConnectorContextRef: () => Promise<string | undefined>
}

interface AssistantIdentityTokenProvider {
  getAssistantAccessToken: AssistantAccessTokenResolver
  invalidate: () => void
}

interface AssistantIdentityTokenProviderDependencies {
  fetch: Fetcher
  getNativeAccessToken: NativeTokenAccessor
  now: Clock
}

type CreateAssistantIdentityTokenProvider = (
  dependencies: AssistantIdentityTokenProviderDependencies,
) => AssistantIdentityTokenProvider

const productionModuleUrl = new URL(
  '../../composables/assistant/assistantIdentityTokenProvider.ts',
  import.meta.url,
)
const missingProductionBehavior = 'PRODUCTION_ASSISTANT_IDENTITY_TOKEN_PROVIDER_NOT_IMPLEMENTED'
const nativeFixture = 'native-fixture'
const canonicalFixture = 'canonical-fixture'
const connectorContextRefFixture = 'ccr_reference-fixture'

async function loadProductionFactory(): Promise<CreateAssistantIdentityTokenProvider> {
  try {
    const module = await import(/* @vite-ignore */ productionModuleUrl.href) as {
      createAssistantIdentityTokenProvider?: CreateAssistantIdentityTokenProvider
    }

    if (typeof module.createAssistantIdentityTokenProvider === 'function') {
      return module.createAssistantIdentityTokenProvider
    }
  }
  catch {
    // The explicit error below is the expected RED until T006 creates the module.
  }

  throw new Error(missingProductionBehavior)
}

function bridgeResponse(overrides: Record<string, unknown> = {}, status = 200) {
  return new Response(JSON.stringify({
    accessToken: canonicalFixture,
    expiresIn: 300,
    tokenType: 'Bearer',
    ...overrides,
  }), {
    headers: { 'content-type': 'application/json' },
    status,
  })
}

function bridgeResponseWithReference(overrides: Record<string, unknown> = {}, status = 200) {
  return bridgeResponse({
    connectorContextExpiresIn: 120,
    connectorContextRef: connectorContextRefFixture,
    ...overrides,
  }, status)
}

async function createSubject(options: {
  fetch?: Fetcher
  getNativeAccessToken?: NativeTokenAccessor
  now?: Clock
} = {}) {
  const createProvider = await loadProductionFactory()
  const fetch = options.fetch ?? vi.fn(async () => bridgeResponse())

  return {
    fetch,
    provider: createProvider({
      fetch,
      getNativeAccessToken: options.getNativeAccessToken ?? (() => nativeFixture),
      now: options.now ?? (() => 0),
    }),
  }
}

function requestAuthorization(init?: RequestInit) {
  return new Headers(init?.headers).get('Authorization')
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Assistant identity token provider contract (T004 Tests First)', () => {
  it('sends the native token only to the same-origin Bridge exchange route', async () => {
    const fetch = vi.fn<Fetcher>(async () => bridgeResponse())
    const { provider } = await createSubject({ fetch })

    await expect(provider.getAssistantAccessToken()).resolves.toBe(canonicalFixture)
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0]?.[0]).toBe('/assistant-identity/identity/exchange')
    expect(requestAuthorization(fetch.mock.calls[0]?.[1])).toBe(`Bearer ${nativeFixture}`)
  })

  it('uses POST and does not place the native token in a request body', async () => {
    const fetch = vi.fn<Fetcher>(async () => bridgeResponse())
    const { provider } = await createSubject({ fetch })

    await provider.getAssistantAccessToken()

    const init = fetch.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeUndefined()
    expect(JSON.stringify(init ?? {})).not.toContain(`"${nativeFixture}"`)
  })

  it.each([null, undefined, '', '   '])(
    'fails closed before Bridge fetch when the native token is unavailable (%s)',
    async (nativeToken) => {
      const fetch = vi.fn(async () => bridgeResponse())
      const { provider } = await createSubject({
        fetch,
        getNativeAccessToken: () => nativeToken,
      })

      await expect(provider.getAssistantAccessToken()).rejects.toThrow()
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it('fails closed when Bridge returns a non-200 status', async () => {
    const { provider } = await createSubject({ fetch: async () => bridgeResponse({}, 401) })

    await expect(provider.getAssistantAccessToken()).rejects.toThrow()
  })

  it.each([
    null,
    [],
    {},
    { accessToken: canonicalFixture },
    { accessToken: canonicalFixture, expiresIn: 300 },
  ])('fails closed for malformed Bridge response %#', async (body) => {
    const { provider } = await createSubject({
      fetch: async () => new Response(JSON.stringify(body), { status: 200 }),
    })

    await expect(provider.getAssistantAccessToken()).rejects.toThrow()
  })

  it.each(['bearer', 'BEARER', 'Basic', '', null])(
    'requires tokenType to be exactly Bearer (%s)',
    async (tokenType) => {
      const { provider } = await createSubject({
        fetch: async () => bridgeResponse({ tokenType }),
      })

      await expect(provider.getAssistantAccessToken()).rejects.toThrow()
    },
  )

  it.each([null, undefined, '', '   ', 123])(
    'rejects an invalid or blank canonical accessToken (%s)',
    async (accessToken) => {
      const { provider } = await createSubject({
        fetch: async () => bridgeResponse({ accessToken }),
      })

      await expect(provider.getAssistantAccessToken()).rejects.toThrow()
    },
  )

  it.each([null, undefined, 0, -1, 1.5, '300', Number.NaN])(
    'rejects invalid expiresIn (%s)',
    async (expiresIn) => {
      const { provider } = await createSubject({
        fetch: async () => bridgeResponse({ expiresIn }),
      })

      await expect(provider.getAssistantAccessToken()).rejects.toThrow()
    },
  )

  it('returns the canonical token rather than the native token', async () => {
    const { provider } = await createSubject()

    await expect(provider.getAssistantAccessToken()).resolves.toBe(canonicalFixture)
    await expect(provider.getAssistantAccessToken()).resolves.not.toBe(nativeFixture)
  })

  it('does not write canonical identity to localStorage', async () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: vi.fn(), removeItem: vi.fn(), setItem })
    const { provider } = await createSubject()

    await provider.getAssistantAccessToken()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('does not write canonical identity to sessionStorage', async () => {
    const setItem = vi.fn()
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(), removeItem: vi.fn(), setItem })
    const { provider } = await createSubject()

    await provider.getAssistantAccessToken()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('does not write canonical identity to cookies', async () => {
    const cookieSetter = vi.fn()
    vi.stubGlobal('document', Object.defineProperty({}, 'cookie', { set: cookieSetter }))
    const { provider } = await createSubject()

    await provider.getAssistantAccessToken()
    expect(cookieSetter).not.toHaveBeenCalled()
  })

  it('does not write canonical identity to IndexedDB', async () => {
    const indexedDB = { open: vi.fn() }
    vi.stubGlobal('indexedDB', indexedDB)
    const { provider } = await createSubject()

    await provider.getAssistantAccessToken()
    expect(indexedDB.open).not.toHaveBeenCalled()
  })

  it('does not decode JWTs and derives cache expiry from Bridge expiresIn', async () => {
    let now = 1_000
    const fetch = vi.fn(async () => bridgeResponse({ expiresIn: 60 }))
    const { provider } = await createSubject({ fetch, now: () => now })

    await provider.getAssistantAccessToken()
    now = 30_999
    await provider.getAssistantAccessToken()
    expect(fetch).toHaveBeenCalledOnce()

    const source = await readFile(fileURLToPath(productionModuleUrl), 'utf8')
    expect(source).not.toMatch(/jwt(?:Decode|decode)|decodeJwt|\.split\(['"]\.['"]\)/i)
  })

  it('does not log native or canonical credentials', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { provider } = await createSubject()

    await provider.getAssistantAccessToken()
    const output = JSON.stringify([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls])
    expect(output).not.toContain(nativeFixture)
    expect(output).not.toContain(canonicalFixture)
  })

  it('does not expose a raw credential in thrown user-visible errors', async () => {
    const { provider } = await createSubject({
      fetch: async () => new Response(nativeFixture, { status: 500 }),
    })

    const error = await provider.getAssistantAccessToken().catch(reason => reason as unknown)
    const rendered = error instanceof Error ? `${error.name}:${error.message}` : String(error)
    expect(rendered).not.toContain(nativeFixture)
    expect(rendered).not.toContain(canonicalFixture)
  })

  it('never reads or sends RefreshToken', async () => {
    const getItem = vi.fn(() => 'refresh-fixture')
    vi.stubGlobal('localStorage', { getItem, removeItem: vi.fn(), setItem: vi.fn() })
    const fetch = vi.fn(async () => bridgeResponse())
    const { provider } = await createSubject({ fetch })

    await provider.getAssistantAccessToken()
    expect(getItem).not.toHaveBeenCalled()
    expect(JSON.stringify(fetch.mock.calls)).not.toContain('refresh-fixture')
  })

  it('returns a usable cached token within its explicit lifetime', async () => {
    let now = 0
    const fetch = vi.fn(async () => bridgeResponse())
    const { provider } = await createSubject({ fetch, now: () => now })

    await provider.getAssistantAccessToken()
    now = 269_999
    await expect(provider.getAssistantAccessToken()).resolves.toBe(canonicalFixture)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('refreshes at the conservative 30-second expiry safety window', async () => {
    let now = 0
    const fetch = vi.fn(async () => bridgeResponse())
    const { provider } = await createSubject({ fetch, now: () => now })

    await provider.getAssistantAccessToken()
    now = 270_000
    await provider.getAssistantAccessToken()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent cache misses into one in-flight exchange', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    const fetch = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve
    }))
    const { provider } = await createSubject({ fetch })

    const requests = [provider.getAssistantAccessToken(), provider.getAssistantAccessToken()]
    expect(fetch).toHaveBeenCalledOnce()
    resolveFetch?.(bridgeResponse())
    await expect(Promise.all(requests)).resolves.toEqual([canonicalFixture, canonicalFixture])
  })

  it('forces re-exchange when the native AccessToken is replaced', async () => {
    let nativeToken = nativeFixture
    const fetch = vi.fn<Fetcher>(async () => bridgeResponse())
    const { provider } = await createSubject({ getNativeAccessToken: () => nativeToken, fetch })

    await provider.getAssistantAccessToken()
    nativeToken = 'native-replacement'
    await provider.getAssistantAccessToken()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(requestAuthorization(fetch.mock.calls[1]?.[1])).toBe('Bearer native-replacement')
  })

  it('clears the memory cache on explicit invalidation', async () => {
    const fetch = vi.fn(async () => bridgeResponse())
    const { provider } = await createSubject({ fetch })

    await provider.getAssistantAccessToken()
    provider.invalidate()
    await provider.getAssistantAccessToken()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('prevents a stale in-flight result from repopulating cache after invalidation', async () => {
    let resolveFirst: ((response: Response) => void) | undefined
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveFirst = resolve
      }))
      .mockResolvedValueOnce(bridgeResponse({ accessToken: 'canonical-current' }))
    const { provider } = await createSubject({ fetch })

    const staleRequest = provider.getAssistantAccessToken()
    provider.invalidate()
    resolveFirst?.(bridgeResponse({ accessToken: 'canonical-stale' }))
    await staleRequest.catch(() => undefined)

    await expect(provider.getAssistantAccessToken()).resolves.toBe('canonical-current')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('Feature 009 transient identity/reference bundle (T108 RED)', () => {
  it('exposes an instance-local connector reference resolver on the existing access-token resolver', async () => {
    const { provider } = await createSubject({ fetch: async () => bridgeResponseWithReference() })

    expect(provider.getAssistantAccessToken.getConnectorContextRef).toBeTypeOf('function')
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(connectorContextRefFixture)
  })

  it('tracks canonical-token and connector-reference expiries independently with a 15-second reference window', async () => {
    let now = 0
    const fetch = vi.fn<Fetcher>()
      .mockResolvedValueOnce(bridgeResponseWithReference())
      .mockResolvedValueOnce(bridgeResponseWithReference({ connectorContextRef: 'ccr_reference-refreshed' }))
    const { provider } = await createSubject({ fetch, now: () => now })

    await expect(provider.getAssistantAccessToken()).resolves.toBe(canonicalFixture)
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(connectorContextRefFixture)
    now = 104_999
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(connectorContextRefFixture)
    expect(fetch).toHaveBeenCalledOnce()

    now = 105_000
    await expect(provider.getAssistantAccessToken()).resolves.toBe(canonicalFixture)
    expect(fetch).toHaveBeenCalledOnce()
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe('ccr_reference-refreshed')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reacquires a missing reference without changing the existing canonical-token return type', async () => {
    const fetch = vi.fn<Fetcher>()
      .mockResolvedValueOnce(bridgeResponse())
      .mockResolvedValueOnce(bridgeResponseWithReference())
    const { provider } = await createSubject({ fetch })

    await expect(provider.getAssistantAccessToken()).resolves.toBe(canonicalFixture)
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(connectorContextRefFixture)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reacquires an expired reference while a canonical token remains valid', async () => {
    let now = 0
    const fetch = vi.fn<Fetcher>()
      .mockResolvedValueOnce(bridgeResponseWithReference({ connectorContextExpiresIn: 20 }))
      .mockResolvedValueOnce(bridgeResponseWithReference({ connectorContextRef: 'ccr_reference-after-expiry' }))
    const { provider } = await createSubject({ fetch, now: () => now })

    await provider.getAssistantAccessToken()
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(connectorContextRefFixture)
    now = 20_000
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe('ccr_reference-after-expiry')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent token and reference acquisition into one Bridge exchange', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    const fetch = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve
    }))
    const { provider } = await createSubject({ fetch })

    const results = Promise.all([
      provider.getAssistantAccessToken(),
      provider.getAssistantAccessToken.getConnectorContextRef(),
    ])
    expect(fetch).toHaveBeenCalledOnce()
    resolveFetch?.(bridgeResponseWithReference())
    await expect(results).resolves.toEqual([canonicalFixture, connectorContextRefFixture])
  })

  it('invalidates the associated reference when the native AccessToken changes', async () => {
    let nativeToken = nativeFixture
    const fetch = vi.fn<Fetcher>()
      .mockResolvedValueOnce(bridgeResponseWithReference())
      .mockResolvedValueOnce(bridgeResponseWithReference({
        accessToken: 'canonical-replacement',
        connectorContextRef: 'ccr_reference-replacement',
      }))
    const { provider } = await createSubject({ fetch, getNativeAccessToken: () => nativeToken })

    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(connectorContextRefFixture)
    nativeToken = 'native-replacement'
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe('ccr_reference-replacement')
    expect(requestAuthorization(fetch.mock.calls[1]?.[1])).toBe('Bearer native-replacement')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps the reference memory-only and never reads RefreshToken', async () => {
    const localGet = vi.fn(() => 'refresh-fixture')
    const localSet = vi.fn()
    const sessionSet = vi.fn()
    const cookieSetter = vi.fn()
    const indexedDBOpen = vi.fn()
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('localStorage', { getItem: localGet, removeItem: vi.fn(), setItem: localSet })
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(), removeItem: vi.fn(), setItem: sessionSet })
    vi.stubGlobal('document', Object.defineProperty({}, 'cookie', { set: cookieSetter }))
    vi.stubGlobal('indexedDB', { open: indexedDBOpen })
    const { provider } = await createSubject({ fetch: async () => bridgeResponseWithReference() })

    await provider.getAssistantAccessToken()
    await provider.getAssistantAccessToken.getConnectorContextRef()

    expect(localGet).not.toHaveBeenCalled()
    expect(localSet).not.toHaveBeenCalled()
    expect(sessionSet).not.toHaveBeenCalled()
    expect(cookieSetter).not.toHaveBeenCalled()
    expect(indexedDBOpen).not.toHaveBeenCalled()
    expect(JSON.stringify([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls])).not.toContain(connectorContextRefFixture)
  })
})

describe('Feature 009 transient reference lifecycle hardening (T112 tests first)', () => {
  it('does not reuse a stale reference after remint failure and can recover on the next exchange', async () => {
    let now = 0
    const fetch = vi.fn<Fetcher>()
      .mockResolvedValueOnce(bridgeResponseWithReference({
        connectorContextExpiresIn: 20,
        connectorContextRef: 'ccr_reference-stale',
      }))
      .mockRejectedValueOnce(new Error('bridge-remint-failure-sentinel'))
      .mockResolvedValueOnce(bridgeResponseWithReference({
        connectorContextRef: 'ccr_reference-recovered',
      }))
    const { provider } = await createSubject({ fetch, now: () => now })

    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe('ccr_reference-stale')
    now = 5_000
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).rejects.toThrow(
      'Assistant authorization is unavailable',
    )
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(
      'ccr_reference-recovered',
    )
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('rejects an old in-flight native-token generation without repopulating its reference', async () => {
    let nativeToken = 'native-generation-a'
    let resolveGenerationA: ((response: Response) => void) | undefined
    let resolveGenerationB: ((response: Response) => void) | undefined
    const fetch = vi.fn<Fetcher>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveGenerationA = resolve
      }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveGenerationB = resolve
      }))
    const { provider } = await createSubject({ fetch, getNativeAccessToken: () => nativeToken })

    const staleGeneration = provider.getAssistantAccessToken.getConnectorContextRef()
    nativeToken = 'native-generation-b'
    const currentGeneration = provider.getAssistantAccessToken.getConnectorContextRef()

    resolveGenerationB?.(bridgeResponseWithReference({
      accessToken: 'canonical-generation-b',
      connectorContextRef: 'ccr_reference-generation-b',
    }))
    await expect(currentGeneration).resolves.toBe('ccr_reference-generation-b')

    resolveGenerationA?.(bridgeResponseWithReference({
      accessToken: 'canonical-generation-a-stale',
      connectorContextRef: 'ccr_reference-generation-a-stale',
    }))
    await expect(staleGeneration).rejects.toThrow('Assistant authorization is unavailable')
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(
      'ccr_reference-generation-b',
    )
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('prevents explicit invalidation from allowing a shared stale exchange to restore either value', async () => {
    let resolveStale: ((response: Response) => void) | undefined
    const fetch = vi.fn<Fetcher>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveStale = resolve
      }))
      .mockResolvedValueOnce(bridgeResponseWithReference({
        accessToken: 'canonical-after-invalidate',
        connectorContextRef: 'ccr_reference-after-invalidate',
      }))
    const { provider } = await createSubject({ fetch })

    const staleToken = provider.getAssistantAccessToken()
    const staleReference = provider.getAssistantAccessToken.getConnectorContextRef()
    expect(fetch).toHaveBeenCalledOnce()
    provider.invalidate()

    resolveStale?.(bridgeResponseWithReference({
      accessToken: 'canonical-invalidated-stale',
      connectorContextRef: 'ccr_reference-invalidated-stale',
    }))
    await expect(staleToken).rejects.toThrow('Assistant authorization is unavailable')
    await expect(staleReference).rejects.toThrow('Assistant authorization is unavailable')

    await expect(provider.getAssistantAccessToken()).resolves.toBe('canonical-after-invalidate')
    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(
      'ccr_reference-after-invalidate',
    )
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps a unique reference sentinel out of persistence, URL, query, DOM, history, and logs', async () => {
    const referenceSentinel = 'ccr_phase12b-persistence-sentinel'
    const localSet = vi.fn()
    const sessionSet = vi.fn()
    const cookieSetter = vi.fn()
    const indexedDBOpen = vi.fn()
    const appendChild = vi.fn()
    const setAttribute = vi.fn()
    const pushState = vi.fn()
    const replaceState = vi.fn()
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('localStorage', { getItem: vi.fn(), removeItem: vi.fn(), setItem: localSet })
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(), removeItem: vi.fn(), setItem: sessionSet })
    vi.stubGlobal('document', Object.defineProperty({ appendChild, setAttribute }, 'cookie', { set: cookieSetter }))
    vi.stubGlobal('indexedDB', { open: indexedDBOpen })
    vi.stubGlobal('history', { pushState, replaceState })
    const fetch = vi.fn<Fetcher>(async () => bridgeResponseWithReference({
      connectorContextRef: referenceSentinel,
    }))
    const { provider } = await createSubject({ fetch })

    await expect(provider.getAssistantAccessToken.getConnectorContextRef()).resolves.toBe(referenceSentinel)

    expect(localSet).not.toHaveBeenCalled()
    expect(sessionSet).not.toHaveBeenCalled()
    expect(cookieSetter).not.toHaveBeenCalled()
    expect(indexedDBOpen).not.toHaveBeenCalled()
    expect(appendChild).not.toHaveBeenCalled()
    expect(setAttribute).not.toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
    expect(fetch.mock.calls[0]?.[0]).toBe('/assistant-identity/identity/exchange')
    expect(JSON.stringify(fetch.mock.calls[0]?.[1] ?? {})).not.toContain(referenceSentinel)
    expect(JSON.stringify([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls])).not.toContain(
      referenceSentinel,
    )
  })

  it('never reads, sends, or persists a RefreshToken while resolving a connector reference', async () => {
    const refreshTokenSentinel = 'phase12b-refresh-token-sentinel'
    const getItem = vi.fn(() => refreshTokenSentinel)
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem, removeItem: vi.fn(), setItem })
    const fetch = vi.fn<Fetcher>(async () => bridgeResponseWithReference())
    const { provider } = await createSubject({ fetch })

    await provider.getAssistantAccessToken.getConnectorContextRef()

    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(JSON.stringify(fetch.mock.calls)).not.toContain(refreshTokenSentinel)
    expect(JSON.stringify(fetch.mock.calls)).not.toMatch(/RefreshToken|refreshToken/)
  })
})
