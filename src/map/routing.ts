// Relationship routing (claude-stage-4-map-brief.md §3).
//
// Reference-kind matrix — what the *pinned schema*
// (docs/dashboard-projection-v1.schema.json) actually declares, versus what
// this build renders geometry for. ARCHITECT REVIEW on PR #6 (first pass)
// correctly flagged that an earlier version of this file narrowed allowed
// reference kinds from observed fixture behavior rather than from schema/
// contract authority. The schema declares every one of these fields as a
// generic `refs`/`stableId` array or scalar with **no kind restriction**:
//
//   field                          | schema type   | this build renders for
//   -------------------------------|----------------|------------------------
//   contract.source_ref/target_ref | stableId       | Component only
//   flow.steps[*].element_ref      | stableId       | Component only
//   contract.boundary_refs         | refs           | Boundary only
//   component.authority_refs       | refs           | Boundary only
//   boundary.member_refs           | refs           | Component only
//   component.region_ref           | stableId       | Region only (see note)
//
// A reference that names a real object of a *different* kind than the
// "renders for" column is **valid producer data**, not a schema violation —
// this build simply doesn't yet draw geometry for that combination. That is
// recorded as `unrendered_reference_kind` (a rendering-scope limitation),
// deliberately distinct from `wrong_kind_reference` (a data problem) and
// `unresolved_reference` (the id doesn't exist at all). See diagnostics.ts's
// header for the full three-way distinction.
//
// `component.region_ref` is the one exception kept as `wrong_kind_reference`
// rather than `unrendered_reference_kind`: unlike the other five fields,
// region_ref's counterpart-pairing with `region.component_refs` is
// contract-defined by architecture-dashboard-v1.md §6.2/brief §2.2 (the two
// fields are documented as the same relationship viewed from both ends), so
// a region_ref naming a Component or Boundary isn't "valid data we don't
// render" — it contradicts what the contract itself says the field means.
//
// ARCHITECT QUESTION (non-blocking — see PR comment): should a future stage
// render dedicated geometry for a contract/flow endpoint or boundary/
// authority reference that resolves to a kind outside the table above (e.g.
// a contract naming a Region), or does `unrendered_reference_kind` remain
// the intended Stage 4+ behavior for those combinations? This file takes the
// conservative, non-inventing default (diagnose, draw nothing) either way,
// so it is not blocked on an answer.
//
// The real-repo default fixture is 18 contracts, all self-contracts (16 on
// one component, 2 on another, two components stacked directly adjacent in
// the same region) — self-loops are the routing path an actual `npm run
// dev` with no `?fixture=` query exercises, not a corner case, which is why
// their bracket shape is constrained to never leave their own component
// rect's vertical span (see selfLoopDepth in layout.ts): it bulges only
// horizontally, into that component's own region's reserved self-loop
// gutter column, so it can never cross a sibling component's interior no
// matter how many self-contracts pile up on one component.
//
// Cross-node routing (contracts/flows, and — ARCHITECT REVIEW finding #2 —
// boundary membership and authority-ref connectors too) goes through each
// component's own lane's right-edge gutter column — a strip of horizontal
// space that is empty of node content by construction (it's the spacing
// between lane columns) — down (or across, for contracts/flows) to a shared
// row, then back. This is safe by construction, not by tuned pixel values:
// the only two kinds of segments are (a) a short horizontal hop from a
// component's own right edge into its own lane's gutter, which only ever
// crosses that component's own region's reserved margin, and (b) travel
// confined to gutter columns/rows that never contain node rects. A boundary
// rail row spans the *full* content width, so a naive straight vertical
// line from a member/authority-ref component straight down to the rail
// would cross straight through any sibling component stacked below it in
// the same region/lane — the gutter-drop gets this right where a direct
// line would not.

import type { Contract, Flow, Boundary } from "../../contract/generated/dashboard-projection-v1.js";
import type {
  ResolvableKind,
  Rect,
  RoutePath,
  RoutePoint,
  MapContractEdge,
  MapFlowPath,
  MapFlowStepPoint,
  MapFlowSegment,
  MapBoundary,
  MapComponentNode,
  MapAuthorityConnector,
} from "./model.js";
import type { MapDiagnostic } from "./diagnostics.js";
import { unresolvedReference, unrenderedReferenceKind, duplicateFlowStepOrder } from "./diagnostics.js";
import { LAYOUT_CONSTANTS, selfLoopDepth } from "./layout.js";

const C = LAYOUT_CONSTANTS;

function rightCenterPort(rect: Rect): RoutePoint {
  return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
}

