import { describe, it, expect } from "vitest";
import type { Boundary, Component, Contract, Flow, Region } from "../../contract/generated/dashboard-projection-v1.js";
import { placeMap } from "./layout.js";
import { routeContracts, routeFlows, routeBoundaries, routeAuthorityConnectors } from "./routing.js";
import type { ResolvableKind, Rect } from "./model.js";

const prov = { evidence_refs: [] };

function region(id: string, overrides: Partial<Region> = {}): Region {
  return { id, name: id, responsibility: "r", state: "open", component_refs: [], visual_anchor: { order: 0 }, provenance: prov, ...overrides };
}
function component(id: string, regionRef: string, overrides: Partial<Component> = {}): Component {
  return { id, name: id, region_ref: regionRef, responsibility: "r", state: "open", authority_refs: [], visual_anchor: { order: 0 }, provenance: prov, ...overrides };
}
function contract(id: string, sourceRef: string, targetRef: string, overrides: Partial<Contract> = {}): Contract {
  return { id, name: id, source_ref: sourceRef, target_ref: targetRef, kind: "grpc", direction: "source_to_target", state: "open", summary: "s", provenance: prov, ...overrides };
}
function flow(id: string, steps: Flow["steps"], overrides: Partial<Flow> = {}): Flow {
  return { id, name: id, kind: "command", state: "open", steps, summary: "s", provenance: prov, ...overrides };
}
function boundary(id: string, memberRefs: string[], overrides: Partial<Boundary> = {}): Boundary {
  return { id, name: id, kind: "other", member_refs: memberRefs, state: "open", summary: "s", provenance: prov, ...overrides };
}

function idKindFor(regions: Region[], components: Component[], boundaries: Boundary[] = []): Map<string, ResolvableKind> {
  const map = new Map<string, ResolvableKind>();
  for (const r of regions) map.set(r.id, "region");
  for (const c of components) map.set(c.id, "component");
  for (const b of boundaries) map.set(b.id, "boundary");
  return map;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function boundingBoxOf(points: { x: number; y: number }[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

describe("routeContracts — endpoint resolution", () => {
  it("omits the geometric edge and emits a diagnostic when an endpoint is entirely unresolved", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a")];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const contracts = [contract("contract.x", "component.a", "component.ghost")];
    const result = routeContracts(contracts, rectById, new Map(), idKind, new Map(), { x: 0, y: 0, width: 0, height: 0 });

    expect(result.contracts[0]!.route).toBeNull();
    expect(result.diagnostics.some((d) => d.kind === "unresolved_reference" && d.field === "target_ref")).toBe(true);
  });

  // ARCHITECT REVIEW on PR #6 (first pass): the pinned schema declares
  // contract.source_ref/target_ref as generic stableId with no kind
  // restriction — a contract naming a real Region or Boundary id is valid
  // producer data, not a schema/data error. This build just doesn't render
  // geometry for that combination yet, which is `unrendered_reference_kind`
  // (a rendering-scope limitation), never `wrong_kind_reference` (which
  // reads as "the data itself is wrong").
  it("diagnoses an endpoint naming a real Region as unrendered_reference_kind (valid data, not a data error), distinct from unresolved", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a")];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const contracts = [contract("contract.x", "component.a", "region.a")];
    const result = routeContracts(contracts, rectById, new Map(), idKind, new Map(), { x: 0, y: 0, width: 0, height: 0 });

    expect(result.contracts[0]!.route).toBeNull();
    const d = result.diagnostics.find((x) => "field" in x && x.field === "target_ref");
    expect(d?.kind).toBe("unrendered_reference_kind");
    expect(d?.kind).not.toBe("wrong_kind_reference");
  });

  it("diagnoses an endpoint naming a real Boundary the same way (unrendered_reference_kind, not wrong_kind_reference)", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a")];
    const boundaries = [boundary("boundary.b", [])];
    const idKind = idKindFor(regions, components, boundaries);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const contracts = [contract("contract.x", "component.a", "boundary.b")];
    const result = routeContracts(contracts, rectById, new Map(), idKind, new Map(), { x: 0, y: 0, width: 0, height: 0 });

    expect(result.contracts[0]!.route).toBeNull();
    const d = result.diagnostics.find((x) => "field" in x && x.field === "target_ref");
    expect(d?.kind).toBe("unrendered_reference_kind");
  });

  it("diagnoses a contract.boundary_refs entry naming a real Component as unrendered_reference_kind", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a"), component("component.b", "region.a", { visual_anchor: { order: 1 } })];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const contracts = [contract("contract.x", "component.a", "component.b", { boundary_refs: ["component.b"] })];
    const result = routeContracts(contracts, rectById, new Map(), idKind, new Map(), { x: 0, y: 0, width: 400, height: 400 });

    expect(result.contracts[0]!.boundaryRefs).toEqual([]);
    expect(result.diagnostics.some((d) => d.kind === "unrendered_reference_kind" && d.field === "boundary_refs")).toBe(true);
  });

  it("preserves direction verbatim for all four tokens", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a"), component("component.b", "region.a", { visual_anchor: { order: 1 } })];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const directions = ["source_to_target", "target_to_source", "bidirectional", "undirected"] as const;
    const contracts = directions.map((d, i) => contract(`contract.${i}`, "component.a", "component.b", { direction: d }));
    const result = routeContracts(contracts, rectById, new Map(), idKind, new Map(), { x: 0, y: 0, width: 400, height: 400 });

    expect(result.contracts.map((c) => c.direction)).toEqual(directions);
  });

  it("does not invent a relationship between two components with no explicit contract between them", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a"), component("component.b", "region.a", { visual_anchor: { order: 1 } })];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const result = routeContracts([], rectById, new Map(), idKind, new Map(), { x: 0, y: 0, width: 400, height: 400 });
    expect(result.contracts).toEqual([]);
  });
});

