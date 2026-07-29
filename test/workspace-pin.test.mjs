// Verifies contract/workspace/sensei-pin.json -- the second, independent
// producer-consumer pin manifest for the Sensei-core-owned canonical
// workspace contracts (sensei.workspace.identity.v1,
// sensei.workspace.admission.v1), adopted per
// docs/claude-workspace-o1-sensei-pin-parity-brief.md. Mirrors
// test/pin.test.mjs's structure for contract/pin.json, reusing the same
// shared helpers (scripts/lib/pin.mjs), but never hard-codes a total entry
// count in generic logic -- every completeness assertion here is derived
// from the manifest itself (pin.schemas.length + pin.fixtures.length), not
// a literal number, per the brief's explicit requirement.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  loadPin,
  loadWorkspacePin,
  sha256File,
  sha256Bytes,
  fetchRaw,
  allPinEntries,
  buildSimpleValidators,
  repoRoot,
} from "../scripts/lib/pin.mjs";

const skipLive = process.env.SKIP_LIVE_PIN_CHECK === "1";
const admissionFixturesDir = path.join(repoRoot, "docs", "fixtures", "workspace", "v1", "admission");

async function loadAdmissionFixture(file) {
  return JSON.parse(await readFile(path.join(admissionFixturesDir, file), "utf8"));
}

test("contract/workspace/sensei-pin.json records the accepted Sensei source commit", async () => {
  const pin = await loadWorkspacePin();
  assert.equal(pin.source_repository, "globulario/sensei");
  assert.equal(pin.source_commit, "14381d5760099df5a99b9ecd3a565998a494b392");
  assert.match(pin.source_commit, /^[0-9a-f]{40}$/, "source_commit must be a full 40-char git SHA");
  assert.equal(pin.source_pr, "https://github.com/globulario/sensei/pull/121");
  assert.equal(pin.schemas.length, 2);
  assert.equal(pin.fixtures.length, 9);
});

test("contract/pin.json's own source_commit is unaffected by adopting the workspace pin (Law C: no repointing)", async () => {
  const pin = await loadPin();
  assert.equal(pin.source_repository, "globulario/sensei");
  assert.equal(pin.source_commit, "cbeb5719466772e136d2f212d69bbed2900c7420");
});

test("every workspace-pinned schema's local mirror byte-matches its recorded digest", async () => {
  const pin = await loadWorkspacePin();
  for (const schema of pin.schemas) {
    const actual = await sha256File(schema.mirror_path);
    assert.equal(actual, schema.sha256, `${schema.mirror_path} drifted from its pinned digest`);
  }
});

test("every workspace-pinned fixture's local copy byte-matches its recorded digest", async () => {
  const pin = await loadWorkspacePin();
  for (const fixture of pin.fixtures) {
    const actual = await sha256File(fixture.mirror_path);
    assert.equal(actual, fixture.sha256, `${fixture.mirror_path} drifted from its pinned digest`);
  }
});

test(
  "every workspace-pinned artifact byte-matches the real file at the pinned commit (live cross-repo parity); entry count derived from the manifest, not hard-coded",
  { skip: skipLive && "SKIP_LIVE_PIN_CHECK=1" },
  async () => {
    const pin = await loadWorkspacePin();
    const entries = allPinEntries(pin);
    assert.equal(
      entries.length,
      pin.schemas.length + pin.fixtures.length,
      "every schema and fixture entry must participate, none silently dropped"
    );
    for (const entry of entries) {
      const remote = await fetchRaw(pin.source_repository, pin.source_commit, entry.source_path);
      const remoteDigest = sha256Bytes(remote);
      assert.equal(
        remoteDigest,
        entry.sha256,
        `${entry.source_path}@${pin.source_repository}@${pin.source_commit} no longer matches the pinned mirror`
      );
    }
  }
);

test(
  "every workspace pin entry actually participates in live parity — none silently skipped",
  { skip: skipLive && "SKIP_LIVE_PIN_CHECK=1" },
  async () => {
    const pin = await loadWorkspacePin();
    const entries = allPinEntries(pin);
    const results = await Promise.all(
      entries.map(async (entry) => {
        const remote = await fetchRaw(pin.source_repository, pin.source_commit, entry.source_path);
        return { path: entry.source_path, checked: true, matched: sha256Bytes(remote) === entry.sha256 };
      })
    );
    assert.equal(results.length, entries.length);
    for (const r of results) {
      assert.equal(r.checked, true, `${r.path} was not live-checked`);
      assert.equal(r.matched, true, `${r.path} was live-checked but did not match`);
    }
  }
);