function buildOrthogonalRoute(rectA: Rect, gutterXA: number, rectB: Rect, gutterXB: number, rowY: number): RoutePath {
  const a = rightCenterPort(rectA);
  const b = rightCenterPort(rectB);
  return {
    points: [
      a,
      { x: gutterXA, y: a.y },
      { x: gutterXA, y: rowY },
      { x: gutterXB, y: rowY },
      { x: gutterXB, y: b.y },
      b,
    ],
  };
}

/** Exit `rect` via its own right edge into `gutterX` (a lane's own gutter
 * column), then travel straight down within that gutter to `targetY`. Used
 * for boundary membership and authority-ref connectors — see module header
 * for why this replaces a naive straight-down line from the component. */
function buildGutterDropRoute(rect: Rect, gutterX: number, targetY: number): RoutePath {
  const port = rightCenterPort(rect);
  return { points: [port, { x: gutterX, y: port.y }, { x: gutterX, y: targetY }] };
}

/** Resolves an id this build renders geometry for only when it names a
 * Component. Returns the component's rect on success; pushes exactly one
 * diagnostic and returns undefined otherwise — `unresolved_reference` when
 * the id doesn't exist anywhere (including a Component id that exists but
 * was never placed because its own region_ref didn't resolve),
 * `unrendered_reference_kind` when it names a real, different-kind object
 * (see module header matrix). */
function resolveComponentEndpoint(
  sourceKind: string,
  sourceId: string,
  field: string,
  refId: string,
  idKind: ReadonlyMap<string, ResolvableKind>,
  componentRectById: ReadonlyMap<string, Rect>,
  diagnostics: MapDiagnostic[]
): Rect | undefined {
  const kind = idKind.get(refId);
  if (kind === undefined) {
    diagnostics.push(unresolvedReference(sourceKind, sourceId, field, refId));
    return undefined;
  }
  if (kind !== "component") {
    diagnostics.push(unrenderedReferenceKind(sourceKind, sourceId, field, refId, ["component"], kind));
    return undefined;
  }
  const rect = componentRectById.get(refId);
  if (!rect) {
    diagnostics.push(unresolvedReference(sourceKind, sourceId, field, refId));
    return undefined;
  }
  return rect;
}

function unorderedPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function routeContracts(
  contracts: readonly Contract[],
  componentRectById: ReadonlyMap<string, Rect>,
  componentLaneGutterX: ReadonlyMap<string, number>,
  idKind: ReadonlyMap<string, ResolvableKind>,
  selfContractCounts: ReadonlyMap<string, number>,
  contentBounds: Rect
): { contracts: MapContractEdge[]; diagnostics: MapDiagnostic[] } {
  const diagnostics: MapDiagnostic[] = [];

  const selfGroups = new Map<string, Contract[]>();
  const pairGroups = new Map<string, Contract[]>();
  const resolvedEndpoints = new Map<string, { source: Rect; target: Rect }>();

  for (const c of contracts) {
    const sourceRect = resolveComponentEndpoint("contract", c.id, "source_ref", c.source_ref, idKind, componentRectById, diagnostics);
    const targetRect = resolveComponentEndpoint("contract", c.id, "target_ref", c.target_ref, idKind, componentRectById, diagnostics);
    if (!sourceRect || !targetRect) continue;
    resolvedEndpoints.set(c.id, { source: sourceRect, target: targetRect });
    if (c.source_ref === c.target_ref) {
      const list = selfGroups.get(c.source_ref) ?? [];
      list.push(c);
      selfGroups.set(c.source_ref, list);
    } else {
      const key = unorderedPairKey(c.source_ref, c.target_ref);
      const list = pairGroups.get(key) ?? [];
      list.push(c);
      pairGroups.set(key, list);
    }
  }
  for (const list of selfGroups.values()) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const list of pairGroups.values()) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const gutterBaseY = contentBounds.y + contentBounds.height + C.CONTRACT_GUTTER_ROW_HEIGHT / 2;

  const result: MapContractEdge[] = [];
  for (const c of [...contracts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const endpoints = resolvedEndpoints.get(c.id);

    const resolvedBoundaryRefs: string[] = [];
    for (const refId of c.boundary_refs ?? []) {
      const kind = idKind.get(refId);
      if (kind === undefined) {
        diagnostics.push(unresolvedReference("contract", c.id, "boundary_refs", refId));
      } else if (kind !== "boundary") {
        diagnostics.push(unrenderedReferenceKind("contract", c.id, "boundary_refs", refId, ["boundary"], kind));
      } else {
        resolvedBoundaryRefs.push(refId);
      }
    }

    let route: RoutePath | null = null;
    const isSelfLoop = c.source_ref === c.target_ref;
    if (endpoints) {
      if (isSelfLoop) {
        const group = selfGroups.get(c.source_ref) ?? [c];
        const index = group.findIndex((g) => g.id === c.id);
        const depth = selfLoopDepth(Math.max(index, 0), selfContractCounts.get(c.source_ref) ?? group.length);
        const rect = endpoints.source;
        const topY = rect.y + rect.height * 0.3;
        const bottomY = rect.y + rect.height * 0.7;
        const rightX = rect.x + rect.width;
        const loopX = rightX + depth;
        route = {
          points: [
            { x: rightX, y: topY },
            { x: loopX, y: topY },
            { x: loopX, y: bottomY },
            { x: rightX, y: bottomY },
          ],
        };
      } else {
        const key = unorderedPairKey(c.source_ref, c.target_ref);
        const group = pairGroups.get(key) ?? [c];
        const index = group.findIndex((g) => g.id === c.id);
        const offset = Math.min(Math.max(index, 0) * C.PARALLEL_OFFSET_UNIT, C.PARALLEL_OFFSET_MAX);
        const gutterXA = (componentLaneGutterX.get(c.source_ref) ?? endpoints.source.x + endpoints.source.width) + offset;
        const gutterXB = (componentLaneGutterX.get(c.target_ref) ?? endpoints.target.x + endpoints.target.width) + offset;
        route = buildOrthogonalRoute(endpoints.source, gutterXA, endpoints.target, gutterXB, gutterBaseY + offset);
      }
    }

    result.push({
      id: c.id,
      name: c.name,
      kind: c.kind,
      state: c.state,
      summary: c.summary,
      direction: c.direction,
      sourceId: c.source_ref,
      targetId: c.target_ref,
      isSelfLoop,
      route,
      boundaryRefs: resolvedBoundaryRefs,
      source: c,
    });
  }

  return { contracts: result, diagnostics };
}

