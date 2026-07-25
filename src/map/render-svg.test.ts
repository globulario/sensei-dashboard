import { describe, it, expect } from "vitest";
import type { Boundary, Component, Contract, Region, SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { buildArchitectureMapModel } from "./model.js";
import { renderArchitectureMap } from "./render-svg.js";

const prov = { evidence_refs: [] };

function minimalProjection(overrides: Partial<SenseiDashboardProjectionV1> = {}): SenseiDashboardProjectionV1 {
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
        state: "attention",
        label: "o",
        summary: "s",
        severity: "medium",
        coverage: { observed: 0, total: null, unit: "u" },
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
    evolution: { availability: "available", base_revision: null, head_revision: "rev-1", changes: [] },
    focus_records: [],
    ...overrides,
  };
}

function region(id: string, overrides: Partial<Region> = {}): Region {
  return { id, name: id, responsibility: "r", state: "open", component_refs: [], visual_anchor: { order: 0 }, provenance: prov, ...overrides };
}
function component(id: string, regionRef: string, overrides: Partial<Component> = {}): Component {
  return { id, name: id, region_ref: regionRef, responsibility: "r", state: "open", authority_refs: [], visual_anchor: { order: 0 }, provenance: prov, ...overrides };
}
function contract(id: string, sourceRef: string, targetRef: string, overrides: Partial<Contract> = {}): Contract {
  return { id, name: id, source_ref: sourceRef, target_ref: targetRef, kind: "grpc", direction: "source_to_target", state: "open", summary: "s", provenance: prov, ...overrides };
}
function boundary(id: string, memberRefs: string[], overrides: Partial<Boundary> = {}): Boundary {
  return { id, name: id, kind: "authority", member_refs: memberRefs, state: "open", summary: "s", provenance: prov, ...overrides };
}

function richProjection(): SenseiDashboardProjectionV1 {
  const regions = [
    region("region.a", { visual_anchor: { order: 0, lane: "lane-1" }, component_refs: ["component.a"] }),
    region("region.b", { visual_anchor: { order: 1, lane: "lane-1" }, component_refs: ["component.b"] }),
  ];
  const components = [
    component("component.a", "region.a", { authority_refs: ["boundary.x"] }),
    component("component.b", "region.b", { visual_anchor: { order: 0 } }),
  ];
  const contracts = [contract("contract.ab", "component.a", "component.b")];
  const boundaries = [boundary("boundary.x", ["component.a"])];
  return minimalProjection({ regions, components, contracts, boundaries });
}

function mount(): HTMLElement {
  document.body.replaceChildren();
  const root = document.createElement("div");
  document.body.appendChild(root);
  return root;
}

function render(root: HTMLElement, projection: SenseiDashboardProjectionV1, query: URLSearchParams): void {
  const model = buildArchitectureMapModel(projection);
  renderArchitectureMap(root, projection, model, { query, navigate: () => {} });
}

describe("renderArchitectureMap — lens behavior", () => {
  it("defaults to Structure when no lens query param is present", () => {
    const root = mount();
    render(root, richProjection(), new URLSearchParams());
    expect(root.querySelector("svg.arch-map-svg")?.getAttribute("class")).toContain("map-lens-structure");
    expect(root.querySelector('[aria-current="true"]')?.textContent).toBe("Structure");
  });

  it("Structure and Authority render byte-identical geometry — only the lens class differs", () => {
    const projection = richProjection();

    const structureRoot = mount();
    render(structureRoot, projection, new URLSearchParams("lens=structure"));
    const structureSvg = structureRoot.querySelector("svg.arch-map-svg")!;

    const authorityRoot = mount();
    render(authorityRoot, projection, new URLSearchParams("lens=authority"));
    const authoritySvg = authorityRoot.querySelector("svg.arch-map-svg")!;

    expect(structureSvg.getAttribute("viewBox")).toBe(authoritySvg.getAttribute("viewBox"));

    const geometryAttrs = ["x", "y", "width", "height", "d", "cx", "cy"];
    const collect = (svg: Element) =>
      [...svg.querySelectorAll("rect, path, circle, line")].map((el) =>
        geometryAttrs.map((attr) => el.getAttribute(attr)).join("|")
      );
    expect(collect(structureSvg)).toEqual(collect(authoritySvg));

    // The two renders are still distinguishable (different lens class).
    expect(structureSvg.getAttribute("class")).not.toBe(authoritySvg.getAttribute("class"));
  });

  it("an unrecognized lens token does not crash and falls back to Structure with an honest note", () => {
    const root = mount();
    expect(() => render(root, richProjection(), new URLSearchParams("lens=not-a-real-lens"))).not.toThrow();
    expect(root.querySelector(".state-block--unknown-lens")?.textContent).toContain("not-a-real-lens");
    expect(root.querySelector("svg.arch-map-svg")?.getAttribute("class")).toContain("map-lens-structure");
  });

  it("a recognized but unimplemented canonical lens shows the honest unsupported-lens state and does not draw Structure geometry while claiming to be that lens", () => {
    const root = mount();
    render(root, richProjection(), new URLSearchParams("lens=risk"));
    expect(root.querySelector(".state-block--unsupported-lens")?.textContent).toContain("risk");
    expect(root.querySelector("svg.arch-map-svg")).toBeNull();
    // The lens control itself still offers the implemented choices.
    expect(root.querySelectorAll(".map-lens-control__link")).toHaveLength(2);
  });
});

