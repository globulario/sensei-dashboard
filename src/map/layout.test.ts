import { describe, it, expect } from "vitest";
import type { Component, Region } from "../../contract/generated/dashboard-projection-v1.js";
import {
  normalizeAnchorToken,
  compareRegions,
  compareComponentsInRegion,
  selfLoopGutterWidth,
  selfLoopDepth,
  placeMap,
  LAYOUT_CONSTANTS,
} from "./layout.js";
import type { ResolvableKind } from "./model.js";

const prov = { evidence_refs: [] };

function region(id: string, overrides: Partial<Region> = {}): Region {
  return {
    id,
    name: id,
    responsibility: "r",
    state: "open",
    component_refs: [],
    visual_anchor: { order: 0 },
    provenance: prov,
    ...overrides,
  };
}

function component(id: string, regionRef: string, overrides: Partial<Component> = {}): Component {
  return {
    id,
    name: id,
    region_ref: regionRef,
    responsibility: "r",
    state: "open",
    authority_refs: [],
    visual_anchor: { order: 0 },
    provenance: prov,
    ...overrides,
  };
}

function idKindFor(regions: Region[], components: Component[]): Map<string, ResolvableKind> {
  const map = new Map<string, ResolvableKind>();
  for (const r of regions) map.set(r.id, "region");
  for (const c of components) map.set(c.id, "component");
  return map;
}

describe("ResolvableKind coverage (ARCHITECT REVIEW, third pass)", () => {
  // The shared idKind lookup must index every real projection object kind
  // a reference field could name — not just the three kinds that happen to
  // have placeable geometry — so that a reference naming a real Contract
  // or Flow id is correctly diagnosed as unrendered_reference_kind rather
  // than misreported as unresolved_reference (as if the id didn't exist at
  // all). component.authority_refs is the one field this module resolves
  // directly; contract/flow endpoint resolution is covered in
  // routing.test.ts.
  it("an authority_refs entry naming a real Contract (not a Boundary) is unrendered_reference_kind, not unresolved_reference", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a", { authority_refs: ["contract.x"] })];
    const idKind = idKindFor(regions, components);
    idKind.set("contract.x", "contract");

    const result = placeMap(regions, components, idKind, new Map());
    const d = result.diagnostics.find((x) => "field" in x && x.field === "authority_refs");
    expect(d?.kind).toBe("unrendered_reference_kind");
    expect(d?.kind).not.toBe("unresolved_reference");
  });

  it("an authority_refs entry naming a real Flow (not a Boundary) is unrendered_reference_kind, not unresolved_reference", () => {
    const regions = [region("region.a")];
    const components = [component("component.a", "region.a", { authority_refs: ["flow.x"] })];
    const idKind = idKindFor(regions, components);
    idKind.set("flow.x", "flow");

    const result = placeMap(regions, components, idKind, new Map());
    const d = result.diagnostics.find((x) => "field" in x && x.field === "authority_refs");
    expect(d?.kind).toBe("unrendered_reference_kind");
  });
});

describe("normalizeAnchorToken", () => {
  it("trims and lowercases", () => {
    expect(normalizeAnchorToken("  Backend  ")).toBe("backend");
  });
  it("treats null/undefined/blank as the same default token", () => {
    expect(normalizeAnchorToken(null)).toBe("");
    expect(normalizeAnchorToken(undefined)).toBe("");
    expect(normalizeAnchorToken("   ")).toBe("");
  });
});

describe("compareRegions", () => {
  it("sorts by lane token, then order, then group token, then id — never by name", () => {
    const a = region("region.b", { name: "Zeta", visual_anchor: { order: 1, lane: "l1" } });
    const b = region("region.a", { name: "Alpha", visual_anchor: { order: 0, lane: "l1" } });
    const regions = [a, b].sort(compareRegions);
    expect(regions.map((r) => r.id)).toEqual(["region.a", "region.b"]); // order beats name
  });

  it("unlabeled lane sorts before a labeled lane (empty string < non-empty)", () => {
    const labeled = region("region.labeled", { visual_anchor: { order: 0, lane: "backend" } });
    const unlabeled = region("region.unlabeled", { visual_anchor: { order: 0 } });
    const regions = [labeled, unlabeled].sort(compareRegions);
    expect(regions.map((r) => r.id)).toEqual(["region.unlabeled", "region.labeled"]);
  });

  it("falls back to stable id ascending as the final tie-break", () => {
    const a = region("region.b");
    const b = region("region.a");
    const regions = [a, b].sort(compareRegions);
    expect(regions.map((r) => r.id)).toEqual(["region.a", "region.b"]);
  });
});

