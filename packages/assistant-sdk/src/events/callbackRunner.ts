import type { SafeError } from "../types/public";

export type HostCallbackRunnerResult =
  | {
      readonly emittedErrors: readonly SafeError[];
      readonly ok: true;
    }
  | {
      readonly emittedErrors: readonly SafeError[];
      readonly ok: false;
    };

function createHostCallbackFailedError(): SafeError {
  return {
    code: "host_callback_failed",
    message: "Host callback failed",
    retryable: false,
    userMessage: "integration error",
  };
}

export async function runHostCallbackSafely(input: {
  readonly callback: () => unknown | Promise<unknown>;
  readonly eventName: string;
}): Promise<HostCallbackRunnerResult> {
  try {
    await input.callback();

    return {
      emittedErrors: [],
      ok: true,
    };
  }
  catch {
    return {
      emittedErrors: [createHostCallbackFailedError()],
      ok: false,
    };
  }
}