describe("renderArchitectureMap — deterministic, collision-safe ids", () => {
  it("repeated renders of the same model produce identical marker/title/desc ids", () => {
    const projection = richProjection();
    const rootA = mount();
    render(rootA, projection, new URLSearchParams());
    const rootB = mount();
    render(rootB, projection, new URLSearchParams());

    const titleA = rootA.querySelector("svg title")?.id;
    const titleB = rootB.querySelector("svg title")?.id;
    expect(titleA).toBe(titleB);
    expect(titleA).toBeTruthy();
  });

  it("two different projections get distinctly scoped ids", () => {
    const rootA = mount();
    render(rootA, richProjection(), new URLSearchParams());
    const rootB = mount();
    const other = minimalProjection({
      identity: {
        ...richProjection().identity,
        projection_id: "projection.other",
      },
      regions: [region("region.a")],
      components: [component("component.a", "region.a")],
    });
    render(rootB, other, new URLSearchParams());

    const titleA = rootA.querySelector("svg title")?.id;
    const titleB = rootB.querySelector("svg title")?.id;
    expect(titleA).not.toBe(titleB);
  });
});

describe("renderArchitectureMap — accessibility", () => {
  it("the SVG has a non-empty accessible title and description", () => {
    const root = mount();
    render(root, richProjection(), new URLSearchParams());
    const svg = root.querySelector("svg.arch-map-svg")!;
    const title = root.querySelector(`#${svg.getAttribute("aria-labelledby")}`);
    const desc = root.querySelector(`#${svg.getAttribute("aria-describedby")}`);
    expect(title?.textContent).toBeTruthy();
    expect(desc?.textContent).toBeTruthy();
  });

  it("every region/component link carries an accessible label with name, kind, state, and stable id, and a real Focus href", () => {
    const root = mount();
    render(root, richProjection(), new URLSearchParams());
    const componentLink = root.querySelector('a.map-node--component[data-stable-id="component.a"]');
    expect(componentLink?.getAttribute("aria-label")).toBe("component.a, component, state open, id component.a");
    expect(componentLink?.getAttribute("href")).toBe("/element/component.a");

    const regionLink = root.querySelector('a.map-node--region[data-stable-id="region.a"]');
    expect(regionLink?.getAttribute("aria-label")).toBe("region.a, region, state open, id region.a");
  });

  it("the lens control is a labeled, keyboard-operable group of real links", () => {
    const root = mount();
    render(root, richProjection(), new URLSearchParams());
    const group = root.querySelector('[role="group"]');
    expect(group?.getAttribute("aria-labelledby")).toBe("map-lens-label");
    const links = root.querySelectorAll(".map-lens-control__link");
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.tagName).toBe("A");
  });

  it("contracts, flows, and boundaries are reachable through an equivalent semantic relationship list", () => {
    const root = mount();
    render(root, richProjection(), new URLSearchParams());
    const relationships = root.querySelector('[aria-label="Architectural relationships"]');
    expect(relationships?.textContent).toContain("contract.ab");
    expect(relationships?.textContent).toContain("boundary.x");
    const contractLink = relationships?.querySelector('a[href="/element/contract.ab"]');
    expect(contractLink).not.toBeNull();
  });
});

describe("renderArchitectureMap — diagnostics and text safety", () => {
  it("renders a diagnostics section listing an unresolved reference, never a fabricated edge", () => {
    const projection = richProjection();
    projection.contracts.push(contract("contract.broken", "component.a", "component.ghost"));
    const root = mount();
    render(root, projection, new URLSearchParams());
    const diagnostics = root.querySelector('[aria-label="Map diagnostics"]');
    expect(diagnostics?.textContent).toContain("component.ghost");
    expect(root.querySelector('path[data-stable-id="contract.broken"]')).toBeNull();
  });

  it("omits the diagnostics section entirely when there are none", () => {
    const root = mount();
    render(root, richProjection(), new URLSearchParams());
    expect(root.querySelector('[aria-label="Map diagnostics"]')).toBeNull();
  });

  it("never turns an untrusted name into markup — a name containing HTML-looking text renders as literal text", () => {
    const projection = richProjection();
    const region0 = projection.regions[0]!;
    region0.name = '<img src=x onerror="alert(1)">';
    const root = mount();
    render(root, projection, new URLSearchParams());
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector(".map-label--region")?.textContent).toBe('<img src=x onerror="alert(1)">');
  });
});

describe("renderArchitectureMap — honest no-relationships states", () => {
  it("shows a neutral absence note per collection when contracts/flows/boundaries are empty, not a false 'no dependencies' claim", () => {
    const root = mount();
    render(root, minimalProjection({ regions: [region("region.a")], components: [component("component.a", "region.a")] }), new URLSearchParams());
    const relationships = root.querySelector('[aria-label="Architectural relationships"]');
    expect(relationships?.textContent).toContain("No contracts were supplied in this projection.");
    expect(relationships?.textContent).toContain("No flows were supplied in this projection.");
    expect(relationships?.textContent).toContain("No boundaries were supplied in this projection.");
  });
});
