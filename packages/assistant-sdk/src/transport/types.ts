export type PackageBuiltRequest = {
  readonly request: Readonly<Record<string, unknown>>;
  readonly requestId: string;
  readonly sessionId: string;
};

export type SanitizedExecutionInput = PackageBuiltRequest;

export type TransportSuccess<T = unknown> = {
  readonly ok: true;
  readonly value?: T;
};

export type TransportFailure = {
  readonly error: {
    readonly code: string;
    readonly field?: string;
    readonly surface?: string;
    readonly userMessage: "integration error";
  };
  readonly ok: false;
};

export type TransportResult<T = unknown> = TransportSuccess<T> | TransportFailure;
