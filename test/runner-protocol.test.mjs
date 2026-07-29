// Validates docs/runner-protocol-v1.schema.json and its fixtures
// (docs/fixtures/runner/v1/) -- the O2.1 runner/IPC foundation's wire
// protocol (docs/claude-workspace-o2-1-runner-ipc-foundation-brief.md §4,
// §9.1). Adversarial cases are constructed inline from the committed
// positive fixtures, following test/workspace-fixtures.test.mjs's
// established pattern, and include nested-field tampering
// (test/workspace-pin.test.mjs's pattern), not just root-level mutation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { repoRoot, buildSimpleValidators } from "../scripts/lib/pin.mjs";

const schemaFile = "runner-protocol-v1.schema.json";
const fixturesDir = path.join(repoRoot, "docs", "fixtures", "runner", "v1");

async function loadFixture(name) {
  return JSON.parse(await readFile(path.join(fixturesDir, name), "utf8"));
}

async function validator() {
  const { validatorsByFile, schemasByFile } = await buildSimpleValidators(path.join(repoRoot, "docs"), [schemaFile]);
  return { validate: validatorsByFile[schemaFile], schema: schemasByFile[schemaFile] };
}

test("the runner protocol schema is closed at its root and on every named branch", async () => {
  const { schema } = await validator();
  assert.ok(Array.isArray(schema.oneOf) && schema.oneOf.length === 5, "root must be a 5-way oneOf");
  for (const [name, def] of Object.entries(schema.$defs)) {
    if (def.type === "object") {
      assert.equal(def.additionalProperties, false, `$defs/${name} is not closed`);
    }
  }
});

test("every committed fixture validates against the runner protocol schema", async () => {
  const { validate } = await validator();
  const files = await readdir(fixturesDir);
  assert.ok(files.length >= 9, "expected at least 9 committed fixtures");
  for (const file of files) {
    const instance = await loadFixture(file);
    const valid = validate(instance);
    assert.equal(valid, true, `${file} failed schema validation: ${JSON.stringify(validate.errors, null, 2)}`);
  }
});

test("unknown root-level properties are rejected for every message kind", async () => {
  const { validate } = await validator();
  const files = await readdir(fixturesDir);
  for (const file of files) {
    const instance = await loadFixture(file);
    const tampered = { ...instance, unexpected_root_field: "x" };
    assert.equal(validate(tampered), false, `${file}: an unknown root property must be rejected`);
  }
});

test("unknown nested payload properties are rejected on every runner_event kind", async () => {
  const { validate } = await validator();
  for (const file of ["event-runner-started.json", "event-client-authenticated.json", "event-runner-stopping.json"]) {
    const instance = await loadFixture(file);
    const tampered = { ...instance, payload: { ...instance.payload, unexpected_nested_field: "x" } };
    assert.equal(validate(tampered), false, `${file}: an unknown property nested inside payload must be rejected`);
  }
});

test("unknown message_kind is rejected", async () => {
  const { validate } = await validator();
  const instance = await loadFixture("handshake-request.json");
  assert.equal(validate({ ...instance, message_kind: "not_a_real_message_kind" }), false);
});

test("unsupported schema_version is rejected", async () => {
  const { validate } = await validator();
  for (const file of ["handshake-request.json", "handshake-response.json", "status-ready.json", "event-runner-started.json", "refusal-unauthorized.json"]) {
    const instance = await loadFixture(file);
    assert.equal(validate({ ...instance, schema_version: "sensei.runner.protocol.v0" }), false, `${file}: an unsupported schema_version must be rejected`);
  }
});

test("a payload shaped for a different event kind is rejected (discriminated union)", async () => {
  const { validate } = await validator();
  const started = await loadFixture("event-runner-started.json");
  const authenticated = await loadFixture("event-client-authenticated.json");
  const mismatched = { ...started, payload: authenticated.payload };
  assert.equal(validate(mismatched), false, "runner_started must not accept client_authenticated's payload shape");
});

test("unknown client_kind is rejected (browser/web clients are not a representable client_kind)", async () => {
  const { validate } = await validator();
  const instance = await loadFixture("handshake-request.json");
  assert.equal(validate({ ...instance, client_kind: "browser" }), false);
});

test("empty supported_protocol_versions is rejected", async () => {
  const { validate } = await validator();
  const instance = await loadFixture("handshake-request.json");
  assert.equal(validate({ ...instance, supported_protocol_versions: [] }), false);
});

test("unknown refusal code is rejected", async () => {
  const { validate } = await validator();
  const instance = await loadFixture("refusal-unauthorized.json");
  assert.equal(validate({ ...instance, code: "runner.made_up_code" }), false);
});

test("non-monotonic-looking sequence (0) is rejected", async () => {
  const { validate } = await validator();
  const instance = await loadFixture("event-runner-started.json");
  assert.equal(validate({ ...instance, sequence: 0 }), false, "sequence must start at 1, so 0 is never valid");
});
