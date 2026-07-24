import { describe, it, expect, afterEach } from "vitest";
import { renderFocus } from "./focus.js";
import type { FocusRecord, SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import type { FocusOutcome } from "../adapter/types.js";

function baseProjection(overrides: Partial<SenseiDashboardProjectionV1> = {}): SenseiDashboardProjectionV1 {
  const prov = { evidence_refs: [] };
  return {
    schema_version: "sensei.dashboard.projection.v1",
    identity: {
      projection_id: "p",
      repository: { key: "repo.k", display_name: "Repo" },
      revision: { id: "rev.1" },
      graph_authority: { observed: "yes", current: "yes", identity: "g1", summary: "authoritative" },
      generated_at: "2026-07-24T00:00:00Z",
    },
    availability: { state: "available", summary: "ok", limitations: [], sources: [] },
    assessments: {
      architecture_health: { state: "healthy", label: "h", summary: "s", severity: "not_applicable", provenance: prov },
      projection_integrity: { state: "healthy", label: "i", summary: "s", severity: "not_applicable", provenance: prov },
      observation_completeness: {
        state: "attention", label: "o", summary: "s", severity: "medium",
        coverage: { observed: null, total: null, unit: "u" }, provenance: prov,
      },
    },
    active_context: null,
    briefing: [],
    regions: [],
    components: [
      { id: "component.b", name: "Component B", region_ref: "region.x", responsibility: "r", state: "open", authority_refs: [], visual_anchor: { order: 0 }, provenance: prov },
    ],
    boundaries: [],
    contracts: [],
    flows: [],
    attention: [],
    evolution: { availability: "available", base_revision: null, head_revision: "rev.1", changes: [] },
    focus_records: [],
    ...overrides,
  };
}

function focusRecord(overrides: Partial<FocusRecord> = {}): FocusRecord {
  return {
    element_ref: "component.a",
    element_kind: "component",
    name: "Component A",
    responsibility: "Does the thing.",
    state: "open",
    owner_refs: [],
    contract_refs: [],
    flow_refs: [],
    attention_refs: [],
    decision_refs: [],
    provenance: { evidence_refs: [] },
    ...overrides,
  };
}

function mount(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("renderFocus", () => {
  it("renders the found record's name, stable id, kind, state, and responsibility", () => {
    const container = mount();
    const record = focusRecord();
    renderFocus(container, { status: "found", record }, baseProjection());
    expect(container.querySelector("h1")?.textContent).toBe("Component A");
    expect(container.textContent).toContain("component.a");
    expect(container.textContent).toContain("component");
    expect(container.textContent).toContain("Does the thing.");
  });

  it("resolves an explicit reference to its label and a stable Focus deep link", () => {
    const projection = baseProjection({
      focus_records: [
        {
          element_ref: "component.b",
          element_kind: "component",
          name: "Component B",
          responsibility: "r",
          state: "open",
          owner_refs: [],
          contract_refs: [],
          flow_refs: [],
          attention_refs: [],
          decision_refs: [],
          provenance: { evidence_refs: [] },
        },
      ],
    });
    const record = focusRecord({ owner_refs: ["component.b"] });
    const container = mount();
    renderFocus(container, { status: "found", record }, projection);

    const link = container.querySelector(".ref-list a");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("Component B");
    expect(link!.getAttribute("href")).toBe("/element/component.b");
  });

  it("preserves the current query string in resolved reference links (fixture/lens/revision context)", () => {
    window.history.replaceState({}, "", "/element/component.a?fixture=contested");
    const projection = baseProjection({
      focus_records: [
        {
          element_ref: "component.b",
          element_kind: "component",
          name: "Component B",
          responsibility: "r",
          state: "open",
          owner_refs: [],
          contract_refs: [],
          flow_refs: [],
          attention_refs: [],
          decision_refs: [],
          provenance: { evidence_refs: [] },
        },
      ],
    });
    const record = focusRecord({ owner_refs: ["component.b"] });
    const container = mount();
    renderFocus(container, { status: "found", record }, projection);
    const link = container.querySelector(".ref-list a");
    expect(link!.getAttribute("href")).toBe("/element/component.b?fixture=contested");
  });

  it("produces a visible unresolved-reference diagnostic for an explicit ref with no matching projection object, never a fabricated label", () => {
    const record = focusRecord({ owner_refs: ["component.does-not-exist"] });
    const container = mount();
    renderFocus(container, { status: "found", record }, baseProjection());
    const unresolved = container.querySelector(".ref-list__item--unresolved");
    expect(unresolved).not.toBeNull();
    expect(unresolved!.textContent).toContain("component.does-not-exist");
    expect(unresolved!.textContent).toContain("Unresolved reference");
  });

  it("renders decision_refs as bare stable ids (no resolvable decisions collection in this contract version)", () => {
    const record = focusRecord({ decision_refs: ["decision.d1"] });
    const container = mount();
    renderFocus(container, { status: "found", record }, baseProjection());
    expect(container.textContent).toContain("decision.d1");
    expect(container.querySelector(".ref-list a")).toBeNull();
  });

  it("renders source links exactly as supplied, as safe external links", () => {
    const record = focusRecord({ source_links: [{ label: "View source", target: "https://example.test/file.go#L10" }] });
    const container = mount();
    renderFocus(container, { status: "found", record }, baseProjection());
    const link = container.querySelector(".focus-source-links a") as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("View source");
    expect(link!.getAttribute("href")).toBe("https://example.test/file.go#L10");
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toContain("noopener");
  });

  it("says exactly that the element is missing from the current revision, honestly, for a not_found outcome", () => {
    const container = mount();
    const outcome: FocusOutcome = { status: "not_found", elementId: "component.stale-link" };
    renderFocus(container, outcome, baseProjection());
    expect(container.textContent).toContain("component.stale-link");
    expect(container.querySelector(".state-block--unknown-element")).not.toBeNull();
  });

  it("renders an honest unavailable note when the current projection itself is unavailable", () => {
    const container = mount();
    const outcome: FocusOutcome = { status: "unavailable", reason: "no available projection (unavailable)" };
    renderFocus(container, outcome, baseProjection());
    expect(container.textContent).toContain("no available projection");
  });

  it("shows provenance limitations for the found record when present", () => {
    const record = focusRecord({ provenance: { evidence_refs: [], limitations: ["only partially observed"] } });
    const container = mount();
    renderFocus(container, { status: "found", record }, baseProjection());
    expect(container.textContent).toContain("only partially observed");
  });

  it("renders no Ask Agent panel when capabilities.agent_handoff is absent or 'none'", () => {
    const record = focusRecord();
    const container = mount();
    renderFocus(container, { status: "found", record }, baseProjection());
    expect(container.querySelector(".handoff-panel")).toBeNull();

    const container2 = mount();
    renderFocus(container2, { status: "found", record }, baseProjection({ capabilities: { agent_handoff: "none" } }));
    expect(container2.querySelector(".handoff-panel")).toBeNull();
  });

  it("renders an Ask Agent panel when capabilities.agent_handoff is 'export'", () => {
    const record = focusRecord();
    const container = mount();
    renderFocus(container, { status: "found", record }, baseProjection({ capabilities: { agent_handoff: "export" } }));
    expect(container.querySelector(".handoff-panel")).not.toBeNull();
  });
});
