// Shared validator-building logic for the Workspace O1 (Dashboard/runner-owned)
// contracts — used by test/workspace-fixtures.test.mjs. Deliberately separate
// from scripts/lib/pin.mjs's buildValidators(): that function exists
// specifically for the Sensei-pinned dashboard-projection-v1/agent-handoff-v1
// pair and their cross-schema $ref alias registration quirk (see pin.mjs's
// own comment). None of the workspace schemas cross-reference each other or
// the pinned pair by design (docs/architecture-workspace-contracts-v1.md), so
// this file's validator construction is simpler and does not need that
// workaround.

import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { repoRoot } from "./pin.mjs";

export const workspaceSchemaFiles = [
  "workspace-architect-session-v1.schema.json",
  "workspace-agent-run-v1.schema.json",
  "workspace-execution-receipt-v1.schema.json",
  "workspace-provider-capabilities-v1.schema.json",
  "workspace-provider-status-v1.schema.json",
  "workspace-provider-event-v1.schema.json",
  "workspace-github-action-v1.schema.json",
];

export const fixtureDirByFile = {
  "workspace-architect-session-v1.schema.json": "architect-session",
  "workspace-agent-run-v1.schema.json": "agent-run",
  "workspace-execution-receipt-v1.schema.json": "execution-receipt",
  "workspace-provider-capabilities-v1.schema.json": "provider-capabilities",
  "workspace-provider-status-v1.schema.json": "provider-status",
  "workspace-provider-event-v1.schema.json": "provider-event",
  "workspace-github-action-v1.schema.json": "github-action",
};

/** Pulls the schema_version const out of a schema, whether it's declared at
 * the schema's own root (six of the seven) or only inside a $defs branch
 * (workspace-github-action-v1.schema.json's request/result oneOf, which has
 * no single root-level schema_version property). */
function schemaVersionConst(schema) {
  if (schema.properties?.schema_version?.const) return schema.properties.schema_version.const;
  for (const def of Object.values(schema.$defs ?? {})) {
    if (def.properties?.schema_version?.const) return def.properties.schema_version.const;
  }
  throw new Error(`could not determine schema_version const for schema $id=${schema.$id}`);
}

/**
 * Compiles one validator per workspace schema file. Returns:
 *   schemasByFile:     { [schemaFile]: parsed schema JSON }
 *   validatorsByFile:  { [schemaFile]: compiled ajv validate function }
 *   validatorsByVersion: { [schema_version]: compiled ajv validate function }
 */
export async function buildWorkspaceValidators() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);

  const schemasByFile = {};
  const validatorsByFile = {};
  const validatorsByVersion = {};

  for (const file of workspaceSchemaFiles) {
    const schema = JSON.parse(await readFile(path.join(repoRoot, "docs", file), "utf8"));
    schemasByFile[file] = schema;
    const validate = ajv.compile(schema);
    validatorsByFile[file] = validate;
    validatorsByVersion[schemaVersionConst(schema)] = validate;
  }

  return { schemasByFile, validatorsByFile, validatorsByVersion };
}