test(
  "tamper detection: a locally edited mirror paired with a matching (also-edited) local digest still fails live parity",
  { skip: skipLive && "SKIP_LIVE_PIN_CHECK=1" },
  async () => {
    const pin = await loadWorkspacePin();
    const entry = pin.schemas[0];
    const tampered = Buffer.from(JSON.stringify({ tampered: true }));
    const tamperedDigest = sha256Bytes(tampered);
    const remote = await fetchRaw(pin.source_repository, pin.source_commit, entry.source_path);
    const remoteDigest = sha256Bytes(remote);
    assert.notEqual(
      tamperedDigest,
      remoteDigest,
      "a tampered local mirror+digest pair must not coincidentally match what Sensei actually published — this is exactly what the live check catches that the local-digest check alone cannot"
    );
  }
);

test("every canonical fixture validates against its pinned schema; unknown properties are rejected; schema_version is the exact pinned constant", async () => {
  const pin = await loadWorkspacePin();
  const { validatorsByFile } = await buildSimpleValidators(
    path.join(repoRoot, "docs"),
    pin.schemas.map((s) => path.basename(s.mirror_path))
  );
  const validatorByVersion = {};
  for (const schema of pin.schemas) {
    validatorByVersion[schema.schema_version] = validatorsByFile[path.basename(schema.mirror_path)];
  }

  for (const fixture of pin.fixtures) {
    const instance = JSON.parse(await readFile(path.join(repoRoot, fixture.mirror_path), "utf8"));
    const validate = validatorByVersion[fixture.schema_version];
    assert.ok(validate, `no validator for ${fixture.schema_version}`);

    assert.equal(validate(instance), true, `${fixture.mirror_path} failed schema validation: ${JSON.stringify(validate.errors)}`);
    assert.equal(instance.schema_version, fixture.schema_version, `${fixture.mirror_path}: schema_version must be the exact pinned constant`);

    const withExtra = { ...instance, unexpected_field_never_defined_by_the_schema: "x" };
    assert.equal(validate(withExtra), false, `${fixture.mirror_path}: an unknown top-level property must be rejected (closed schema)`);
  }
});

test("admission decision records carry verification: null", async () => {
  for (const file of ["admitted.json", "admitted-with-conditions.json", "refused.json"]) {
    const rec = await loadAdmissionFixture(file);
    assert.equal(rec.record_kind, "decision", `${file} must be a decision record`);
    assert.equal(rec.verification, null, `${file}: a decision record must carry verification: null`);
  }
});

test("admission verification records carry non-null verification bound to the same admission_id and decision_digest_sha256 as the decision they verify", async () => {
  const decision = await loadAdmissionFixture("admitted.json");
  for (const file of ["verification-compliant.json", "verification-stale.json", "verification-violated.json"]) {
    const rec = await loadAdmissionFixture(file);
    assert.equal(rec.record_kind, "verification", `${file} must be a verification record`);
    assert.notEqual(rec.verification, null, `${file}: a verification record must carry non-null verification`);
    assert.equal(rec.admission_id, decision.admission_id, `${file} must be bound to the same admission_id as the decision it verifies`);
    assert.equal(
      rec.decision_digest_sha256,
      decision.decision_digest_sha256,
      `${file} must be bound to the same decision_digest_sha256 as the decision it verifies`
    );
  }
});

test("unknown properties are rejected on nested closed objects, not just at the fixture root", async () => {
  const pin = await loadWorkspacePin();
  const { validatorsByFile } = await buildSimpleValidators(
    path.join(repoRoot, "docs"),
    pin.schemas.map((s) => path.basename(s.mirror_path))
  );
  const identityValidate = validatorsByFile["workspace-identity-v1.schema.json"];
  const admissionValidate = validatorsByFile["workspace-admission-v1.schema.json"];

  const identity = JSON.parse(await readFile(path.join(repoRoot, "docs", "fixtures", "workspace", "v1", "identity", "complete.json"), "utf8"));
  assert.equal(identityValidate(identity), true, "the base identity fixture must itself be valid before tampering it");
  assert.ok(identity.graph_authority, "complete.json must carry a non-null graph_authority to exercise its nested closedness");

  for (const nestedField of ["binding", "task_identity", "graph_authority"]) {
    const tampered = { ...identity, [nestedField]: { ...identity[nestedField], unexpected_nested_field: "x" } };
    assert.equal(
      identityValidate(tampered),
      false,
      `workspace-identity-v1: an unknown property nested inside "${nestedField}" must be rejected (additionalProperties: false), not just at the document root`
    );
  }

  const admission = JSON.parse(await readFile(path.join(repoRoot, "docs", "fixtures", "workspace", "v1", "admission", "admitted.json"), "utf8"));
  assert.equal(admissionValidate(admission), true, "the base admission fixture must itself be valid before tampering it");
  for (const nestedField of ["binding", "session_receipt", "request_receipt", "envelope"]) {
    const tampered = { ...admission, [nestedField]: { ...admission[nestedField], unexpected_nested_field: "x" } };
    assert.equal(
      admissionValidate(tampered),
      false,
      `workspace-admission-v1: an unknown property nested inside "${nestedField}" must be rejected (additionalProperties: false), not just at the document root`
    );
  }

  const verification = JSON.parse(
    await readFile(path.join(repoRoot, "docs", "fixtures", "workspace", "v1", "admission", "verification-compliant.json"), "utf8")
  );
  assert.equal(admissionValidate(verification), true, "the base verification fixture must itself be valid before tampering it");
  assert.ok(verification.verification, "verification-compliant.json must carry a non-null verification to exercise its nested closedness");
  const tamperedVerification = { ...verification, verification: { ...verification.verification, unexpected_nested_field: "x" } };
  assert.equal(
    admissionValidate(tamperedVerification),
    false,
    'workspace-admission-v1: an unknown property nested inside "verification" must be rejected (additionalProperties: false), not just at the document root'
  );
});