describe("routeContracts — self-loop containment (real-repo regression)", () => {
  it("a component with 16 self-contracts (real-repo's actual default-fixture shape) never draws a loop outside its own rect's vertical span, and never overlaps the sibling component stacked directly below it", () => {
    const regions = [region("region.ungrouped", { visual_anchor: { order: 0 } })];
    const components = [
      component("component.awareness_graph_service", "region.ungrouped", { visual_anchor: { order: 0 } }),
      component("component.corpus_loader", "region.ungrouped", { visual_anchor: { order: 1 } }),
    ];
    const idKind = idKindFor(regions, components);

    const selfContracts: Contract[] = Array.from({ length: 16 }, (_, i) =>
      contract(`contract.self.${i}`, "component.awareness_graph_service", "component.awareness_graph_service")
    );
    const selfContractCounts = new Map([["component.awareness_graph_service", 16]]);

    const layout = placeMap(regions, components, idKind, selfContractCounts);
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));
    const serviceRect = rectById.get("component.awareness_graph_service")!;
    const loaderRect = rectById.get("component.corpus_loader")!;

    const result = routeContracts(selfContracts, rectById, new Map(), idKind, selfContractCounts, { x: 0, y: 0, width: 0, height: 0 });

    expect(result.diagnostics).toEqual([]);
    for (const c of result.contracts) {
      expect(c.isSelfLoop).toBe(true);
      const route = c.route!;
      expect(route).not.toBeNull();
      // Every point stays within the owning component's own vertical span.
      for (const p of route.points) {
        expect(p.y).toBeGreaterThanOrEqual(serviceRect.y);
        expect(p.y).toBeLessThanOrEqual(serviceRect.y + serviceRect.height);
      }
      const loopBox = boundingBoxOf(route.points);
      expect(overlaps(loopBox, loaderRect)).toBe(false);
    }
  });

  it("distinct self-contracts on the same component get distinct, deterministic loop shapes", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a")];
    const idKind = idKindFor(regions, components);
    const contracts = [contract("contract.1", "component.a", "component.a"), contract("contract.2", "component.a", "component.a")];
    const counts = new Map([["component.a", 2]]);
    const layout = placeMap(regions, components, idKind, counts);
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const result = routeContracts(contracts, rectById, new Map(), idKind, counts, { x: 0, y: 0, width: 0, height: 0 });
    const [a, b] = result.contracts;
    expect(a!.route).not.toEqual(b!.route);

    // Re-running produces byte-identical routes (determinism).
    const again = routeContracts(contracts, rectById, new Map(), idKind, counts, { x: 0, y: 0, width: 0, height: 0 });
    expect(again.contracts).toEqual(result.contracts);
  });
});

