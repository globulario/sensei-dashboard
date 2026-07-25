// Deterministic placement (claude-stage-4-map-brief.md §2). Every ordering
// decision here uses plain string/number comparison — never
// `String.prototype.localeCompare` or `Intl.Collator`, both of which are
// locale/ICU-data-dependent and can differ across Node versions, browsers,
// and CI images. Plain `<`/`>` on `string` compares UTF-16 code units and is
// fully portable, which is what "identical input creates identical output"
// (brief §11) actually requires in practice, not merely in intent.
//
// Sizes are fixed design constants (LAYOUT_CONSTANTS below), never derived
// from DOM text measurement (brief Law B) — component/region rectangles are
// the same size regardless of how long their name or responsibility text is.

import type { Region, Component } from "../../contract/generated/dashboard-projection-v1.js";
import type { ResolvableKind, Rect, MapLane, MapRegionNode, MapComponentNode } from "./model.js";
import type { MapDiagnostic } from "./diagnostics.js";
import { unresolvedReference, wrongKindReference, unrenderedReferenceKind, membershipMismatch } from "./diagnostics.js";

export const LAYOUT_CONSTANTS = {
  COMPONENT_WIDTH: 220,
  COMPONENT_HEIGHT: 64,
  COMPONENT_GAP_Y: 12,
  REGION_PADDING: 16,
  REGION_HEADER_HEIGHT: 32,
  REGION_GAP_Y: 32,
  LANE_HEADER_HEIGHT: 28,
  LANE_GAP_X: 64,
  SELF_LOOP_GUTTER_BASE: 24,
  SELF_LOOP_GUTTER_UNIT: 18,
  SELF_LOOP_GUTTER_MAX: 160,
  CONTRACT_GUTTER_ROW_HEIGHT: 40,
  PARALLEL_OFFSET_UNIT: 8,
  PARALLEL_OFFSET_MAX: 48,
  FLOW_GUTTER_ROW_HEIGHT: 40,
  BOUNDARY_RAIL_ROW_HEIGHT: 36,
} as const;

/** Documented neutral default for a missing/null/blank `visual_anchor.lane`
 * or `.group` token (brief §2.1: "missing/null in one documented default
 * lane"). The empty string sorts before every non-empty token under plain
 * string comparison, so unlabeled regions/components deterministically
 * group first — this is a stated ordering choice, not an accident of the
 * empty string's ASCII value. */
export const DEFAULT_ANCHOR_TOKEN = "";

export function normalizeAnchorToken(token: string | null | undefined): string {
  return (token ?? "").trim().toLowerCase();
}

function compareTuple(a: readonly (string | number)[], b: readonly (string | number)[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i];
    const bv = b[i];
    if (av === undefined || bv === undefined) return av === undefined ? -1 : 1;
    if (typeof av === "number" && typeof bv === "number") {
      if (av !== bv) return av < bv ? -1 : 1;
      continue;
    }
    const as = String(av);
    const bs = String(bv);
    if (as !== bs) return as < bs ? -1 : 1;
  }
  return 0;
}

function regionSortKey(r: Region): (string | number)[] {
  return [normalizeAnchorToken(r.visual_anchor.lane), r.visual_anchor.order, normalizeAnchorToken(r.visual_anchor.group), r.id];
}

function componentSortKey(c: Component): (string | number)[] {
  return [normalizeAnchorToken(c.visual_anchor.lane), c.visual_anchor.order, normalizeAnchorToken(c.visual_anchor.group), c.id];
}

export function compareRegions(a: Region, b: Region): number {
  return compareTuple(regionSortKey(a), regionSortKey(b));
}

/** Components are sorted by their *own* visual_anchor (lane/order/group are
 * owner hints scoped to ordering — brief §2.1's "Components inside a
 * region" key list — not a claim that a component's lane differs
 * spatially from its region's lane; this module stacks components in a
 * single column per region, so this key only decides vertical order within
 * that column, never a separate spatial lane for components). */
export function compareComponentsInRegion(a: Component, b: Component): number {
  return compareTuple(componentSortKey(a), componentSortKey(b));
}

/** Reserved horizontal capacity for a component's self-loop brackets,
 * shared by layout.ts (region width) and routing.ts (actual loop depth) so
 * the two can never drift apart. Capped so a component with many
 * self-contracts (real-repo's default fixture has one with 16) still gets
 * a bounded reservation instead of unbounded region growth. */
