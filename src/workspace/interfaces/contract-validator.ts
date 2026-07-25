// The pure validation boundary every workspace contract (and the existing
// dashboard-projection-v1/agent-handoff-v1 pair) is consumed through --
// mirrors the shape of src/adapter/schema-validate.ts's real ajv-based
// validators without importing that module, so this interface layer stays
// free of any concrete ajv/DOM dependency; a real implementation wires a
// ContractValidator to schema-validate.ts-style code in O2+.

export interface ValidationResult<T> {
  readonly valid: boolean;
  readonly value: T | null;
  readonly errors: readonly string[];
}

export interface ContractValidator {
  validate<T>(schemaVersion: string, instance: unknown): ValidationResult<T>;
}