describe("routeContracts — parallel offset grouping", () => {
  it("groups A→B and B→A (opposite direction tokens, same two nodes) as parallel, offsetting both apart", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a"), component("component.b", "region.a", { visual_anchor: { order: 1 } })];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));
    const laneGutterX = new Map([
      ["component.a", 1000],
      ["component.b", 1000],
    ]);

    const forward = contract("contract.forward", "component.a", "component.b", { direction: "source_to_target" });
    const backward = contract("contract.backward", "component.b", "component.a", { direction: "source_to_target" });
    const result = routeContracts([forward, backward], rectById, laneGutterX, idKind, new Map(), { x: 0, y: 0, width: 400, height: 400 });

    expect(result.contracts[0]!.route).not.toEqual(result.contracts[1]!.route);
  });
});

describe("routeFlows", () => {
  function twoComponentSetup() {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a"), component("component.b", "region.a", { visual_anchor: { order: 1 } })];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));
    return { rectById, idKind };
  }

  it("preserves step order from the explicit `order` field, not array position", () => {
    const { rectById, idKind } = twoComponentSetup();
    const f = flow("flow.x", [
      { order: 2, element_ref: "component.b" },
      { order: 1, element_ref: "component.a" },
    ]);
    const result = routeFlows([f], rectById, new Map(), new Map(), idKind, { x: 0, y: 0, width: 0, height: 0 });
    expect(result.flows[0]!.steps.map((s) => s.elementId)).toEqual(["component.a", "component.b"]);
  });

  it("connects only consecutive resolved steps — an unresolved middle step breaks only that segment", () => {
    const { rectById, idKind } = twoComponentSetup();
    const f = flow("flow.x", [
      { order: 1, element_ref: "component.a" },
      { order: 2, element_ref: "component.ghost" },
      { order: 3, element_ref: "component.b" },
    ]);
    const result = routeFlows([f], rectById, new Map(), new Map(), idKind, { x: 0, y: 0, width: 0, height: 0 });
    expect(result.flows[0]!.segments).toHaveLength(0);
    expect(result.diagnostics.some((d) => d.kind === "unresolved_reference")).toBe(true);
    const middleStep = result.flows[0]!.steps.find((s) => s.elementId === "component.ghost");
    expect(middleStep?.resolved).toBe(false);
    expect(middleStep?.point).toBeNull();
  });

  // ARCHITECT REVIEW (second pass) on PR #6: routeFlows previously
  // rebuilt its own component-only idKind map internally, so it could
  // never distinguish "this id doesn't exist" from "this id is a real
  // Region/Boundary" — every non-Component element_ref was misclassified
  // as unresolved_reference. Fixed by threading the full projection-wide
  // idKind map through instead of reconstructing a narrower one.
  it("a step naming a real Region (not a Component) is unrendered_reference_kind, not unresolved_reference", () => {
    const { rectById, idKind } = twoComponentSetup();
    const f = flow("flow.x", [{ order: 1, element_ref: "region.a" }]);
    const result = routeFlows([f], rectById, new Map(), new Map(), idKind, { x: 0, y: 0, width: 0, height: 0 });
    const d = result.diagnostics.find((x) => "field" in x && x.field === "steps[].element_ref");
    expect(d?.kind).toBe("unrendered_reference_kind");
    expect(d?.kind).not.toBe("unresolved_reference");
    const step = result.flows[0]!.steps.find((s) => s.elementId === "region.a");
    expect(step?.resolved).toBe(false);
    expect(step?.point).toBeNull();
  });

  it("a step naming a real Boundary (not a Component) is unrendered_reference_kind, not unresolved_reference", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a")];
    const boundaries = [boundary("boundary.b", [])];
    const idKind = idKindFor(regions, components, boundaries);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const f = flow("flow.x", [{ order: 1, element_ref: "boundary.b" }]);
    const result = routeFlows([f], rectById, new Map(), new Map(), idKind, { x: 0, y: 0, width: 0, height: 0 });
    const d = result.diagnostics.find((x) => "field" in x && x.field === "steps[].element_ref");
    expect(d?.kind).toBe("unrendered_reference_kind");
  });

  it("a step's contract_ref naming a real Component (not a Contract) is unrendered_reference_kind, not unresolved_reference", () => {
    const { rectById, idKind } = twoComponentSetup();
    const f = flow("flow.x", [{ order: 1, element_ref: "component.a", contract_ref: "component.b" }]);
    const result = routeFlows([f], rectById, new Map(), new Map(), idKind, { x: 0, y: 0, width: 0, height: 0 });
    const d = result.diagnostics.find((x) => "field" in x && x.field === "steps[].contract_ref");
    expect(d?.kind).toBe("unrendered_reference_kind");
    expect(d?.kind).not.toBe("unresolved_reference");
    expect(result.flows[0]!.steps[0]!.contractId).toBeNull();
  });

  it("a step's contract_ref naming an id that truly doesn't exist anywhere is still unresolved_reference", () => {
    const { rectById, idKind } = twoComponentSetup();
    const f = flow("flow.x", [{ order: 1, element_ref: "component.a", contract_ref: "contract.ghost" }]);
    const result = routeFlows([f], rectById, new Map(), new Map(), idKind, { x: 0, y: 0, width: 0, height: 0 });
    const d = result.diagnostics.find((x) => "field" in x && x.field === "steps[].contract_ref");
    expect(d?.kind).toBe("unresolved_reference");
  });

  it("a step's contract_ref naming a real Contract resolves normally", () => {
    const { rectById, idKind } = twoComponentSetup();
    const contractsById = new Map([["contract.real", {}]]);
    const f = flow("flow.x", [{ order: 1, element_ref: "component.a", contract_ref: "contract.real" }]);
    const result = routeFlows([f], rectById, new Map(), contractsById, idKind, { x: 0, y: 0, width: 0, height: 0 });
    expect(result.flows[0]!.steps[0]!.contractId).toBe("contract.real");
    expect(result.diagnostics).toEqual([]);
  });

  it("diagnoses duplicate step order without silently picking a sequence", () => {
    const { rectById, idKind } = twoComponentSetup();
    const f = flow("flow.x", [
      { order: 1, element_ref: "component.a" },
      { order: 1, element_ref: "component.b" },
    ]);
    const result = routeFlows([f], rectById, new Map(), new Map(), idKind, { x: 0, y: 0, width: 0, height: 0 });
    expect(result.diagnostics.some((d) => d.kind === "duplicate_flow_step_order")).toBe(true);
  });
});