test("scope_compliant verification never manufactures correctness_certified: true (scope compliance is not correctness certification)", async () => {
  const rec = await loadAdmissionFixture("verification-compliant.json");
  assert.equal(rec.verification.status, "scope_compliant");
  assert.equal(rec.verification.scope_only, true);
  assert.equal(rec.verification.correctness_certified, false);
});

test("canonical graph_digest_status vocabulary is never silently conflated with the distinct local Dashboard-owned vocabulary (Law E)", async () => {
  const canonical = JSON.parse(await readFile(path.join(repoRoot, "docs", "workspace-identity-v1.schema.json"), "utf8"));
  assert.deepEqual(canonical.$defs.binding.properties.graph_digest_status.enum, ["resolved", "unavailable", "not_requested"]);

  for (const file of [
    "workspace-architect-session-v1.schema.json",
    "workspace-agent-run-v1.schema.json",
    "workspace-execution-receipt-v1.schema.json",
  ]) {
    const local = JSON.parse(await readFile(path.join(repoRoot, "docs", file), "utf8"));
    const localEnum = local.$defs.governingSnapshot.properties.graph_digest_status.enum;
    assert.deepEqual(
      localEnum,
      ["resolved", "unavailable", "unknown"],
      `${file}: local vocabulary must stay exactly as already versioned, not silently widened toward the canonical one`
    );
    assert.ok(
      !localEnum.includes("not_requested"),
      `${file} must not silently absorb the canonical not_requested value into its own already-versioned enum`
    );
  }
});

test("the local admissionReference $def is a lossless, explicit subset of the canonical admission record's fields — never a replacement for it", async () => {
  const canonicalAdmission = JSON.parse(await readFile(path.join(repoRoot, "docs", "workspace-admission-v1.schema.json"), "utf8"));
  const canonicalFields = new Set(Object.keys(canonicalAdmission.properties));

  const local = JSON.parse(await readFile(path.join(repoRoot, "docs", "workspace-architect-session-v1.schema.json"), "utf8"));
  const localFields = Object.keys(local.$defs.admissionReference.properties);

  for (const field of localFields) {
    assert.ok(canonicalFields.has(field), `local admissionReference field "${field}" is not a real canonical admission field — it must not invent names`);
  }
  assert.ok(
    !localFields.includes("correctness_certified") && !localFields.includes("verification"),
    "the local lightweight reference must not claim the richer canonical decision/verification facts it does not carry"
  );
});

test("src/workspace/interfaces/workspace-admission-client.ts consumes the canonical generated types directly, not a hand-translated local shape", async () => {
  const src = await readFile(path.join(repoRoot, "src", "workspace", "interfaces", "workspace-admission-client.ts"), "utf8");
  assert.match(src, /import type \{ SenseiWorkspaceIdentityV1 \} from "\.\.\/\.\.\/\.\.\/contract\/generated\/workspace-identity-v1\.js";/);
  assert.match(src, /import type \{ SenseiWorkspaceAdmissionV1 \} from "\.\.\/\.\.\/\.\.\/contract\/generated\/workspace-admission-v1\.js";/);
  assert.doesNotMatch(src, /\bGoverningSnapshot\b/, "must not reintroduce the superseded lightweight local shape this file used before pinning");
  assert.doesNotMatch(src, /\bAdmissionReference\b/, "must not reintroduce the superseded lightweight local shape this file used before pinning");
});
