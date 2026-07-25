import { describe, it, expect } from "vitest";
import type { Boundary, Component, Contract, Flow, Region } from "../../contract/generated/dashboard-projection-v1.js";
import { placeMap } from "./layout.js";
import { routeContracts, routeFlows, routeBoundaries } from "./routing.js";
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

  it("diagnoses a wrong-kind endpoint (naming a real region, not a component) distinctly from unresolved", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a")];
    const idKind = idKindFor(regions, components);
    const layout = placeMap(regions, components, idKind, new Map());
    const rectById = new Map(layout.componentNodes.map((c) => [c.id, c.rect]));

    const contracts = [contract("contract.x", "component.a", "region.a")];
    const result = routeContracts(contracts, rectById, new Map(), idKind, new Map(), { x: 0, y: 0, width: 0, height: 0 });

    expect(result.contracts[0]!.route).toBeNull();
    expect(result.diagnostics.some((d) => d.kind === "wrong_kind_reference" && d.field === "target_ref")).toBe(true);
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
    const { rectById } = twoComponentSetup();
    const f = flow("flow.x", [
      { order: 2, element_ref: "component.b" },
      { order: 1, element_ref: "component.a" },
    ]);
    const result = routeFlows([f], rectById, new Map(), new Map(), { x: 0, y: 0, width: 0, height: 0 });
    expect(result.flows[0]!.steps.map((s) => s.elementId)).toEqual(["component.a", "component.b"]);
  });

  it("connects only consecutive resolved steps — an unresolved middle step breaks only that segment", () => {
    const { rectById } = twoComponentSetup();
    const f = flow("flow.x", [
      { order: 1, element_ref: "component.a" },
      { order: 2, element_ref: "component.ghost" },
      { order: 3, element_ref: "component.b" },
    ]);
    const result = routeFlows([f], rectById, new Map(), new Map(), { x: 0, y: 0, width: 0, height: 0 });
    expect(result.flows[0]!.segments).toHaveLength(0);
    expect(result.diagnostics.some((d) => d.kind === "unresolved_reference")).toBe(true);
    const middleStep = result.flows[0]!.steps.find((s) => s.elementId === "component.ghost");
    expect(middleStep?.resolved).toBe(false);
    expect(middleStep?.point).toBeNull();
  });

  it("diagnoses duplicate step order without silently picking a sequence", () => {
    const { rectById } = twoComponentSetup();
    const f = flow("flow.x", [
      { order: 1, element_ref: "component.a" },
      { order: 1, element_ref: "component.b" },
    ]);
    const result = routeFlows([f], rectById, new Map(), new Map(), { x: 0, y: 0, width: 0, height: 0 });
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
    const result = routeBoundaries([b], rectById, idKind, { x: 0, y: 0, width: 400, height: 400 });

    expect(result.boundaries[0]!.connectors).toHaveLength(1);
    expect(result.boundaries[0]!.connectors[0]!.memberId).toBe("component.a");
    expect(result.diagnostics.some((d) => d.kind === "unresolved_reference")).toBe(true);
  });
});
