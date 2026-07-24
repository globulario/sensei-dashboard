import { describe, it, expect } from "vitest";
import { renderOverview } from "./overview.js";
import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";

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
      architecture_health: { state: "healthy", label: "Healthy", summary: "coherent", severity: "not_applicable", provenance: prov },
      projection_integrity: { state: "healthy", label: "Trusted", summary: "digest matches", severity: "not_applicable", provenance: prov },
      observation_completeness: {
        state: "attention",
        label: "Partially observed",
        summary: "runtime evidence not fully sampled",
        severity: "medium",
        coverage: { observed: null, total: null, unit: "components" },
        provenance: prov,
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
    evolution: { availability: "available", base_revision: null, head_revision: "rev.1", changes: [] },
    focus_records: [],
    ...overrides,
  };
}

function mount(): HTMLElement {
  // Avoid accumulating duplicate ids across tests in the same jsdom
  // document — see shell.test.ts's mount() for the full rationale.
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

describe("renderOverview", () => {
  it("renders architecture health, projection integrity, observation completeness, and availability as independent, distinctly labeled states", () => {
    const projection = baseProjection({
      availability: { state: "partial", summary: "partial view", limitations: ["some source unavailable"], sources: [] },
    });
    const container = mount();
    renderOverview(container, projection);

    expect(container.textContent).toContain("Architecture health");
    expect(container.textContent).toContain("Projection integrity");
    expect(container.textContent).toContain("Observation completeness");
    expect(container.textContent).toContain("Projection availability");

    // Each assessment's own machine state token renders distinctly, not
    // collapsed into one shared score.
    expect(container.querySelectorAll(".status-token--healthy").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector(".status-token--partial")).not.toBeNull();
    expect(container.textContent).toContain("some source unavailable");
  });

  it("renders null observation coverage as 'unknown', never as zero", () => {
    const projection = baseProjection();
    const container = mount();
    renderOverview(container, projection);
    expect(container.textContent).toContain("Coverage: unknown / unknown components");
    expect(container.textContent).not.toContain("Coverage: 0 / 0");
  });

  it("renders real observation coverage numbers when supplied", () => {
    const projection = baseProjection();
    projection.assessments.observation_completeness.coverage = { observed: 7, total: 12, unit: "components" };
    const container = mount();
    renderOverview(container, projection);
    expect(container.textContent).toContain("Coverage: 7 / 12 components");
  });

  it("renders briefing statements verbatim, in producer order, without synthesizing a combined paragraph", () => {
    const projection = baseProjection({
      briefing: [
        { id: "b1", kind: "orientation", text: "First statement.", severity: "info", element_refs: [], provenance: { evidence_refs: [] } },
        { id: "b2", kind: "attention", text: "Second statement.", severity: "medium", element_refs: [], provenance: { evidence_refs: [] } },
      ],
    });
    const container = mount();
    renderOverview(container, projection);
    const texts = Array.from(container.querySelectorAll(".briefing-statement__text")).map((n) => n.textContent);
    expect(texts).toEqual(["First statement.", "Second statement."]);
  });

  it("renders projection.facts as the canonical compact-facts surface, preserving order and label/value/unit/state", () => {
    const projection = baseProjection({
      facts: [
        { id: "fact.1", label: "Regions", value: 6, unit: undefined, state: "proven", element_refs: [] },
        { id: "fact.2", label: "Open questions", value: null, state: "unknown", element_refs: [] },
      ],
    });
    const container = mount();
    renderOverview(container, projection);
    const labels = Array.from(container.querySelectorAll(".facts-list__label")).map((n) => n.textContent);
    expect(labels[0]).toContain("Regions");
    expect(labels[1]).toContain("Open questions");
    const values = Array.from(container.querySelectorAll(".facts-list__value")).map((n) => n.textContent);
    expect(values[0]).toContain("6");
    expect(values[1]).toContain("unknown");
  });

  it("omits the facts section entirely when projection.facts is absent or empty", () => {
    const container = mount();
    renderOverview(container, baseProjection());
    expect(container.querySelector(".facts-section")).toBeNull();
  });

  it("renders a neutral empty-attention state, never claiming the architecture has no risks", () => {
    const container = mount();
    renderOverview(container, baseProjection({ attention: [] }));
    expect(container.textContent).toContain("No current attention items were supplied by this projection.");
    expect(container.textContent.toLowerCase()).not.toContain("no risk");
  });

  it("preserves attention item producer order without local severity ranking", () => {
    const projection = baseProjection({
      attention: [
        {
          id: "attention.low",
          kind: "question",
          title: "Low severity item",
          summary: "s",
          severity: "low",
          state: "open",
          element_refs: [],
          provenance: { evidence_refs: [] },
        },
        {
          id: "attention.critical",
          kind: "contradiction",
          title: "Critical severity item",
          summary: "s",
          severity: "critical",
          state: "open",
          element_refs: [],
          provenance: { evidence_refs: [] },
        },
      ],
    });
    const container = mount();
    renderOverview(container, projection);
    const titles = Array.from(container.querySelectorAll(".attention-item__heading")).map((n) => n.textContent ?? "");
    expect(titles[0]).toContain("Low severity item");
    expect(titles[1]).toContain("Critical severity item");
  });

  it("links a selectable attention item to its Focus deep link, and leaves a non-selectable one as plain text", () => {
    const projection = baseProjection({
      attention: [
        {
          id: "attention.selectable",
          kind: "question",
          title: "Selectable item",
          summary: "s",
          severity: "low",
          state: "open",
          element_refs: [],
          selectable: true,
          provenance: { evidence_refs: [] },
        },
        {
          id: "attention.not-selectable",
          kind: "question",
          title: "Non-selectable item",
          summary: "s",
          severity: "low",
          state: "open",
          element_refs: [],
          selectable: false,
          provenance: { evidence_refs: [] },
        },
      ],
      focus_records: [
        {
          element_ref: "attention.selectable",
          element_kind: "attention",
          name: "Selectable item",
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
    const container = mount();
    renderOverview(container, projection);
    const links = Array.from(container.querySelectorAll(".attention-item__heading a")).map((a) => a.textContent);
    expect(links).toEqual(["Selectable item"]);
  });

  it("preserves evolution change producer order", () => {
    const projection = baseProjection({
      evolution: {
        availability: "available",
        base_revision: "rev.0",
        head_revision: "rev.1",
        changes: [
          { id: "change.1", kind: "component_added", title: "First change", summary: "s", impact: "changed", element_refs: [], provenance: { evidence_refs: [] } },
          { id: "change.2", kind: "contract_added", title: "Second change", summary: "s", impact: "improved", element_refs: [], provenance: { evidence_refs: [] } },
        ],
      },
    });
    const container = mount();
    renderOverview(container, projection);
    const titles = Array.from(container.querySelectorAll(".evolution-change__heading")).map((n) => n.textContent ?? "");
    expect(titles[0]).toContain("First change");
    expect(titles[1]).toContain("Second change");
  });

  it("identifies a null base_revision as a first authoritative projection, not 'no changes'", () => {
    const container = mount();
    renderOverview(container, baseProjection({ evolution: { availability: "available", base_revision: null, head_revision: "rev.1", changes: [] } }));
    expect(container.textContent).toContain("first authoritative projection");
    expect(container.textContent).not.toContain("No changes are recorded");
  });

  it("shows evolution limitations when evolution is partial", () => {
    const projection = baseProjection({
      evolution: {
        availability: "partial",
        base_revision: "rev.0",
        head_revision: "rev.1",
        limitations: ["some change history could not be observed"],
        changes: [],
      },
    });
    const container = mount();
    renderOverview(container, projection);
    expect(container.textContent).toContain("some change history could not be observed");
  });

  it("shows evolution limitations when evolution is unavailable", () => {
    const projection = baseProjection({
      evolution: {
        availability: "unavailable",
        base_revision: "rev.0",
        head_revision: "rev.1",
        limitations: ["evolution comparison could not be constructed"],
        changes: [],
      },
    });
    const container = mount();
    renderOverview(container, projection);
    expect(container.textContent).toContain("evolution comparison could not be constructed");
    expect(container.querySelector(".status-token--unavailable")).not.toBeNull();
  });

  // --- Empty evolution message must not imply a complete comparison
  // (ARCHITECT REVIEW finding #4 on PR #5) ---

  it("never renders 'No changes are recorded between these revisions' for partial evolution with no changes", () => {
    const container = mount();
    renderOverview(
      container,
      baseProjection({
        evolution: { availability: "partial", base_revision: "rev.0", head_revision: "rev.1", changes: [] },
      })
    );
    expect(container.textContent).not.toContain("No changes are recorded between these revisions.");
    expect(container.textContent).toContain("No change records were supplied");
  });

  it("never renders 'No changes are recorded between these revisions' for unavailable evolution with no changes", () => {
    const container = mount();
    renderOverview(
      container,
      baseProjection({
        evolution: { availability: "unavailable", base_revision: "rev.0", head_revision: "rev.1", changes: [] },
      })
    );
    expect(container.textContent).not.toContain("No changes are recorded between these revisions.");
    expect(container.textContent).toContain("No change records were supplied");
  });

  it("retains the bounded no-records message for available evolution with no changes", () => {
    const container = mount();
    renderOverview(
      container,
      baseProjection({
        evolution: { availability: "available", base_revision: "rev.0", head_revision: "rev.1", changes: [] },
      })
    );
    expect(container.textContent).toContain("No changes are recorded between these revisions.");
  });

  it("still renders the first-authoritative-projection state for a null base_revision, regardless of availability", () => {
    for (const availability of ["available", "partial", "unavailable"] as const) {
      const container = mount();
      renderOverview(
        container,
        baseProjection({
          evolution: { availability, base_revision: null, head_revision: "rev.1", changes: [] },
        })
      );
      expect(container.textContent).toContain("first authoritative projection");
      expect(container.textContent).not.toContain("No changes are recorded between these revisions.");
      expect(container.textContent).not.toContain("No change records were supplied");
    }
  });

  // --- Active-context links must use the same safe-link policy as source
  // links (ARCHITECT REVIEW finding #2 on PR #5) ---

  it("renders a safe https active-context url as a clickable link", () => {
    const container = mount();
    renderOverview(
      container,
      baseProjection({
        active_context: { kind: "task", id: "task.1", label: "Investigate boundary pressure", url: "https://example.test/task/1" },
      })
    );
    const link = container.querySelector(".active-context a") as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("https://example.test/task/1");
  });

  it("never renders an unsafe active-context url (javascript:) as a clickable link", () => {
    const container = mount();
    renderOverview(
      container,
      baseProjection({
        active_context: { kind: "task", id: "task.1", label: "Investigate boundary pressure", url: "javascript:alert(1)" },
      })
    );
    expect(container.querySelector(".active-context a")).toBeNull();
    expect(container.textContent).toContain("not rendered");
  });
});
