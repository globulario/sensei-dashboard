// Real Draft 2020-12 schema validation at the adapter boundary
// (claude-stage-1-brief.md §2: "Validate every loaded projection at the
// adapter boundary. Invalid projection data must produce an explicit
// unavailable state and a useful diagnostic."). Imports the exact pinned
// schema file (docs/dashboard-projection-v1.schema.json) bundled at build
// time — the same file contract/pin.json's digest covers, not a copy that
// could drift from it.

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import projectionSchema from "../../docs/dashboard-projection-v1.schema.json" with { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(projectionSchema);

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates an already-JSON-parsed value against the pinned
 * dashboard-projection-v1 schema. Returns human-readable error strings, not
 * ajv's internal error objects — callers (the adapter) must be able to show
 * a useful diagnostic without knowing anything about ajv.
 */
export function validateProjection(instance: unknown): SchemaValidationResult {
  const valid = validate(instance) as boolean;
  if (valid) {
    return { valid: true, errors: [] };
  }
  const errors = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`);
  return { valid: false, errors };
}
