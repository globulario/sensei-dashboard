import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "../scripts/lib/pin.mjs";
import { buildWorkspaceValidators, workspaceSchemaFiles, fixtureDirByFile } from "../scripts/lib/workspace-schemas.mjs";

const fixturesRoot = path.join(repoRoot, "docs", "fixtures", "workspace", "v1");

async function loadFixture(dir, file) {
  return JSON.parse(await readFile(path.join(fixturesRoot, dir, file), "utf8"));
}

test("every workspace schema parses as JSON and is closed at its root/branches (additionalProperties: false)", async () => {
  const { schemasByFile } = await buildWorkspaceValidators();
  for (const file of workspaceSchemaFiles) {
    const schema = schemasByFile[file];
    if (schema.oneOf) {
      // github-action.v1: closedness lives on each named branch, not the root.
      for (const branch of Object.values(schema.$defs)) {
        if (branch.type === "object") assert.equal(branch.additionalProperties, false, `${file}: a $defs branch is not closed`);
      }
    } else {
      assert.equal(schema.additionalProperties, false, `${file} root is not closed`);
    }
  }
});

test("every committed positive fixture validates against its own declared schema_version", async () => {
  const { validatorsByVersion } = await buildWorkspaceValidators();
  for (const dir of Object.values(fixtureDirByFile)) {
    const files = await readdir(path.join(fixturesRoot, dir));
    for (const file of files) {
      const instance = await loadFixture(dir, file);
      const validate = validatorsByVersion[instance.schema_version];
      assert.ok(validate, `${dir}/${file}: no validator for schema_version ${instance.schema_version}`);
      const valid = validate(instance);
      assert.equal(valid, true, `${dir}/${file} failed schema validation: ${JSON.stringify(validate.errors, null, 2)}`);
    }
  }
});

test("every fixture directory contains at least a minimal and a representative-complete example", async () => {
  for (const dir of Object.values(fixtureDirByFile)) {
    const files = await readdir(path.join(fixturesRoot, dir));
    assert.ok(files.length >= 2, `${dir} has fewer than 2 fixtures`);
  }
});

// --- Adversarial fixtures (constructed inline, not committed as files —
// same pattern src/map/*.test.ts used in PR #6 for per-case adversarial
// proof) ------------------------------------------------------------------

test("architect-session.v1 adversarial cases", async () => {
  const { validatorsByVersion } = await buildWorkspaceValidators();
  const validate = validatorsByVersion["sensei.dashboard.architect-session.v1"];
  const base = await loadFixture("architect-session", "minimal.json");

  assert.equal(validate({ ...base, unexpected_field: "x" }), false, "unknown top-level property must be rejected");
  assert.equal(validate({ ...base, assurance_mode: "bogus" }), false, "invalid assurance_mode enum must be rejected");
  const { session_id, ...missingId } = base;
  assert.equal(validate(missingId), false, "missing required session_id must be rejected");

  assert.equal(
    validate({ ...base, assurance_mode: "governed", admission_reference: null }),
    false,
    "governed session without admission_reference must be rejected"
  );

  const realAdmission = { admission_id: "a1", decision: "admitted", decision_digest_sha256: "a".repeat(64), policy_id: null };
  assert.equal(
    validate({ ...base, assurance_mode: "manual", admission_reference: realAdmission }),
    false,
    "manual session must not be able to fabricate a real admission_reference (Law F)"
  );
});

test("agent-run.v1 adversarial cases", async () => {
  const { validatorsByVersion } = await buildWorkspaceValidators();
  const validate = validatorsByVersion["sensei.dashboard.agent-run.v1"];
  const base = await loadFixture("agent-run", "minimal.json");

  assert.equal(validate({ ...base, unexpected_field: "x" }), false);
  assert.equal(validate({ ...base, role: "bogus" }), false, "invalid role enum must be rejected");
  const { run_id, ...missingId } = base;
  assert.equal(validate(missingId), false, "missing required run_id must be rejected");
  assert.equal(validate({ ...base, expected_head_sha: "not-a-sha" }), false, "malformed expected_head_sha must be rejected");

  assert.equal(
    validate({ ...base, assurance_mode: "governed", admission_reference: null }),
    false,
    "governed run without admission_reference must be rejected"
  );
  const realAdmission = { admission_id: "a1", decision: "admitted", decision_digest_sha256: "a".repeat(64), policy_id: null };
  assert.equal(
    validate({ ...base, assurance_mode: "manual", admission_reference: realAdmission }),
    false,
    "manual run must not be able to fabricate a real admission_reference"
  );
});

test("execution-receipt.v1 adversarial cases", async () => {
  const { validatorsByVersion } = await buildWorkspaceValidators();
  const validate = validatorsByVersion["sensei.dashboard.execution-receipt.v1"];
  const base = await loadFixture("execution-receipt", "minimal.json");

  assert.equal(validate({ ...base, unexpected_field: "x" }), false);
  assert.equal(
    validate({ ...base, completion_facts: { ...base.completion_facts, tests_passed: "bogus" } }),
    false,
    "invalid completion_facts value must be rejected"
  );
  const { receipt_id, ...missingId } = base;
  assert.equal(validate(missingId), false, "missing required receipt_id must be rejected");
  assert.equal(
    validate({ ...base, changed_files: [{ path: "x", change_kind: "added", digest_sha256: "not-a-digest" }] }),
    false,
    "malformed changed_files digest must be rejected"
  );

  assert.equal(
    validate({ ...base, assurance_mode: "governed", admission_reference: null }),
    false,
    "governed receipt without admission_reference must be rejected"
  );
  const realAdmission = { admission_id: "a1", decision: "admitted", decision_digest_sha256: "a".repeat(64), policy_id: null };
  assert.equal(
    validate({ ...base, assurance_mode: "manual", admission_reference: realAdmission }),
    false,
    "manual receipt must not be able to fabricate a real admission_reference"
  );
});

