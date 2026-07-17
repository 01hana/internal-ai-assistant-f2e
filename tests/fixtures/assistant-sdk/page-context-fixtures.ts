import {
  forbiddenOutgoingFields,
  localOnlyFields,
  secretLikeFields,
} from "./forbidden-fields";

export const pageContextForbiddenFields = [
  ...localOnlyFields,
  ...secretLikeFields,
  ...forbiddenOutgoingFields,
  "apiKey",
  "callbackPayload",
  "connectionString",
] as const;

export function createSafePageContext() {
  return {
    entityId: "order-001",
    entityType: "order",
    metadata: {
      readonly: true,
      rowCount: 1,
      title: "Sales order",
    },
    route: "/orders/001",
    screenId: "order-detail",
    selectedRows: [
      {
        id: "order-001",
        label: "SO-001",
        selected: true,
        total: 1200,
      },
    ],
  };
}

export function createRawBusinessPageContext() {
  return {
    route: "/orders/001",
    selectedRows: [
      {
        customer: {
          id: "customer-001",
          raw: true,
        },
        id: "order-001",
      },
    ],
  };
}

export function createClassInstancePageContext() {
  class RawBusinessRecord {
    readonly id = "record-001";
  }

  return {
    route: "/orders/001",
    selectedRows: [new RawBusinessRecord()],
  };
}

export function createCircularPageContext() {
  const context: Record<string, unknown> = {
    route: "/orders/001",
  };
  context.self = context;

  return context;
}

export function createForbiddenFieldPageContext(field: string) {
  return {
    route: "/orders/001",
    [field]: "forbidden-value",
  };
}

export function createFunctionPageContext() {
  return {
    route: "/orders/001",
    selectedRows: [
      {
        id: "order-001",
        onClick: () => undefined,
      },
    ],
  };
}
