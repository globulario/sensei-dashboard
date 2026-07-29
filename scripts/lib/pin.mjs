// Shared helpers for contract/pin.json consumers: the CLI verifier
// (scripts/verify-schema-pin.mjs) and the test suite (test/*.test.mjs) both
// import from here so the two never drift into checking different things.
//
// These helpers are also reused, unchanged, by contract/workspace/sensei-pin.json
// (a second, independent producer-consumer pin manifest -- see
// docs/claude-workspace-o1-sensei-pin-parity-brief.md Law C). Nothing here is
// specific to contract/pin.json's particular source_commit or entries; the
// generic manifest shape ({ source_repository, source_commit, schemas[],
// fixtures[] }) is shared, not the manifest's content.

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Generic pin-manifest loader: relativePath is repo-root-relative, e.g. "contract/pin.json". */
export async function loadManifest(relativePath) {
  const raw = await readFile(path.join(repoRoot, relativePath), "utf8");
  return JSON.parse(raw);
}

export async function loadPin() {
  return loadManifest(path.join("contract", "pin.json"));
}

export async function loadWorkspacePin() {
  return loadManifest(path.join("contract", "workspace", "sensei-pin.json"));
}

export async function sha256File(relativeOrAbsolutePath) {
  const p = path.isAbsolute(relativeOrAbsolutePath) ? relativeOrAbsolutePath : path.join(repoRoot, relativeOrAbsolutePath);
  const data = await readFile(p);
  return createHash("sha256").update(data).digest("hex");
}

export function sha256Bytes(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function fetchRaw(sourceRepository, sourceCommit, sourcePath) {
  const url = `https://raw.githubusercontent.com/${sourceRepository}/${sourceCommit}/${sourcePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url}: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Every artifact contract/pin.json pins (schemas + fixtures), as one flat list. */
export function allPinEntries(pin) {
  return [...pin.schemas, ...pin.fixtures];
}

/**
 * The projection schema's declared $id ("dashboard-projection-v1.json") and
 * the literal filename the agent-handoff schema's relative $ref resolves to
 * ("dashboard-projection-v1.schema.json") don't textually match — a
 * pre-existing property of the vendored schemas (see contract/PARITY.md),
 * not something changed here. Registering the projection schema under both
 * lets Ajv resolve the cross-schema $ref without editing either schema file.
 */
const CROSS_REF_ALIAS = "https://globulario.github.io/sensei-dashboard/schema/dashboard-projection-v1.schema.json";

export async function buildValidators() {
  const projectionSchema = JSON.parse(await readFile(path.join(repoRoot, "docs", "dashboard-projection-v1.schema.json"), "utf8"));
  const handoffSchema = JSON.parse(await readFile(path.join(repoRoot, "docs", "agent-handoff-v1.schema.json"), "utf8"));

  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addSchema(projectionSchema, projectionSchema.$id);
  ajv.addSchema(projectionSchema, CROSS_REF_ALIAS);

  const validateProjection = ajv.getSchema(projectionSchema.$id);
  const validateHandoff = ajv.compile(handoffSchema);

  return { ajv, projectionSchema, handoffSchema, validateProjection, validateHandoff };
}

/**
 * Generic Ajv2020 validator compiler for a set of independent schema files
 * that do not cross-reference each other or need the dashboard-projection/
 * agent-handoff $ref-alias workaround above. Used for the pinned workspace
 * schemas (sensei.workspace.identity.v1, sensei.workspace.admission.v1),
 * which are self-contained per docs/schemas/workspace/v1/*.schema.json.
 * Returns { schemasByFile, validatorsByFile }, both keyed by filename.
 */
export async function buildSimpleValidators(dir, fileNames) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);

  const schemasByFile = {};
  const validatorsByFile = {};
  for (const file of fileNames) {
    const schema = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    schemasByFile[file] = schema;
    validatorsByFile[file] = ajv.compile(schema);
  }
  return { schemasByFile, validatorsByFile };
}
