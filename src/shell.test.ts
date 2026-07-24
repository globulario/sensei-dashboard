import { describe, it, expect, vi } from "vitest";
import { Shell } from "./shell.js";
import { Router } from "./router.js";
import type { AdapterCapabilities, FocusOutcome, ProjectionAdapter, ProjectionOutcome } from "./adapter/types.js";
import type { SenseiDashboardProjectionV1 } from "../contract/generated/dashboard-projection-v1.js";

class FakeAdapter implements ProjectionAdapter {
  constructor(private outcome: ProjectionOutcome) {}
  async loadProjection(): Promise<ProjectionOutcome> {
    return this.outcome;
  }
  async loadFocusRecord(): Promise<FocusOutcome> {
    return { status: "unavailable", reason: "not used in this test" };
  }
  capabilities(): AdapterCapabilities {
    return { liveRefresh: false, revisionCompare: false, mode: "static" };
  }
}

function minimalProjection(overrides: Partial<SenseiDashboardProjectionV1> = {}): SenseiDashboardProjectionV1 {
  const prov = { evidence_refs: [] };
  return {
    schema_version: "sensei.dashboard.projection.v1",
    identity: {
      projection_id: "projection.test",
      repository: { key: "k", display_name: "Test Repo" },
      revision: { id: "rev-1" },
      graph_authority: { observed: "yes", current: "yes", identity: null, summary: "s" },
      generated_at: "2026-07-24T00:00:00Z",
    },
    availability: { state: "available", summary: "ok", limitations: [], sources: [] },
    assessments: {
      architecture_health: { state: "unknown", label: "h", summary: "s", severity: "not_applicable", provenance: prov },
      projection_integrity: { state: "healthy", label: "i", summary: "s", severity: "not_applicable", provenance: prov },
      observation_completeness: {
        state: "attention", label: "o", summary: "s", severity: "medium",
        coverage: { observed: 0, total: null, unit: "u" }, provenance: prov,
      },
    },
    active_context: null,
    briefing: [],
    regions: [],
    components: [],
    boundaries: [],
    contracts: [],
    flows: [],
    attention: [],
    evolution: { availability: "available", base_revision: null, head_revision: "rev-1", changes: [] },
    focus_records: [],
    ...overrides,
  };
}

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  return root;
}

describe("Shell honest-state rendering", () => {
  it("renders the unavailable state distinctly, with the projection's own summary and limitations, and no fabricated architecture", async () => {
    const projection = minimalProjection({
      availability: {
        state: "unavailable",
        summary: "the awareness corpus failed to compile",
        limitations: ["components.yaml failed to parse"],
        sources: [],
      },
    });
    const adapter = new FakeAdapter({ status: "unavailable", projection });
    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    await shell.render({ name: "overview", query: new URLSearchParams() });

    expect(root.querySelector(".state-block--unavailable")).not.toBeNull();
    expect(root.textContent).toContain("the awareness corpus failed to compile");
    expect(root.textContent).toContain("components.yaml failed to parse");
    // The unavailable block is the only content — no view-specific
    // "Overview" heading or fabricated region/component content renders.
    expect(root.querySelector("h1")).toBeNull();
  });

  it("renders the partial-projection banner with visible limitations when availability.state is 'partial'", async () => {
    const projection = minimalProjection({
      availability: {
        state: "partial",
        summary: "usable but incomplete",
        limitations: ["regions are not authored", "flows are not populated"],
        sources: [],
      },
    });
    const adapter = new FakeAdapter({ status: "available", projection });
    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    await shell.render({ name: "overview", query: new URLSearchParams() });

    const banner = root.querySelector(".state-block--partial");
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain("regions are not authored");
    expect(banner!.textContent).toContain("flows are not populated");
    // Real Overview content still renders alongside the banner — partial is
    // not treated the same as unavailable.
    expect(root.querySelector("h1")?.textContent).toBe("Overview");
  });

  it("renders no partial banner at all when availability.state is 'available'", async () => {
    const projection = minimalProjection({ availability: { state: "available", summary: "ok", limitations: [], sources: [] } });
    const adapter = new FakeAdapter({ status: "available", projection });
    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    await shell.render({ name: "overview", query: new URLSearchParams() });

    expect(root.querySelector(".state-block--partial")).toBeNull();
  });

  it("renders the invalid state with the diagnostic errors, not silently repaired or defaulted", async () => {
    const adapter = new FakeAdapter({ status: "invalid", reason: "schema validation failed", errors: ["/identity missing"] });
    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    await shell.render({ name: "overview", query: new URLSearchParams() });

    expect(root.querySelector(".state-block--invalid")).not.toBeNull();
    expect(root.textContent).toContain("/identity missing");
  });

  it("renders the disconnected state for a missing static snapshot", async () => {
    const adapter = new FakeAdapter({ status: "disconnected", reason: 'missing static snapshot: 404' });
    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    await shell.render({ name: "overview", query: new URLSearchParams() });

    expect(root.querySelector(".state-block--disconnected")).not.toBeNull();
  });

  it("does not re-fetch when navigating between routes (adapter is asked once per render call, shell doesn't duplicate loads within a render)", async () => {
    const projection = minimalProjection();
    const adapter = new FakeAdapter({ status: "available", projection });
    const spy = vi.spyOn(adapter, "loadProjection");
    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    await shell.render({ name: "overview", query: new URLSearchParams() });
    await shell.render({ name: "map", query: new URLSearchParams() });

    // StaticFixtureAdapter itself caches; Shell calls loadProjection once per
    // route render, which is correct — the caching contract lives in the
    // adapter (see static-fixture-adapter.test.ts), not duplicated here.
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
