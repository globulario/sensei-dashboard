import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { buildArchitectureMapModel } from "./model.js";

const fixtureRoot = path.resolve(import.meta.dirname, "..", "..", "docs", "fixtures", "dashboard-projection", "v1");

async function loadRealRepo(): Promise<SenseiDashboardProjectionV1> {
  const raw = await readFile(path.join(fixtureRoot, "real-repo", "projection.json"), "utf8");
  return JSON.parse(raw) as SenseiDashboardProjectionV1;
}

describe("buildArchitectureMapModel — determinism", () => {
  it("identical input creates identical output, byte-equivalent after canonical serialization", async () => {
    const projection = await loadRealRepo();
    const a = buildArchitectureMapModel(projection);
    const b = buildArchitectureMapModel(projection);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("never mutates the input projection", async () => {
    const projection = await loadRealRepo();
    const before = JSON.stringify(projection);
    buildArchitectureMapModel(projection);
    expect(JSON.stringify(projection)).toBe(before);
  });

  it("shuffled top-level collection arrays produce an identical model", async () => {
    const projection = await loadRealRepo();
    const shuffled: SenseiDashboardProjectionV1 = {
      ...projection,
      regions: [...projection.regions].reverse(),
      components: [...projection.components].reverse(),
      boundaries: [...projection.boundaries].reverse(),
      contracts: [...projection.contracts].reverse(),
      flows: [...projection.flows].reverse(),
    };
    const a = buildArchitectureMapModel(projection);
    const b = buildArchitectureMapModel(shuffled);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("real-repo's own default fixture builds with no diagnostics and self-contract-only contracts", async () => {
    const projection = await loadRealRepo();
    const model = buildArchitectureMapModel(projection);
    expect(model.diagnostics).toEqual([]);
    expect(model.contracts.every((c) => c.isSelfLoop)).toBe(true);
    expect(model.contracts.every((c) => c.route !== null)).toBe(true);
  });

  it("an empty projection produces an honest empty model, not a crash", async () => {
    const projection = await loadRealRepo();
    const empty: SenseiDashboardProjectionV1 = { ...projection, regions: [], components: [], boundaries: [], contracts: [], flows: [] };
    const model = buildArchitectureMapModel(empty);
    expect(model.regions).toEqual([]);
    expect(model.components).toEqual([]);
    expect(model.boundaries).toEqual([]);
    expect(model.contracts).toEqual([]);
    expect(model.flows).toEqual([]);
    expect(model.diagnostics).toEqual([]);
  });

  it("bounds contain every placed region and component rect", async () => {
    const projection = await loadRealRepo();
    const model = buildArchitectureMapModel(projection);
    for (const node of [...model.regions, ...model.components]) {
      expect(node.rect.x).toBeGreaterThanOrEqual(model.bounds.x);
      expect(node.rect.y).toBeGreaterThanOrEqual(model.bounds.y);
      expect(node.rect.x + node.rect.width).toBeLessThanOrEqual(model.bounds.x + model.bounds.width);
      expect(node.rect.y + node.rect.height).toBeLessThanOrEqual(model.bounds.y + model.bounds.height);
    }
  });
});