describe("compareComponentsInRegion", () => {
  it("uses the component's own visual_anchor, same 4-key precedence as regions", () => {
    const a = component("component.b", "region.x", { visual_anchor: { order: 1 } });
    const b = component("component.a", "region.x", { visual_anchor: { order: 0 } });
    const sorted = [a, b].sort(compareComponentsInRegion);
    expect(sorted.map((c) => c.id)).toEqual(["component.a", "component.b"]);
  });
});

describe("selfLoopGutterWidth / selfLoopDepth", () => {
  it("reserves zero width for zero self-contracts", () => {
    expect(selfLoopGutterWidth(0)).toBe(0);
  });
  it("grows with count but never exceeds the cap", () => {
    expect(selfLoopGutterWidth(1)).toBe(LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_BASE);
    expect(selfLoopGutterWidth(2)).toBeGreaterThan(selfLoopGutterWidth(1));
    expect(selfLoopGutterWidth(1000)).toBe(LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_MAX);
  });
  it("regression: real-repo's 16-self-loop component reserves the capped width, not an unbounded one", () => {
    expect(selfLoopGutterWidth(16)).toBe(LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_MAX);
  });
  it("every loop depth stays within [BASE, reserved width] even for a high count", () => {
    const count = 16;
    const reserved = selfLoopGutterWidth(count);
    for (let i = 0; i < count; i++) {
      const depth = selfLoopDepth(i, count);
      expect(depth).toBeGreaterThanOrEqual(LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_BASE);
      expect(depth).toBeLessThanOrEqual(reserved);
    }
  });
  it("is a pure function of (index, count) — same inputs, same output", () => {
    expect(selfLoopDepth(3, 16)).toBe(selfLoopDepth(3, 16));
  });
});

describe("placeMap — reference resolution and diagnostics", () => {
  it("excludes a component whose region_ref does not resolve to anything, with a diagnostic, never a fallback region", () => {
    const regions = [region("region.a")];
    const components = [component("component.orphan", "region.does-not-exist")];
    const idKind = idKindFor(regions, components);
    const result = placeMap(regions, components, idKind, new Map());

    expect(result.componentNodes).toHaveLength(0);
    expect(result.diagnostics.some((d) => d.kind === "unresolved_reference" && d.field === "region_ref")).toBe(true);
  });

  it("diagnoses a region_ref naming the wrong kind, distinctly from a fully unresolved id", () => {
    const regions = [region("region.a")];
    const components = [component("component.x", "component.a")]; // names a component id, not a region id
    const idKind = idKindFor(regions, [...components, component("component.a", "region.a")]);
    const result = placeMap(regions, components, idKind, new Map());
    expect(result.diagnostics.some((d) => d.kind === "wrong_kind_reference" && d.field === "region_ref")).toBe(true);
  });

  it("region.component_refs vs component.region_ref mismatch is a diagnostic only — placement always follows region_ref, never a silently-chosen union", () => {
    const regions = [region("region.a", { component_refs: ["component.ghost"] })];
    const components = [component("component.real", "region.a")]; // region_ref says region.a, but region.a's component_refs doesn't list it
    const idKind = idKindFor(regions, components);
    const result = placeMap(regions, components, idKind, new Map());

    // component.real is placed (region_ref is authoritative for placement)
    expect(result.componentNodes.map((c) => c.id)).toEqual(["component.real"]);
    // both directions of the mismatch are visible as diagnostics
    expect(result.diagnostics.some((d) => d.kind === "membership_mismatch")).toBe(true);
    expect(result.diagnostics.some((d) => d.kind === "unresolved_reference" && d.field === "component_refs")).toBe(true);
  });
});

