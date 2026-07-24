import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPin, sha256File, sha256Bytes, fetchRaw, allPinEntries } from "../scripts/lib/pin.mjs";

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

// Every artifact contract/pin.json pins — both schemas AND all ten
// fixtures — must be live-verified against the pinned commit, not just the
// two schemas. Checking a fixture only against a digest recorded in this
// same pin.json would let the fixture and its digest drift together
// without CI ever proving they still match what Sensei actually published;
// the live fetch is the only check that catches that.
test(
  "every pinned artifact (schemas + all fixtures) byte-matches the real file at the pinned commit, fetched from pin.source_repository (live cross-repo parity)",
  { skip: skipLive && "SKIP_LIVE_PIN_CHECK=1" },
  async () => {
    const pin = await loadPin();
    const entries = allPinEntries(pin);
    assert.equal(entries.length, 12, "expected 2 schemas + 10 fixtures = 12 pinned artifacts");
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
  "every pin entry actually participates in live parity — none silently skipped",
  { skip: skipLive && "SKIP_LIVE_PIN_CHECK=1" },
  async () => {
    const pin = await loadPin();
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
