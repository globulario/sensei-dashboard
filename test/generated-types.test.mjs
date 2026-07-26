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

test("every schema file targeted for generation is listed exactly once", () => {
  const files = targets.map((t) => t.schemaFile);
  assert.deepEqual(files.sort(), [
    "agent-handoff-v1.schema.json",
    "dashboard-projection-v1.schema.json",
    "workspace-agent-run-v1.schema.json",
    "workspace-architect-session-v1.schema.json",
    "workspace-execution-receipt-v1.schema.json",
    "workspace-github-action-v1.schema.json",
    "workspace-provider-capabilities-v1.schema.json",
    "workspace-provider-event-v1.schema.json",
    "workspace-provider-status-v1.schema.json",
  ]);
});