export function selfLoopGutterWidth(selfContractCount: number): number {
  if (selfContractCount <= 0) return 0;
  const raw = LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_BASE + (selfContractCount - 1) * LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_UNIT;
  return Math.min(raw, LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_MAX);
}

/** Deterministic horizontal depth for the `index`-th (0-based, sorted by
 * contract id — see routing.ts) self-loop among `count` total self-loops on
 * one component. Always within [SELF_LOOP_GUTTER_BASE, reserved width], so
 * routing.ts's bracket shape can never exceed the capacity layout.ts
 * reserved for it. */
export function selfLoopDepth(index: number, count: number): number {
  const reserved = selfLoopGutterWidth(count);
  if (count <= 1) return LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_BASE;
  const span = reserved - LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_BASE;
  const unit = Math.min(LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_UNIT, span / (count - 1));
  return LAYOUT_CONSTANTS.SELF_LOOP_GUTTER_BASE + index * unit;
}

interface PlacementResult {
  lanes: MapLane[];
  regionNodes: MapRegionNode[];
  componentNodes: MapComponentNode[];
  diagnostics: MapDiagnostic[];
}

/** Resolves each component's `region_ref` against the three kinds Law D
 * permits an explicit reference to name, and cross-checks the region's own
 * `component_refs` against that resolution — a mismatch is a diagnostic,
 * never a silently-chosen union (brief §2.2). */
function resolveComponentRegions(
  regions: readonly Region[],
  components: readonly Component[],
  idKind: ReadonlyMap<string, ResolvableKind>
): { componentsByRegionId: Map<string, Component[]>; diagnostics: MapDiagnostic[] } {
  const diagnostics: MapDiagnostic[] = [];
  const componentsByRegionId = new Map<string, Component[]>();
  const componentRegionId = new Map<string, string>();

  for (const c of components) {
    const kind = idKind.get(c.region_ref);
    if (kind === undefined) {
      diagnostics.push(unresolvedReference("component", c.id, "region_ref", c.region_ref));
      continue;
    }
    if (kind !== "region") {
      diagnostics.push(wrongKindReference("component", c.id, "region_ref", c.region_ref, "region", kind));
      continue;
    }
    componentRegionId.set(c.id, c.region_ref);
    const list = componentsByRegionId.get(c.region_ref) ?? [];
    list.push(c);
    componentsByRegionId.set(c.region_ref, list);
  }

  for (const r of regions) {
    const resolvedMembers = new Set((componentsByRegionId.get(r.id) ?? []).map((c) => c.id));
    for (const claimedId of r.component_refs) {
      const kind = idKind.get(claimedId);
      if (kind === undefined) {
        diagnostics.push(unresolvedReference("region", r.id, "component_refs", claimedId));
        continue;
      }
      if (kind !== "component") {
        diagnostics.push(wrongKindReference("region", r.id, "component_refs", claimedId, "component", kind));
        continue;
      }
      if (!resolvedMembers.has(claimedId)) {
        diagnostics.push(membershipMismatch(r.id, claimedId, "region_claims_component_but_component_disagrees"));
      }
    }
    const claimedSet = new Set(r.component_refs);
    for (const memberId of resolvedMembers) {
      if (!claimedSet.has(memberId)) {
        diagnostics.push(membershipMismatch(r.id, memberId, "component_claims_region_but_region_disagrees"));
      }
    }
  }

  return { componentsByRegionId, diagnostics };
}

/** Resolves each component's `authority_refs`. The pinned schema declares
 * this field as generic `refs` (stableId array) with no kind restriction —
 * a component naming a real Region or another Component here is valid
 * data, just not something this build currently draws a connector for
 * (`unrendered_reference_kind`, not a data error). Only a genuinely
 * unresolved id — absent from the projection entirely — is
 * `unresolved_reference`. Boundary-kind entries are the only ones this
 * build renders authority connectors for (see routing.ts). */
function resolveComponentAuthorityRefs(
  components: readonly Component[],
  idKind: ReadonlyMap<string, ResolvableKind>
): { authorityRefsByComponentId: Map<string, string[]>; diagnostics: MapDiagnostic[] } {
  const diagnostics: MapDiagnostic[] = [];
  const authorityRefsByComponentId = new Map<string, string[]>();
  for (const c of components) {
    const resolved: string[] = [];
    for (const refId of c.authority_refs) {
      const kind = idKind.get(refId);
      if (kind === undefined) {
        diagnostics.push(unresolvedReference("component", c.id, "authority_refs", refId));
        continue;
      }
      if (kind !== "boundary") {
        diagnostics.push(unrenderedReferenceKind("component", c.id, "authority_refs", refId, ["boundary"], kind));
        continue;
      }
      resolved.push(refId);
    }
    authorityRefsByComponentId.set(c.id, resolved);
  }
  return { authorityRefsByComponentId, diagnostics };
}

