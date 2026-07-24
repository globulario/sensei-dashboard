import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateFocusIntegrity } from "./focus-integrity.js";
import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";

const fixtureRoot = path.resolve(import.meta.dirname, "..", "..", "docs", "fixtures", "dashboard-projection", "v1");

async function loadFixture(name: string): Promise<SenseiDashboardProjectionV1> {
  // Accepted-fixture directories hold "<name>/projection.json"; the two
  // invalid fixtures are flat files at "invalid/<name>.json".
  const filePath = name.startsWith("invalid/")
    ? path.join(fixtureRoot, `${name}.json`)
    : path.join(fixtureRoot, name, "projection.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as SenseiDashboardProjectionV1;
}

describe("validateFocusIntegrity", () => {
  for (const name of ["real-repo", "partial", "unavailable", "contested", "evolution-first-revision", "public-redacted"]) {
    it(`accepts the accepted ${name} fixture`, async () => {
      const projection = await loadFixture(name);
      const result = validateFocusIntegrity(projection);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  }

  it("rejects the accepted missing-focus-record fixture (a selectable component with zero focus_records entries)", async () => {
    const projection = await loadFixture("invalid/missing-focus-record");
    const result = validateFocusIntegrity(projection);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("component.orphan") && e.includes("no matching"))).toBe(true);
  });

  it("rejects the accepted duplicate-focus-record fixture (a selectable component with two focus_records entries)", async () => {
    const projection = await loadFixture("invalid/duplicate-focus-record");
    const result = validateFocusIntegrity(projection);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("component.dup") && e.includes("2 focus_records"))).toBe(true);
  });

  it("does not require a focus_records entry for a non-selectable attention item", async () => {
    const projection = await loadFixture("real-repo");
    const nonSelectableAttention = projection.attention.filter((a) => a.selectable !== true);
    expect(nonSelectableAttention.length).toBeGreaterThan(0);
    const result = validateFocusIntegrity(projection);
    expect(result.valid).toBe(true);
  });

  it("requires a focus_records entry for an attention item explicitly marked selectable", async () => {
    const projection = await loadFixture("real-repo");
    const withSelectableAttention: SenseiDashboardProjectionV1 = {
      ...projection,
      attention: [
        {
          id: "attention.synthetic-selectable",
          kind: "question",
          title: "t",
          summary: "s",
          severity: "low",
          state: "open",
          element_refs: [],
          selectable: true,
          provenance: { evidence_refs: [] },
        },
      ],
    };
    const result = validateFocusIntegrity(withSelectableAttention);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("attention.synthetic-selectable"))).toBe(true);
  });

  it("flags an orphan focus_records entry that matches no selectable element", async () => {
    const projection = await loadFixture("real-repo");
    const withOrphanFocusRecord: SenseiDashboardProjectionV1 = {
      ...projection,
      focus_records: [
        ...projection.focus_records,
        {
          element_ref: "component.does-not-exist",
          element_kind: "component",
          name: "Ghost",
          responsibility: "r",
          state: "unknown",
          owner_refs: [],
          contract_refs: [],
          flow_refs: [],
          attention_refs: [],
          decision_refs: [],
          provenance: { evidence_refs: [] },
        },
      ],
    };
    const result = validateFocusIntegrity(withOrphanFocusRecord);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("component.does-not-exist"))).toBe(true);
  });
});
