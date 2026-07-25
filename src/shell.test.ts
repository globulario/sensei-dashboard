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
  // Every Shell creates its own id="main-content" element; leaving prior
  // tests' roots attached would pile up duplicate ids in the same document
  // and make id-based queries (and focus/activeElement) unreliable.
  document.body.replaceChildren();
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

  it("renders the projection's own availability state and limitations visibly when availability.state is 'partial'", async () => {
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

    // Stage 3 (claude-stage-3-brief.md §1.1) integrates availability into
    // the identity/assessment strip rather than a separate banner — the
    // guarantee under test is that partial state and its limitations remain
    // visible, not the specific element shape that carries them.
    const availabilityToken = root.querySelector(".status-token--partial");
    expect(availabilityToken).not.toBeNull();
    expect(root.textContent).toContain("regions are not authored");
    expect(root.textContent).toContain("flows are not populated");
    // Real Overview content still renders alongside it — partial is not
    // treated the same as unavailable.
    expect(root.querySelector("h1")?.textContent).toBe("Test Repo");
  });

  it("renders no partial availability indicator when availability.state is 'available'", async () => {
    const projection = minimalProjection({ availability: { state: "available", summary: "ok", limitations: [], sources: [] } });
    const adapter = new FakeAdapter({ status: "available", projection });
    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    await shell.render({ name: "overview", query: new URLSearchParams() });

    expect(root.querySelector(".status-token--partial")).toBeNull();
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

  it("passes the map route's ?lens= query through to the Architecture Map view (Stage 4)", async () => {
    const prov = { evidence_refs: [] };
    const projection = minimalProjection({
      regions: [
        {
          id: "region.a",
          name: "Region A",
          responsibility: "r",
          state: "open",
          component_refs: ["component.a"],
          visual_anchor: { order: 0 },
          provenance: prov,
        },
      ],
      components: [
        {
          id: "component.a",
          name: "Component A",
          region_ref: "region.a",
          responsibility: "r",
          state: "open",
          authority_refs: [],
          visual_anchor: { order: 0 },
          provenance: prov,
        },
      ],
    });
    const adapter = new FakeAdapter({ status: "available", projection });
    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    await shell.render({ name: "map", query: new URLSearchParams("lens=authority") });

    const svg = root.querySelector("svg.arch-map-svg");
    expect(svg?.getAttribute("class")).toContain("map-lens-authority");
    expect(root.querySelector('.map-lens-control__link[aria-current="true"]')?.textContent).toBe("Authority");
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

  it("moves focus to the main content region after a route renders (claude-stage-3-brief.md §5)", async () => {
    const projection = minimalProjection();
    const adapter = new FakeAdapter({ status: "available", projection });
    const root = mount();
    const shell = new Shell(root, adapter, new Router());
    // #buildChrome() creates #main-content synchronously in the Shell
    // constructor, before any render() call — spying on the real DOM API
    // directly is deterministic, unlike asserting on document.activeElement
    // after the fact (jsdom's activeElement bookkeeping is not reliable
    // across a suite that piles up many detached-but-still-in-document
    // roots from earlier tests).
    const main = root.querySelector("#main-content") as HTMLElement;
    const focusSpy = vi.spyOn(main, "focus");

    await shell.render({ name: "overview", query: new URLSearchParams() });

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("moves focus to main content for a non-available outcome too, so the honest state is announced", async () => {
    const adapter = new FakeAdapter({ status: "disconnected", reason: "missing static snapshot: 404" });
    const root = mount();
    const shell = new Shell(root, adapter, new Router());
    const main = root.querySelector("#main-content") as HTMLElement;
    const focusSpy = vi.spyOn(main, "focus");

    await shell.render({ name: "overview", query: new URLSearchParams() });

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});

describe("Shell — stale async render protection (adversarial)", () => {
  function focusRecord(id: string, name: string) {
    return {
      element_ref: id,
      element_kind: "component" as const,
      name,
      responsibility: `Responsibility for ${name}`,
      state: "open" as const,
      owner_refs: [],
      contract_refs: [],
      flow_refs: [],
      attention_refs: [],
      decision_refs: [],
      provenance: { evidence_refs: [] },
    };
  }

  /** An adapter whose loadFocusRecord() for a chosen id never resolves
   * until the test explicitly releases it — lets a test force element A's
   * response to arrive strictly after element B's. */
  class ControlledFocusAdapter implements ProjectionAdapter {
    #projection: SenseiDashboardProjectionV1;
    #pending = new Map<string, { promise: Promise<FocusOutcome>; resolve: (o: FocusOutcome) => void }>();

    constructor(projection: SenseiDashboardProjectionV1) {
      this.#projection = projection;
    }

    async loadProjection(): Promise<ProjectionOutcome> {
      return { status: "available", projection: this.#projection };
    }

    holdFocusRecord(elementId: string): void {
      let resolve!: (o: FocusOutcome) => void;
      const promise = new Promise<FocusOutcome>((r) => {
        resolve = r;
      });
      this.#pending.set(elementId, { promise, resolve });
    }

    releaseFocusRecord(elementId: string, outcome: FocusOutcome): void {
      this.#pending.get(elementId)?.resolve(outcome);
    }

    async loadFocusRecord(elementId: string): Promise<FocusOutcome> {
      const held = this.#pending.get(elementId);
      if (held) return held.promise;
      const record = this.#projection.focus_records.find((r) => r.element_ref === elementId);
      return record ? { status: "found", record } : { status: "not_found", elementId };
    }

    capabilities(): AdapterCapabilities {
      return { liveRefresh: false, revisionCompare: false, mode: "static" };
    }
  }

  it("a slower response for an earlier /element/:id navigation does not overwrite a faster response for a later one (the exact bug reported: comparing only route.name is not enough, since both are 'element')", async () => {
    const projection = minimalProjection({
      focus_records: [focusRecord("component.a", "ComponentAAA"), focusRecord("component.b", "ComponentBBB")],
    });
    const adapter = new ControlledFocusAdapter(projection);
    adapter.holdFocusRecord("component.a"); // A will not resolve until we say so

    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    // Navigate to A, then immediately to B, without awaiting A first — this
    // is what a fast double-click / back-then-forward on Focus links does.
    const renderA = shell.render({ name: "element", elementId: "component.a", query: new URLSearchParams() });
    const renderB = shell.render({ name: "element", elementId: "component.b", query: new URLSearchParams() });

    await renderB;
    expect(root.textContent).toContain("ComponentBBB");

    // Now let A's slow response arrive, strictly after B already rendered.
    adapter.releaseFocusRecord("component.a", { status: "found", record: focusRecord("component.a", "ComponentAAA") });
    await renderA;

    // B's content must still be what's shown — A's late arrival must not
    // have overwritten it.
    expect(root.textContent).toContain("ComponentBBB");
    expect(root.textContent).not.toContain("ComponentAAA");
  });

  it("a slower loadProjection() response from an earlier render() is discarded once a newer render() has resolved — even for two renders of the same route name, proving the guard is a generation counter, not a route-name comparison", async () => {
    let releaseFirst!: (o: ProjectionOutcome) => void;
    const firstPromise = new Promise<ProjectionOutcome>((r) => {
      releaseFirst = r;
    });
    let callCount = 0;
    const adapter: ProjectionAdapter = {
      async loadProjection() {
        callCount++;
        if (callCount === 1) return firstPromise; // held open
        return { status: "available", projection: minimalProjection() }; // resolves immediately
      },
      async loadFocusRecord() {
        return { status: "unavailable", reason: "n/a" };
      },
      capabilities() {
        return { liveRefresh: false, revisionCompare: false, mode: "static" };
      },
    };

    const root = mount();
    const shell = new Shell(root, adapter, new Router());

    // Same route name both times ("overview") — if the old code's
    // route-name-only check were still in place this pair would already be
    // indistinguishable from a real duplicate, which is exactly why it's
    // not a safe way to detect staleness.
    const first = shell.render({ name: "overview", query: new URLSearchParams() });
    const second = shell.render({ name: "overview", query: new URLSearchParams() });
    await second;
    const mainAfterSecond = root.querySelector("h1")?.textContent;

    releaseFirst({ status: "unavailable", projection: minimalProjection({ availability: { state: "unavailable", summary: "stale", limitations: [], sources: [] } }) });
    await first;

    // The first (now-stale) render's late "unavailable" response must not
    // have overwritten what the second render already painted.
    expect(root.querySelector("h1")?.textContent).toBe(mainAfterSecond);
    expect(root.querySelector(".state-block--unavailable")).toBeNull();
  });
});