describe("routeBoundaries", () => {
  it("connects only resolved members; an unresolved member_refs entry is a diagnostic, no connector", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a")];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const b = boundary("boundary.x", ["component.a", "component.ghost"]);
    const result = routeBoundaries([b], rectById, new Map(), idKind, { x: 0, y: 0, width: 400, height: 400 });

    expect(result.boundaries[0]!.connectors).toHaveLength(1);
    expect(result.boundaries[0]!.connectors[0]!.memberId).toBe("component.a");
    expect(result.diagnostics.some((d) => d.kind === "unresolved_reference")).toBe(true);
  });

  it("a member_refs entry naming a real Boundary (not a Component) is unrendered_reference_kind, not wrong_kind_reference", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a")];
    const boundaries = [boundary("boundary.other", [])];
    const idKind = idKindFor(regions, components, boundaries);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const b = boundary("boundary.x", ["boundary.other"]);
    const result = routeBoundaries([b, ...boundaries], rectById, new Map(), idKind, { x: 0, y: 0, width: 400, height: 400 });

    const d = result.diagnostics.find((x) => "field" in x && x.field === "member_refs");
    expect(d?.kind).toBe("unrendered_reference_kind");
  });

  // ARCHITECT REVIEW finding #2 on PR #6: a rail row spans the full content
  // width, so a naive straight-down line from a member component could
  // cross straight through a sibling component stacked below it in the
  // same region. This is the adversarial regression for that exact shape.
  it("a boundary connector for the top component in a stacked region never crosses the sibling component stacked directly below it", () => {
    const regions = [region("region.a")];
    const components = [
      component("component.top", "region.a", { visual_anchor: { order: 0 } }),
      component("component.bottom", "region.a", { visual_anchor: { order: 1 } }),
    ];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));
    const bottomRect = rectById.get("component.bottom")!;

    // The member's own lane gutter (to the right of both components,
    // outside either rect) is what routing must actually use.
    const laneGutterX = new Map([["component.top", 1000]]);

    const b = boundary("boundary.x", ["component.top"]);
    const result = routeBoundaries([b], rectById, laneGutterX, idKind, { x: 0, y: 0, width: 1200, height: 400 });

    const route = result.boundaries[0]!.connectors[0]!.route;
    const connectorBox = boundingBoxOf(route.points);
    expect(overlaps(connectorBox, bottomRect)).toBe(false);
  });
});

