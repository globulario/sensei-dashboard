import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateProjection } from "./schema-validate.js";

const fixtureRoot = path.resolve(import.meta.dirname, "..", "..", "docs", "fixtures", "dashboard-projection", "v1");

describe("validateProjection (real Draft 2020-12 validation at the adapter boundary)", () => {
  for (const name of ["real-repo", "partial", "unavailable", "contested", "evolution-first-revision", "public-redacted"]) {
    it(`accepts the accepted ${name} fixture`, async () => {
      const raw = await readFile(path.join(fixtureRoot, name, "projection.json"), "utf8");
      const result = validateProjection(JSON.parse(raw));
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  }

  it("rejects a document missing required top-level fields, with human-readable errors", () => {
    const result = validateProjection({ schema_version: "sensei.dashboard.projection.v1" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("identity"))).toBe(true);
  });

  it("rejects a non-object instance", () => {
    const result = validateProjection("not a projection");
    expect(result.valid).toBe(false);
  });
});