describe("placeMap — geometry invariants", () => {
  function buildScenario() {
    const regions = [
      region("region.a", { visual_anchor: { order: 0, lane: "lane-1" } }),
      region("region.b", { visual_anchor: { order: 1, lane: "lane-1" } }),
    ];
    const components = [
      component("component.a1", "region.a"),
      component("component.a2", "region.a", { visual_anchor: { order: 1 } }),
      component("component.b1", "region.b"),
    ];
    const idKind = idKindFor(regions, components);
    return { regions, components, idKind };
  }

  it("every component rectangle stays inside its region container", () => {
    const { regions, components, idKind } = buildScenario();
    const result = placeMap(regions, components, idKind, new Map());
    const regionById = new Map(result.regionNodes.map((r) => [r.id, r]));
    for (const c of result.componentNodes) {
      const r = regionById.get(c.regionId);
      expect(r).toBeDefined();
      if (!r) continue;
      expect(c.rect.x).toBeGreaterThanOrEqual(r.rect.x);
      expect(c.rect.y).toBeGreaterThanOrEqual(r.rect.y);
      expect(c.rect.x + c.rect.width).toBeLessThanOrEqual(r.rect.x + r.rect.width);
      expect(c.rect.y + c.rect.height).toBeLessThanOrEqual(r.rect.y + r.rect.height);
    }
  });

  it("no two component rectangles overlap", () => {
    const { regions, components, idKind } = buildScenario();
    const result = placeMap(regions, components, idKind, new Map());
    const rects = result.componentNodes.map((c) => c.rect);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlaps = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("adding a component to one region does not reorder unrelated regions/lanes", () => {
    // region.b lives in a different lane than region.a, so it is truly
    // "unrelated" to a component added inside region.a — region.a growing
    // taller must not move region.b's rect or either lane's relative order.
    // (Two regions sharing one lane legitimately shift relative to each
    // other when an earlier one grows — that's stacking, not reordering;
    // covered by the lane-order assertion below, not a frozen-rect one.)
    const regions = [
      region("region.a", { visual_anchor: { order: 0, lane: "lane-1" } }),
      region("region.b", { visual_anchor: { order: 0, lane: "lane-2" } }),
    ];
    const components = [component("component.a1", "region.a")];
    const idKind = idKindFor(regions, components);
    const before = placeMap(regions, components, idKind, new Map());
    const beforeOrder = before.lanes.map((l) => l.id);

    const withExtra = [...components, component("component.a2", "region.a", { visual_anchor: { order: 1 } })];
    const idKind2 = idKindFor(regions, withExtra);
    const after = placeMap(regions, withExtra, idKind2, new Map());
    const afterOrder = after.lanes.map((l) => l.id);

    expect(afterOrder).toEqual(beforeOrder);
    // region.b (a different lane, unrelated to the added component) keeps the same rect.
    const bBefore = before.regionNodes.find((r) => r.id === "region.b");
    const bAfter = after.regionNodes.find((r) => r.id === "region.b");
    expect(bAfter?.rect).toEqual(bBefore?.rect);
  });

  it("shuffled input arrays produce identical geometry and ordering", () => {
    const { regions, components, idKind } = buildScenario();
    const shuffled = [components[2]!, components[0]!, components[1]!];
    const shuffledRegions = [regions[1]!, regions[0]!];
    const result1 = placeMap(regions, components, idKind, new Map());
    const result2 = placeMap(shuffledRegions, shuffled, idKind, new Map());
    expect(result2.regionNodes.map((r) => ({ id: r.id, rect: r.rect }))).toEqual(
      result1.regionNodes.map((r) => ({ id: r.id, rect: r.rect }))
    );
    expect(result2.componentNodes.map((c) => ({ id: c.id, rect: c.rect }))).toEqual(
      result1.componentNodes.map((c) => ({ id: c.id, rect: c.rect }))
    );
  });

  it("empty regions/components produce an honest empty placement, not a crash", () => {
    const result = placeMap([], [], new Map(), new Map());
    expect(result.lanes).toEqual([]);
    expect(result.regionNodes).toEqual([]);
    expect(result.componentNodes).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });
});