describe("routeAuthorityConnectors", () => {
  it("routes a gutter-drop connector from each component to each resolved authority_ref boundary's rail, never a straight line through a sibling below it", () => {
    const regions = [region("region.a")];
    const components = [component("component.top", "region.a", { visual_anchor: { order: 0 } }), component("component.bottom", "region.a", { visual_anchor: { order: 1 } })];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const bottomRect = layout.componentNodes.find((c) => c.id === "component.bottom")!.rect;
    const topNode = { ...layout.componentNodes.find((c) => c.id === "component.top")!, authorityRefs: ["boundary.x"] };

    const laneGutterX = new Map([["component.top", 1000]]);
    const railById = new Map([["boundary.x", { x: 0, y: 500, width: 1200, height: 36 }]]);

    const connectors = routeAuthorityConnectors([topNode], laneGutterX, railById);
    expect(connectors).toHaveLength(1);
    const box = boundingBoxOf(connectors[0]!.route.points);
    expect(overlaps(box, bottomRect)).toBe(false);
  });

  it("is deterministic and sorted by component id then boundary id", () => {
    const nodeB = { id: "component.b", regionId: "r", rect: { x: 0, y: 0, width: 10, height: 10 }, authorityRefs: ["boundary.y", "boundary.x"], name: "b", responsibility: "r", state: "open" as const, source: {} as never };
    const nodeA = { id: "component.a", regionId: "r", rect: { x: 0, y: 0, width: 10, height: 10 }, authorityRefs: ["boundary.x"], name: "a", responsibility: "r", state: "open" as const, source: {} as never };
    const railById = new Map([
      ["boundary.x", { x: 0, y: 100, width: 10, height: 10 }],
      ["boundary.y", { x: 0, y: 100, width: 10, height: 10 }],
    ]);
    const connectors = routeAuthorityConnectors([nodeB, nodeA], new Map(), railById);
    expect(connectors.map((c) => c.componentId)).toEqual(["component.a", "component.b", "component.b"]);
    expect(connectors.map((c) => c.boundaryId)).toEqual(["boundary.x", "boundary.x", "boundary.y"]);
  });
});
