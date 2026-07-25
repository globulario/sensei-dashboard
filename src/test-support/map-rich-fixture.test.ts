// The synthetic map-rich fixture (claude-stage-4-map-brief.md §9) is
// hand-authored, not producer-generated — this test is its own regression
// guard: it must stay schema-valid, Focus-integrity-valid, and keep
// carrying every shape Stage 4's tests rely on it for, so a future edit
// can't silently drop below the brief's required minimum bar.

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { validateProjection } from "../adapter/schema-validate.js";
import { validateFocusIntegrity } from "../adapter/focus-integrity.js";

const fixturePath = path.resolve(import.meta.dirname, "..", "..", "public", "fixtures", "_synthetic", "map-rich.json");

async function load(): Promise<SenseiDashboardProjectionV1> {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw) as SenseiDashboardProjectionV1;
}

describe("public/fixtures/_synthetic/map-rich.json", () => {
  it("validates against the pinned dashboard-projection-v1 schema", async () => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    const result = validateProjection(raw);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("passes Focus referential-integrity validation", async () => {
    const projection = await load();
    const result = validateFocusIntegrity(projection);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("is explicitly labeled as synthetic, never claiming producer parity", async () => {
    const projection = await load();
    expect(projection.identity.repository.display_name).toContain("SYNTHETIC");
    expect(projection.active_context).toBeNull();
  });

  it("carries at least 3 regions across at least 2 lanes", async () => {
    const projection = await load();
    expect(projection.regions.length).toBeGreaterThanOrEqual(3);
    const lanes = new Set(projection.regions.map((r) => r.visual_anchor.lane ?? ""));
    expect(lanes.size).toBeGreaterThanOrEqual(2);
  });

  it("carries multiple components", async () => {
    const projection = await load();
    expect(projection.components.length).toBeGreaterThan(1);
  });

  it("carries at least 2 distinct boundary kinds", async () => {
    const projection = await load();
    const kinds = new Set(projection.boundaries.map((b) => b.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it("carries a parallel contract pair (same two endpoints, opposite direction)", async () => {
    const projection = await load();
    const pairKey = (a: string, b: string) => [a, b].sort().join("|");
    const nonSelf = projection.contracts.filter((c) => c.source_ref !== c.target_ref);
    const grouped = new Map<string, number>();
    for (const c of nonSelf) {
      const key = pairKey(c.source_ref, c.target_ref);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    expect([...grouped.values()].some((count) => count >= 2)).toBe(true);
  });

  it("carries a bidirectional contract and a self-contract", async () => {
    const projection = await load();
    expect(projection.contracts.some((c) => c.direction === "bidirectional")).toBe(true);
    expect(projection.contracts.some((c) => c.source_ref === c.target_ref)).toBe(true);
  });

  it("carries a multi-step flow (>=3 steps) with at least one explicit contract_ref", async () => {
    const projection = await load();
    const flow = projection.flows.find((f) => f.steps.length >= 3);
    expect(flow).toBeDefined();
    expect(flow?.steps.some((s) => s.contract_ref)).toBe(true);
  });

  it("carries a mix of contested/unknown/open states, not just healthy", async () => {
    const projection = await load();
    const states = new Set([...projection.regions, ...projection.components, ...projection.contracts].map((x) => x.state));
    expect(states.has("contested")).toBe(true);
    expect(states.has("unknown")).toBe(true);
    expect(states.has("open")).toBe(true);
  });

  it("is not part of the pinned producer fixture set (contract/pin.json)", async () => {
    const pinRaw = await readFile(path.resolve(import.meta.dirname, "..", "..", "contract", "pin.json"), "utf8");
    expect(pinRaw).not.toContain("map-rich");
  });
});
