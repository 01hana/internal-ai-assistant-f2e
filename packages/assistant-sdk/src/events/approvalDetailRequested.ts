type ApprovalDetailPayload = Readonly<{
  approvalRequestId: string;
  messageId: string;
  sessionId: string;
}>;

export type ApprovalDetailRequestedAdapter = {
  readonly requestApprovalDetail: (input: Readonly<Record<string, unknown>>) => Promise<{ readonly ok: boolean }>;
};

function pickIdsOnly(input: Readonly<Record<string, unknown>>): ApprovalDetailPayload | undefined {
  const { approvalRequestId, messageId, sessionId } = input;

  if (
    typeof approvalRequestId !== "string"
    || typeof messageId !== "string"
    || typeof sessionId !== "string"
  ) {
    return undefined;
  }

  return {
    approvalRequestId,
    messageId,
    sessionId,
  };
}

export function createApprovalDetailRequestedAdapter(input: {
  readonly onApprovalDetailRequested?: (payload: ApprovalDetailPayload) => unknown | Promise<unknown>;
}): ApprovalDetailRequestedAdapter {
  return {
    requestApprovalDetail: async (requestInput) => {
      const safePayload = pickIdsOnly(requestInput);

      if (!safePayload || typeof input.onApprovalDetailRequested !== "function") {
        return { ok: false };
      }

      try {
        await input.onApprovalDetailRequested(safePayload);
        return { ok: true };
      }
      catch {
        return { ok: false };
      }
    },
  };
}
