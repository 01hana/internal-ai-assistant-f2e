export interface WidgetConfiguration {
  /**
   * Backend 001 Compatibility Mode API base. Defaults to the host's same-origin
   * `/api/v1` proxy when omitted. This is an endpoint only; never put tokens or
   * other authorization material in this value.
   */
  readonly apiBaseUrl?: string;
  readonly featureFlags?: readonly string[];
  readonly integrationMode?: "backend001-compatibility" | "backend002";
  readonly launcher?: {
    readonly enabled?: boolean;
  };
  readonly locale?: "zh-TW" | "en";
  readonly position?: "bottom-right" | "bottom-left";
  readonly sessionScope?: string;
  readonly size?: {
    readonly height?: number;
    readonly width?: number;
  };
  readonly theme?: "light" | "dark" | "system";
  readonly zIndex?: number;
}