export function placeMap(
  regions: readonly Region[],
  components: readonly Component[],
  idKind: ReadonlyMap<string, ResolvableKind>,
  selfContractCounts: ReadonlyMap<string, number>
): PlacementResult {
  const { componentsByRegionId, diagnostics } = resolveComponentRegions(regions, components, idKind);
  const { authorityRefsByComponentId, diagnostics: authorityDiagnostics } = resolveComponentAuthorityRefs(components, idKind);
  diagnostics.push(...authorityDiagnostics);

  const sortedRegions = [...regions].sort(compareRegions);

  const laneByToken = new Map<string, MapLane>();
  const laneOrder: string[] = [];
  for (const r of sortedRegions) {
    const token = normalizeAnchorToken(r.visual_anchor.lane);
    if (!laneByToken.has(token)) {
      laneByToken.set(token, {
        id: `lane.${token || "default"}`,
        token,
        label: r.visual_anchor.lane && r.visual_anchor.lane.trim() ? r.visual_anchor.lane : "Unassigned lane",
        order: laneOrder.length,
        rect: { x: 0, y: 0, width: 0, height: 0 },
      });
      laneOrder.push(token);
    }
  }

  const regionNodes: MapRegionNode[] = [];
  const componentNodes: MapComponentNode[] = [];
  const regionsByLaneToken = new Map<string, Region[]>();
  for (const r of sortedRegions) {
    const token = normalizeAnchorToken(r.visual_anchor.lane);
    const list = regionsByLaneToken.get(token) ?? [];
    list.push(r);
    regionsByLaneToken.set(token, list);
  }

  const C = LAYOUT_CONSTANTS;
  let laneX = 0;
  for (const token of laneOrder) {
    const lane = laneByToken.get(token);
    if (!lane) continue;
    const regionsInLane = regionsByLaneToken.get(token) ?? [];

    let regionNeededWidth = C.REGION_PADDING * 2 + C.COMPONENT_WIDTH;
    for (const r of regionsInLane) {
      const members = [...(componentsByRegionId.get(r.id) ?? [])].sort(compareComponentsInRegion);
      const maxSelfCount = members.reduce((max, c) => Math.max(max, selfContractCounts.get(c.id) ?? 0), 0);
      const width = C.REGION_PADDING * 2 + C.COMPONENT_WIDTH + selfLoopGutterWidth(maxSelfCount);
      regionNeededWidth = Math.max(regionNeededWidth, width);
    }

    let regionY = C.LANE_HEADER_HEIGHT;
    for (const r of regionsInLane) {
      const members = [...(componentsByRegionId.get(r.id) ?? [])].sort(compareComponentsInRegion);
      const regionHeight =
        C.REGION_HEADER_HEIGHT +
        C.REGION_PADDING * 2 +
        (members.length > 0 ? members.length * C.COMPONENT_HEIGHT + (members.length - 1) * C.COMPONENT_GAP_Y : 0);

      const regionRect: Rect = { x: laneX, y: regionY, width: regionNeededWidth, height: regionHeight };
      regionNodes.push({
        id: r.id,
        name: r.name,
        responsibility: r.responsibility,
        state: r.state,
        laneId: lane.id,
        rect: regionRect,
        source: r,
      });

      let componentY = regionY + C.REGION_HEADER_HEIGHT + C.REGION_PADDING;
      for (const c of members) {
        componentNodes.push({
          id: c.id,
          name: c.name,
          responsibility: c.responsibility,
          state: c.state,
          regionId: r.id,
          rect: { x: laneX + C.REGION_PADDING, y: componentY, width: C.COMPONENT_WIDTH, height: C.COMPONENT_HEIGHT },
          authorityRefs: authorityRefsByComponentId.get(c.id) ?? [],
          source: c,
        });
        componentY += C.COMPONENT_HEIGHT + C.COMPONENT_GAP_Y;
      }

      regionY += regionHeight + C.REGION_GAP_Y;
    }

    lane.rect = { x: laneX, y: 0, width: regionNeededWidth, height: Math.max(regionY - C.REGION_GAP_Y, C.LANE_HEADER_HEIGHT) };
    laneX += regionNeededWidth + C.LANE_GAP_X;
  }

  return { lanes: [...laneByToken.values()], regionNodes, componentNodes, diagnostics };
}
