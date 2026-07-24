import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPin, sha256File, sha256Bytes, fetchRaw } from "../scripts/lib/pin.mjs";

const skipLive = process.env.SKIP_LIVE_PIN_CHECK === "1";

test("pin.json records the accepted Sensei source commit", async () => {
  const pin = await loadPin();
  assert.equal(pin.source_repository, "globulario/sensei");
  assert.equal(pin.source_commit, "cbeb5719466772e136d2f212d69bbed2900c7420");
  assert.match(pin.source_commit, /^[0-9a-f]{40}$/, "source_commit must be a full 40-char git SHA");
});

test("every pinned schema's local mirror byte-matches its recorded digest", async () => {
  const pin = await loadPin();
  for (const schema of pin.schemas) {
    const actual = await sha256File(schema.mirror_path);
    assert.equal(actual, schema.sha256, `${schema.mirror_path} drifted from its pinned digest`);
  }
});

test("every imported fixture's local copy byte-matches its recorded digest", async () => {
  const pin = await loadPin();
  for (const fixture of pin.fixtures) {
    const actual = await sha256File(fixture.mirror_path);
    assert.equal(actual, fixture.sha256, `${fixture.mirror_path} drifted from its pinned digest`);
  }
});

test(
  "every pinned schema byte-matches the real file at the pinned commit in globulario/sensei (live cross-repo parity)",
  { skip: skipLive && "SKIP_LIVE_PIN_CHECK=1" },
  async () => {
    const pin = await loadPin();
    for (const schema of pin.schemas) {
      const remote = await fetchRaw(pin.source_commit, schema.source_path);
      const remoteDigest = sha256Bytes(remote);
      assert.equal(
        remoteDigest,
        schema.sha256,
        `${schema.source_path}@${pin.source_commit} in globulario/sensei no longer matches the pinned mirror`
      );
    }
  }
);
