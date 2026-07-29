#!/usr/bin/env node
// Verifies the producer-consumer parity handshake recorded in
// contract/pin.json AND, independently, contract/workspace/sensei-pin.json:
//
//   1. Every locally mirrored schema and fixture byte-matches its pinned
//      sha256 (catches accidental local drift/edits to a file that is
//      supposed to be an exact copy).
//   2. Unless SKIP_LIVE_PIN_CHECK=1, every one of those same pinned
//      artifacts is also byte-compared against the real file at the
//      manifest's source_commit in its source_repository over the network.
//      This is the actual producer-consumer parity proof: checking a
//      fixture only against a digest stored in this same file would let
//      the fixture and its digest drift together undetected, so every
//      pinned artifact gets the live check, not just the schemas.
//   3. Every fixture validates against the real, canonical JSON Schema its
//      `expect` field says it should.
//
// contract/pin.json and contract/workspace/sensei-pin.json are independent
// producer-consumer adoptions (two separate Sensei PRs, two separate source
// commits) and are checked as two separate passes below — adopting one must
// never repoint or otherwise affect the other's source_commit
// (docs/claude-workspace-o1-sensei-pin-parity-brief.md Law C).
//
// Run with `npm run verify:pin`. Exits non-zero on any mismatch. This is
// the same logic the test suite asserts on (see test/pin.test.mjs,
// test/workspace-pin.test.mjs, test/fixtures.test.mjs) via
// scripts/lib/pin.mjs — this file is the CLI/CI entry point, not a second
// implementation.

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  loadPin,
  loadWorkspacePin,
  sha256File,
  sha256Bytes,
  fetchRaw,
  buildValidators,
  buildSimpleValidators,
  allPinEntries,
  repoRoot,
} from "./lib/pin.mjs";

const skipLive = process.env.SKIP_LIVE_PIN_CHECK === "1";

/** Local-digest + live-parity checks shared by every manifest; returns the failure count. */
async function verifyManifestParity(manifest, label) {
  let failures = 0;
  console.log(`\n[${label}] pinned source: ${manifest.source_repository}@${manifest.source_commit}`);

  for (const entry of allPinEntries(manifest)) {
    const actual = await sha256File(entry.mirror_path);
    if (actual !== entry.sha256) {
      failures++;
      console.error(`MISMATCH (local): ${entry.mirror_path}\n  pinned:  ${entry.sha256}\n  actual:  ${actual}`);
    } else {
      console.log(`OK (local digest): ${entry.mirror_path}`);
    }
  }

  if (skipLive) {
    console.log(`[${label}] SKIP_LIVE_PIN_CHECK=1: skipping live cross-repo byte comparison.`);
  } else {
    for (const entry of allPinEntries(manifest)) {
      try {
        const remote = await fetchRaw(manifest.source_repository, manifest.source_commit, entry.source_path);
        const remoteDigest = sha256Bytes(remote);
        if (remoteDigest !== entry.sha256) {
          failures++;
          console.error(
            `MISMATCH (live): ${entry.source_path} at ${manifest.source_repository}@${manifest.source_commit}\n  pinned:  ${entry.sha256}\n  live:    ${remoteDigest}`
          );
        } else {
          console.log(`OK (live parity): ${entry.source_path}@${manifest.source_commit}`);
        }
      } catch (err) {
        failures++;
        console.error(`ERROR fetching ${entry.source_path}@${manifest.source_commit}: ${err.message}`);
      }
    }
  }

  return failures;
}

async function main() {
  let failures = 0;

  const pin = await loadPin();
  failures += await verifyManifestParity(pin, "contract/pin.json");

  const { validateProjection, validateHandoff } = await buildValidators();
  for (const fixture of pin.fixtures) {
    const instance = JSON.parse(await readFile(path.join(repoRoot, fixture.mirror_path), "utf8"));
    const validator = fixture.schema_version === "sensei.dashboard.agent-handoff.v1" ? validateHandoff : validateProjection;
    const valid = validator(instance);
    if (!valid) {
      failures++;
      console.error(`SCHEMA INVALID: ${fixture.mirror_path}`);
      for (const e of validator.errors ?? []) {
        console.error(`  ${e.instancePath || "/"} ${e.message}`);
      }
    } else {
      console.log(`OK (schema-valid): ${fixture.mirror_path}`);
    }
  }

  const workspacePin = await loadWorkspacePin();
  failures += await verifyManifestParity(workspacePin, "contract/workspace/sensei-pin.json");

  const { validatorsByFile } = await buildSimpleValidators(
    path.join(repoRoot, "docs"),
    workspacePin.schemas.map((s) => path.basename(s.mirror_path))
  );
  const validatorByVersion = {};
  for (const schema of workspacePin.schemas) {
    validatorByVersion[schema.schema_version] = validatorsByFile[path.basename(schema.mirror_path)];
  }
  for (const fixture of workspacePin.fixtures) {
    const instance = JSON.parse(await readFile(path.join(repoRoot, fixture.mirror_path), "utf8"));
    const validator = validatorByVersion[fixture.schema_version];
    const valid = validator(instance);
    if (!valid) {
      failures++;
      console.error(`SCHEMA INVALID: ${fixture.mirror_path}`);
      for (const e of validator.errors ?? []) {
        console.error(`  ${e.instancePath || "/"} ${e.message}`);
      }
    } else {
      console.log(`OK (schema-valid): ${fixture.mirror_path}`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll pin/parity/schema checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
