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
import handoffSchema from "../../docs/agent-handoff-v1.schema.json" with { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(projectionSchema);

// agent-handoff-v1.schema.json $refs into dashboard-projection-v1.schema.json
// by that relative filename, not by the projection schema's own $id — the
// projection schema must be registered under that exact resolved key
// (relative to the handoff schema's $id) for ajv to resolve the cross-file
// $refs, in a second, independent ajv instance so this key registration
// can't affect projection-only validation above.
const handoffAjv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(handoffAjv);
handoffAjv.addSchema(projectionSchema, "https://globulario.github.io/sensei-dashboard/schema/dashboard-projection-v1.schema.json");
const validateHandoff = handoffAjv.compile(handoffSchema);

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

/**
 * Validates a built envelope against the pinned agent-handoff-v1 schema
 * before it is offered for export (claude-stage-3-brief.md §3.3: "validate
 * against the pinned handoff schema" — export must be unavailable if this
 * fails).
 */
export function validateHandoffEnvelope(instance: unknown): SchemaValidationResult {
  const valid = validateHandoff(instance) as boolean;
  if (valid) {
    return { valid: true, errors: [] };
  }
  const errors = (validateHandoff.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`);
  return { valid: false, errors };
}
