export interface WidgetConfiguration {
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
