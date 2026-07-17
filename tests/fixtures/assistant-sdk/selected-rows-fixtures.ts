import {
  forbiddenOutgoingFields,
  secretLikeFields,
} from "./forbidden-fields";

export const selectedRowsForbiddenFields = [
  ...secretLikeFields,
  ...forbiddenOutgoingFields,
  "apiKey",
  "connectionString",
] as const;

export function createSelectedRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index + 1}`,
    index: index + 1,
    label: `Row ${index + 1}`,
    selected: true,
  }));
}

export function createNestedSelectedRows() {
  return [
    {
      id: "row-001",
      nested: { raw: true },
    },
  ];
}

export function createArraySelectedRows() {
  return [
    {
      id: "row-001",
      values: ["raw"],
    },
  ];
}

export function createFunctionSelectedRows() {
  return [
    {
      id: "row-001",
      onClick: () => undefined,
    },
  ];
}

export function createForbiddenSelectedRows(field: string) {
  return [
    {
      id: "row-001",
      [field]: "forbidden-value",
    },
  ];
}

export function createMixedValidInvalidSelectedRows() {
  return [
    ...createSelectedRows(2),
    {
      id: "row-003",
      token: "secret-token",
    },
  ];
}
