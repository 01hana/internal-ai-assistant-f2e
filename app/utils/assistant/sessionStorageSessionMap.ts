import type { AssistantSessionId } from '../../types/assistant'

const DEFAULT_KEY_PREFIX = 'internal-assistant:session:'

export interface AssistantSessionStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SessionStorageSessionMapOptions {
  storage?: AssistantSessionStorageLike | null
  keyPrefix?: string
}

export interface StoredAssistantSessionPointer {
  version: 1
  sessionId: AssistantSessionId
}

export interface SessionStorageSessionMap {
  read(scopeKey: string): AssistantSessionId | null
  write(scopeKey: string, sessionId: AssistantSessionId): void
  clear(scopeKey: string): void
}

function resolveStorage(
  storage: SessionStorageSessionMapOptions['storage'],
): AssistantSessionStorageLike | null {
  if (storage !== undefined) {
    return storage
  }

  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  }
  catch {
    return null
  }
}

function createStorageKey(keyPrefix: string, scopeKey: string): string | null {
  return scopeKey.trim()
    ? `${keyPrefix}${encodeURIComponent(scopeKey)}`
    : null
}

function isStoredSessionPointer(
  value: unknown,
): value is StoredAssistantSessionPointer {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()

  return keys.length === 2
    && keys[0] === 'sessionId'
    && keys[1] === 'version'
    && record.version === 1
    && typeof record.sessionId === 'string'
    && record.sessionId.trim().length > 0
}

export function createSessionStorageSessionMap(
  options: SessionStorageSessionMapOptions = {},
): SessionStorageSessionMap {
  const storage = resolveStorage(options.storage)
  const keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX

  function clear(scopeKey: string): void {
    const storageKey = createStorageKey(keyPrefix, scopeKey)

    if (!storage || !storageKey) {
      return
    }

    try {
      storage.removeItem(storageKey)
    }
    catch {
      // Storage can be unavailable even after it was resolved.
    }
  }

  return {
    read(scopeKey) {
      const storageKey = createStorageKey(keyPrefix, scopeKey)

      if (!storage || !storageKey) {
        return null
      }

      let storedValue: string | null

      try {
        storedValue = storage.getItem(storageKey)
      }
      catch {
        return null
      }

      if (storedValue === null) {
        return null
      }

      try {
        const pointer: unknown = JSON.parse(storedValue)

        if (isStoredSessionPointer(pointer)) {
          return pointer.sessionId
        }
      }
      catch {
        // Invalid scoped state is removed below.
      }

      clear(scopeKey)
      return null
    },

    write(scopeKey, sessionId) {
      const storageKey = createStorageKey(keyPrefix, scopeKey)

      if (!storage || !storageKey || !sessionId.trim()) {
        return
      }

      const pointer: StoredAssistantSessionPointer = {
        version: 1,
        sessionId,
      }

      try {
        storage.setItem(storageKey, JSON.stringify(pointer))
      }
      catch {
        // Continuity storage is optional and must not break the assistant.
      }
    },

    clear,
  }
}
