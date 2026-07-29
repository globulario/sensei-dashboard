import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateAll, outDir, targets } from "../scripts/lib/generate.mjs";

test("committed contract/generated/*.ts is not stale relative to the pinned schemas", async () => {
  const fresh = await generateAll();
  for (const { outFile, contents } of fresh) {
    const committedPath = path.join(outDir, outFile);
    const committed = await readFile(committedPath, "utf8");
    assert.equal(
      committed,
      contents,
      `${outFile} is stale — run \`npm run generate:types\` and commit the result`
    );
  }
});

test("regenerating twice in a row produces byte-identical output (determinism)", async () => {
  const run1 = await generateAll();
  const run2 = await generateAll();
  assert.equal(run1.length, run2.length);
  for (let i = 0; i < run1.length; i++) {
    assert.equal(run1[i].outFile, run2[i].outFile);
    assert.equal(run1[i].contents, run2[i].contents, `${run1[i].outFile} differed between two consecutive generations`);
  }
});

test("generated root types exist for both schemas and stay closed (no index signature added)", async () => {
  const fresh = await generateAll();
  const projection = fresh.find((f) => f.outFile === "dashboard-projection-v1.ts").contents;
  const handoff = fresh.find((f) => f.outFile === "agent-handoff-v1.ts").contents;

  assert.match(projection, /export interface SenseiDashboardProjectionV1 \{/);
  assert.match(handoff, /export interface SenseiDashboardAgentHandoffV1 \{/);

  // additionalProperties:false in the schema must not surface as a TS index
  // signature ([key: string]: any) on the root types — that would silently
  // let frontend code add fields the schema forbids.
  for (const src of [projection, handoff]) {
    assert.doesNotMatch(src, /\[k: string\]: any/, "generated types must not carry an open index signature");
  }
});

test("the two pinned canonical workspace types (root and every closed nested object) carry no open index signature, of either 'any' or 'unknown'", async () => {
  const fresh = await generateAll();
  const identity = fresh.find((f) => f.outFile === "workspace-identity-v1.ts").contents;
  const admission = fresh.find((f) => f.outFile === "workspace-admission-v1.ts").contents;

  assert.match(identity, /export interface SenseiWorkspaceIdentityV1 \{/);
  assert.match(admission, /export type SenseiWorkspaceAdmissionV1 = \{/);

  // These are the exact two nested $defs-derived types
  // workspace-identity-v1.schema.json's `binding`/`taskIdentity` compile
  // to (both use allOf for Law F if/then conditionals, which is what
  // triggers json-schema-to-typescript's open-signature fallback --
  // see scripts/lib/generate.mjs's closeKnownClosedIntersections()).
  assert.match(identity, /export type Binding = \{/);
  assert.match(identity, /export type TaskIdentity = \{/);

  // json-schema-to-typescript's own open-signature fallback for allOf-
  // merged closed objects emits `unknown` (see
  // scripts/lib/generate.mjs's assertNoUnexpectedOpenObjects/
  // closeKnownClosedIntersections doc comment) -- checking only `any`,
  // as the pre-existing dashboard-projection/agent-handoff test above
  // does, would silently miss it, which is exactly what slipped through
  // architect review the first time.
  for (const src of [identity, admission]) {
    assert.doesNotMatch(src, /\[k: string\]: any/, "generated types must not carry an open 'any' index signature");
    assert.doesNotMatch(src, /\[k: string\]: unknown/, "generated types must not carry an open 'unknown' index signature");
  }
});

test("the runner protocol type (root and nested closed objects) carries no open index signature, of either 'any' or 'unknown'", async () => {
  const fresh = await generateAll();
  const runner = fresh.find((f) => f.outFile === "runner-protocol-v1.ts").contents;

  assert.match(runner, /export type SenseiRunnerProtocolV1 = /);
  assert.match(runner, /export interface HandshakeRequest \{/);
  assert.match(runner, /export interface HandshakeResponse \{/);
  assert.match(runner, /export interface RunnerStatus \{/);
  assert.match(runner, /export type RunnerEvent = /);
  assert.match(runner, /export interface Refusal \{/);

  assert.doesNotMatch(runner, /\[k: string\]: any/, "generated types must not carry an open 'any' index signature");
  assert.doesNotMatch(runner, /\[k: string\]: unknown/, "generated types must not carry an open 'unknown' index signature");
});

test("every schema file targeted for generation is listed exactly once", () => {
  const files = targets.map((t) => t.schemaFile);
  assert.deepEqual(files.sort(), [
    "agent-handoff-v1.schema.json",
    "dashboard-projection-v1.schema.json",
    "runner-protocol-v1.schema.json",
    "workspace-admission-v1.schema.json",
    "workspace-agent-run-v1.schema.json",
    "workspace-architect-session-v1.schema.json",
    "workspace-execution-receipt-v1.schema.json",
    "workspace-github-action-v1.schema.json",
    "workspace-identity-v1.schema.json",
    "workspace-provider-capabilities-v1.schema.json",
    "workspace-provider-event-v1.schema.json",
    "workspace-provider-status-v1.schema.json",
  ]);
});
