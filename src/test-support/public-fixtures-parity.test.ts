// public/fixtures/dashboard-projection is a copy of docs/fixtures/dashboard-projection
// (the accepted, pinned fixtures — see contract/pin.json) made so the dev/
// build server has something real to serve at a stable URL. This test
// exists so the two copies can never silently drift apart — if
// docs/fixtures is ever re-pinned to a new Sensei commit, this fails until
// public/fixtures is updated to match.

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const FIXTURES = ["real-repo", "partial", "unavailable", "contested", "evolution-first-revision", "public-redacted"];

describe("public/fixtures mirrors docs/fixtures byte-for-byte", () => {
  for (const name of FIXTURES) {
    it(`${name}/projection.json is identical in both locations`, async () => {
      const docsPath = path.join(repoRoot, "docs", "fixtures", "dashboard-projection", "v1", name, "projection.json");
      const publicPath = path.join(repoRoot, "public", "fixtures", "dashboard-projection", "v1", name, "projection.json");
      const [docs, pub] = await Promise.all([readFile(docsPath, "utf8"), readFile(publicPath, "utf8")]);
      expect(pub).toBe(docs);
    });
  }
});