test("provider-capabilities.v1 adversarial cases", async () => {
  const { validatorsByVersion } = await buildWorkspaceValidators();
  const validate = validatorsByVersion["sensei.dashboard.provider-capabilities.v1"];
  const base = await loadFixture("provider-capabilities", "minimal.json");

  assert.equal(validate({ ...base, unexpected_field: "x" }), false);
  assert.equal(validate({ ...base, capabilities: { ...base.capabilities, mcp: "yes" } }), false, "capability support state must be one of the closed enum");
  const { mcp, ...missingCap } = base.capabilities;
  assert.equal(validate({ ...base, capabilities: missingCap }), false, "missing a required capability key must be rejected");
});

test("provider-status.v1 adversarial cases", async () => {
  const { validatorsByVersion } = await buildWorkspaceValidators();
  const validate = validatorsByVersion["sensei.dashboard.provider-status.v1"];
  const base = await loadFixture("provider-status", "minimal.json");

  assert.equal(validate({ ...base, unexpected_field: "x" }), false);
  assert.equal(validate({ ...base, status: "bogus" }), false);
  const { status, ...missing } = base;
  assert.equal(validate(missing), false);
});

test("provider-event.v1 adversarial cases (discriminated union)", async () => {
  const { validatorsByVersion } = await buildWorkspaceValidators();
  const validate = validatorsByVersion["sensei.dashboard.provider-event.v1"];
  const base = await loadFixture("provider-event", "minimal.json");

  assert.equal(validate({ ...base, unexpected_field: "x" }), false);
  assert.equal(
    validate({ ...base, event_kind: "Started", payload: { path: "x", change_kind: "added" } }),
    false,
    "a payload shaped for a different event_kind must be rejected"
  );
  assert.equal(validate({ ...base, event_kind: "NotARealEvent", payload: {} }), false, "unknown event_kind must be rejected");
  const { event_kind, ...missing } = base;
  assert.equal(validate(missing), false, "missing required event_kind must be rejected");
});

test("github-action.v1 adversarial cases (request/result mutual exclusivity)", async () => {
  const { validatorsByVersion } = await buildWorkspaceValidators();
  const validate = validatorsByVersion["sensei.dashboard.github-action.v1"];
  const request = await loadFixture("github-action", "minimal-request.json");
  const result = await loadFixture("github-action", "complete-result.json");

  assert.equal(validate({ ...request, status: "succeeded" }), false, "a request must not carry result-only fields");
  assert.equal(validate({ ...result, payload: {} }), false, "a result must not carry request-only fields");
  assert.equal(validate({ ...request, action_kind: "merge" }), false, "automatic merge must not be a representable action_kind");
  assert.equal(validate({ ...request, kind: "delete" }), false, "kind must be exactly request or result");
  assert.equal(validate({ ...request, expected_head_sha: "not-a-sha" }), false, "malformed expected_head_sha must be rejected");
});

// --- Cross-contract proofs (brief's explicit list) ------------------------

test("cross-contract: execution receipt references an existing compatible run fixture", async () => {
  const run = await loadFixture("agent-run", "complete.json");
  const receipt = await loadFixture("execution-receipt", "complete.json");
  assert.equal(receipt.run_id, run.run_id);
  assert.equal(receipt.job_id, run.job_id);
  assert.equal(receipt.repository_domain, run.repository_domain);
  assert.equal(receipt.expected_head_sha, run.expected_head_sha);
  assert.deepEqual(receipt.governing_snapshot, run.governing_snapshot);
});

test("cross-contract: a governed run and session bind the same admission identity", async () => {
  const session = await loadFixture("architect-session", "complete.json");
  const run = await loadFixture("agent-run", "complete.json");
  assert.equal(session.assurance_mode, "governed");
  assert.equal(run.assurance_mode, "governed");
  assert.equal(session.admission_reference.admission_id, run.admission_reference.admission_id);
});

test("cross-contract: architect approval, CI status, completion verification, and merge state remain independent facts", async () => {
  const receipt = await loadFixture("execution-receipt", "complete.json");
  const facts = receipt.completion_facts;
  // The fixture deliberately mixes states to prove none is derived from another.
  assert.equal(facts.worker_completed, "yes");
  assert.equal(facts.ci_observed_green, "yes");
  assert.equal(facts.architect_exact_sha_approval, "unknown");
  assert.equal(facts.human_merge_occurred, "no");
  const keys = Object.keys(facts).sort();
  assert.deepEqual(keys, [
    "architect_exact_sha_approval",
    "ci_observed_green",
    "human_merge_occurred",
    "sensei_completion_verified",
    "tests_passed",
    "worker_completed",
  ]);
});