export function routeFlows(
  flows: readonly Flow[],
  componentRectById: ReadonlyMap<string, Rect>,
  componentLaneGutterX: ReadonlyMap<string, number>,
  contractsById: ReadonlyMap<string, unknown>,
  boundsSoFar: Rect
): { flows: MapFlowPath[]; diagnostics: MapDiagnostic[] } {
  const diagnostics: MapDiagnostic[] = [];
  const idKindComponentOnly = new Map<string, ResolvableKind>();
  for (const id of componentRectById.keys()) idKindComponentOnly.set(id, "component");

  const sortedFlows = [...flows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const baseRowY = boundsSoFar.y + boundsSoFar.height + C.FLOW_GUTTER_ROW_HEIGHT / 2;

  const result: MapFlowPath[] = [];
  for (let flowIndex = 0; flowIndex < sortedFlows.length; flowIndex++) {
    const flow = sortedFlows[flowIndex];
    if (!flow) continue;
    const rowY = baseRowY + Math.min(flowIndex * C.PARALLEL_OFFSET_UNIT, C.PARALLEL_OFFSET_MAX);

    const orderGroups = new Map<number, string[]>();
    for (const step of flow.steps) {
      const list = orderGroups.get(step.order) ?? [];
      list.push(step.element_ref);
      orderGroups.set(step.order, list);
    }
    for (const [order, elementIds] of orderGroups) {
      if (elementIds.length > 1) {
        diagnostics.push(duplicateFlowStepOrder(flow.id, order, [...elementIds].sort()));
      }
    }

    const sortedSteps = [...flow.steps].sort((a, b) => (a.order !== b.order ? a.order - b.order : a.element_ref < b.element_ref ? -1 : a.element_ref > b.element_ref ? 1 : 0));

    const stepPoints: MapFlowStepPoint[] = sortedSteps.map((step) => {
      const rect = resolveComponentEndpoint("flow", flow.id, "steps[].element_ref", step.element_ref, idKindComponentOnly, componentRectById, diagnostics);
      let contractId: string | null = null;
      if (step.contract_ref) {
        if (contractsById.has(step.contract_ref)) {
          contractId = step.contract_ref;
        } else {
          diagnostics.push(unresolvedReference("flow", flow.id, "steps[].contract_ref", step.contract_ref));
        }
      }
      return {
        order: step.order,
        elementId: step.element_ref,
        resolved: rect !== undefined,
        point: rect ? rightCenterPort(rect) : null,
        contractId,
      };
    });

    const segments: MapFlowSegment[] = [];
    for (let i = 0; i < sortedSteps.length - 1; i++) {
      const fromStep = sortedSteps[i];
      const toStep = sortedSteps[i + 1];
      if (!fromStep || !toStep) continue;
      const fromRect = componentRectById.get(fromStep.element_ref);
      const toRect = componentRectById.get(toStep.element_ref);
      if (!fromRect || !toRect) continue;
      const gutterXFrom = componentLaneGutterX.get(fromStep.element_ref) ?? fromRect.x + fromRect.width;
      const gutterXTo = componentLaneGutterX.get(toStep.element_ref) ?? toRect.x + toRect.width;
      segments.push({
        fromOrder: fromStep.order,
        toOrder: toStep.order,
        route: buildOrthogonalRoute(fromRect, gutterXFrom, toRect, gutterXTo, rowY),
      });
    }

    result.push({
      id: flow.id,
      name: flow.name,
      kind: flow.kind,
      state: flow.state,
      summary: flow.summary,
      steps: stepPoints,
      segments,
      source: flow,
    });
  }

  return { flows: result, diagnostics };
}

export function routeBoundaries(
  boundaries: readonly Boundary[],
  componentRectById: ReadonlyMap<string, Rect>,
  componentLaneGutterX: ReadonlyMap<string, number>,
  idKind: ReadonlyMap<string, ResolvableKind>,
  boundsSoFar: Rect
): { boundaries: MapBoundary[]; diagnostics: MapDiagnostic[] } {
  const diagnostics: MapDiagnostic[] = [];
  const sorted = [...boundaries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const railTopY = boundsSoFar.y + boundsSoFar.height;

  const result: MapBoundary[] = sorted.map((b, index) => {
    const railRect: Rect = {
      x: boundsSoFar.x,
      y: railTopY + index * C.BOUNDARY_RAIL_ROW_HEIGHT,
      width: Math.max(boundsSoFar.width, C.COMPONENT_WIDTH),
      height: C.BOUNDARY_RAIL_ROW_HEIGHT,
    };
    const connectors = [];
    for (const memberId of b.member_refs) {
      const kind = idKind.get(memberId);
      if (kind === undefined) {
        diagnostics.push(unresolvedReference("boundary", b.id, "member_refs", memberId));
        continue;
      }
      if (kind !== "component") {
        diagnostics.push(unrenderedReferenceKind("boundary", b.id, "member_refs", memberId, ["component"], kind));
        continue;
      }
      const rect = componentRectById.get(memberId);
      if (!rect) {
        diagnostics.push(unresolvedReference("boundary", b.id, "member_refs", memberId));
        continue;
      }
      // Gutter-drop, not a straight line from the member's own x — see
      // module header (ARCHITECT REVIEW finding #2): a rail row spans the
      // full content width, so a naive vertical line could cross straight
      // through a sibling component stacked below the member.
      const gutterX = componentLaneGutterX.get(memberId) ?? rect.x + rect.width;
      connectors.push({ memberId, route: buildGutterDropRoute(rect, gutterX, railRect.y) });
    }
    return {
      id: b.id,
      name: b.name,
      kind: b.kind,
      state: b.state,
      summary: b.summary,
      railRect,
      connectors,
      source: b,
    };
  });

  return { boundaries: result, diagnostics };
}

/** Routes `component.authority_refs` connectors — a distinct signal from
 * `boundary.member_refs` membership (brief §3.3) — from each component to
 * the rail row of each resolved-Boundary-kind authority_ref it names.
 * Belongs in the pure routing model, not render-svg.ts (ARCHITECT REVIEW
 * finding #2: connector geometry must not be renderer-owned — see
 * deliverable 10, "the pure map model/layout owner has no DOM or transport
 * dependency" applies equally to "no geometry computed outside the model"). */
export function routeAuthorityConnectors(
  components: readonly MapComponentNode[],
  componentLaneGutterX: ReadonlyMap<string, number>,
  boundaryRailRectById: ReadonlyMap<string, Rect>
): MapAuthorityConnector[] {
  const result: MapAuthorityConnector[] = [];
  for (const component of [...components].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    for (const boundaryId of [...component.authorityRefs].sort()) {
      const railRect = boundaryRailRectById.get(boundaryId);
      if (!railRect) continue; // resolved-but-unrendered boundary already diagnosed upstream (layout.ts)
      const gutterX = componentLaneGutterX.get(component.id) ?? component.rect.x + component.rect.width;
      result.push({
        id: `authority-connector.${component.id}.${boundaryId}`,
        componentId: component.id,
        boundaryId,
        route: buildGutterDropRoute(component.rect, gutterX, railRect.y),
      });
    }
  }
  return result;
}
