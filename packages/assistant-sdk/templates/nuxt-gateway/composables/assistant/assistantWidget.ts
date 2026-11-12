import type { MountOptions } from '@ideaxpress/assistant-sdk'

// ──────────────────────────────────────────────
// 複製到客戶系統後，只需要修改這兩個值
// ──────────────────────────────────────────────

/** 必須與 AI 助理後端為此客戶 provision 的 HostApp 代碼完全相同 */
const HOST_APP = '<host-app-code>'

/** 本機對話儲存的命名空間；同一網域有多個系統時要各自不同 */
const SESSION_SCOPE = '<host-app-code>-main'

type AssistantAccessTokenResolver = (() => Promise<string>) & {
  getConnectorContextRef?: () => Promise<string | undefined>
}

export interface AssistantWidgetOptionsDependencies {
  getAssistantAccessToken: AssistantAccessTokenResolver
  getRoute: () => string
  target: Element | string
}

const CONNECTOR_CONTEXT_REF_PATTERN = /^ccr_[A-Za-z0-9_-]{1,128}$/

async function resolveConnectorContextRef(
  resolver: AssistantAccessTokenResolver,
): Promise<string | undefined> {
  try {
    const connectorContextRef = (await resolver.getConnectorContextRef?.())?.trim()
    return connectorContextRef !== undefined && CONNECTOR_CONTEXT_REF_PATTERN.test(connectorContextRef)
      ? connectorContextRef
      : undefined
  }
  catch {
    return undefined
  }
}

export function createAssistantWidgetOptions(
  dependencies: AssistantWidgetOptionsDependencies,
): MountOptions {
  return {
    target: dependencies.target,
    provider: async () => {
      const connectorContextRef = await resolveConnectorContextRef(dependencies.getAssistantAccessToken)

      return {
        hostApp: HOST_APP,
        pageContext: {
          ...(connectorContextRef === undefined ? {} : { connectorContextRef }),
          route: dependencies.getRoute(),
        },
      }
    },
    getAccessToken: () => dependencies.getAssistantAccessToken(),
    configuration: {
      integrationMode: 'gateway-v1',
      launcher: { enabled: true },
      sessionScope: SESSION_SCOPE,
    },
  }
}
