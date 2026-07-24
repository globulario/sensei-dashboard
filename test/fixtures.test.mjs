import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadPin, buildValidators, repoRoot } from "../scripts/lib/pin.mjs";

test("both vendored schemas parse as JSON and are closed (additionalProperties: false at the root)", async () => {
  const { projectionSchema, handoffSchema } = await buildValidators();
  assert.equal(projectionSchema.additionalProperties, false);
  assert.equal(handoffSchema.additionalProperties, false);
});

test("every fixture with expect: valid or schema-valid-producer-invalid passes real Draft 2020-12 schema validation", async () => {
  const pin = await loadPin();
  const { validateProjection, validateHandoff } = await buildValidators();

  for (const fixture of pin.fixtures) {
    const instance = JSON.parse(await readFile(path.join(repoRoot, fixture.mirror_path), "utf8"));
    const validator = fixture.schema_version === "sensei.dashboard.agent-handoff.v1" ? validateHandoff : validateProjection;
    const valid = validator(instance);
    assert.equal(
      valid,
      true,
      `${fixture.mirror_path} failed schema validation: ${JSON.stringify(validator.errors, null, 2)}`
    );
  }
});

test("the two 'invalid' fixtures are labeled schema-valid-producer-invalid, not schema-invalid", async () => {
  const pin = await loadPin();
  const invalidOnes = pin.fixtures.filter((f) => f.mirror_path.includes("/invalid/"));
  assert.equal(invalidOnes.length, 2, "expected exactly the missing/duplicate focus-record fixtures");
  for (const f of invalidOnes) {
    assert.equal(
      f.expect,
      "schema-valid-producer-invalid",
      `${f.mirror_path} must be documented as schema-valid but producer-invalid — its defect is a cross-record rule JSON Schema cannot express, verified in Sensei's own test suite, not this mirror`
    );
  }
});

test("real-repo fixture reflects the honest partial-availability state (not available)", async () => {
  const data = JSON.parse(
    await readFile(path.join(repoRoot, "docs/fixtures/dashboard-projection/v1/real-repo/projection.json"), "utf8")
  );
  assert.equal(
    data.availability.state,
    "partial",
    "the real Sensei projection must stay honestly partial (regions/flows/architecture_health are not authored yet) — a value of 'available' here would mean this fixture is stale relative to what Sensei's producer actually emits"
  );
});

test("public-redacted fixture actually has active_context: null", async () => {
  const data = JSON.parse(
    await readFile(path.join(repoRoot, "docs/fixtures/dashboard-projection/v1/public-redacted/projection.json"), "utf8")
  );
  assert.equal(data.active_context, null);
});
