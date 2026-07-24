#!/usr/bin/env node
// Verifies the producer-consumer parity handshake recorded in
// contract/pin.json:
//
//   1. Every locally mirrored schema and fixture byte-matches its pinned
//      sha256 (catches accidental local drift/edits to a file that is
//      supposed to be an exact copy).
//   2. Unless SKIP_LIVE_PIN_CHECK=1, every one of those same pinned
//      artifacts — both schemas AND all ten fixtures, 12 total — is also
//      byte-compared against the real file at pin.source_commit in
//      pin.source_repository over the network. This is the actual
//      producer-consumer parity proof: checking a fixture only against a
//      digest stored in this same file would let the fixture and its
//      digest drift together undetected, so every pinned artifact gets the
//      live check, not just the two schemas.
//   3. Every fixture validates against the real, canonical JSON Schema its
//      `expect` field says it should.
//
// Run with `npm run verify:pin`. Exits non-zero on any mismatch. This is
// the same logic the test suite asserts on (see test/pin.test.mjs,
// test/fixtures.test.mjs) via scripts/lib/pin.mjs — this file is the CLI/CI
// entry point, not a second implementation.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadPin, sha256File, sha256Bytes, fetchRaw, buildValidators, allPinEntries, repoRoot } from "./lib/pin.mjs";

const skipLive = process.env.SKIP_LIVE_PIN_CHECK === "1";

async function main() {
  const pin = await loadPin();
  let failures = 0;

  console.log(`Pinned source: ${pin.source_repository}@${pin.source_commit}`);

  for (const entry of allPinEntries(pin)) {
    const actual = await sha256File(entry.mirror_path);
    if (actual !== entry.sha256) {
      failures++;
      console.error(`MISMATCH (local): ${entry.mirror_path}\n  pinned:  ${entry.sha256}\n  actual:  ${actual}`);
    } else {
      console.log(`OK (local digest): ${entry.mirror_path}`);
    }
  }

  if (skipLive) {
    console.log("SKIP_LIVE_PIN_CHECK=1: skipping live cross-repo byte comparison.");
  } else {
    for (const entry of allPinEntries(pin)) {
      try {
        const remote = await fetchRaw(pin.source_repository, pin.source_commit, entry.source_path);
        const remoteDigest = sha256Bytes(remote);
        if (remoteDigest !== entry.sha256) {
          failures++;
          console.error(
            `MISMATCH (live): ${entry.source_path} at ${pin.source_repository}@${pin.source_commit}\n  pinned:  ${entry.sha256}\n  live:    ${remoteDigest}`
          );
        } else {
          console.log(`OK (live parity): ${entry.source_path}@${pin.source_commit}`);
        }
      } catch (err) {
        failures++;
        console.error(`ERROR fetching ${entry.source_path}@${pin.source_commit}: ${err.message}`);
      }
    }
  }

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
