// Relationship routing (claude-stage-4-map-brief.md §3). Only the explicit
// reference fields Law D permits are resolved here, against exactly the
// kind each field is documented to name — confirmed against every accepted
// fixture (docs/fixtures/dashboard-projection/v1/*): `contract.source_ref`/
// `target_ref` and `flow.steps[*].element_ref` only ever name a Component;
// `component.authority_refs`, `contract.boundary_refs`, and
// `boundary.member_refs` only ever name a Boundary... except member_refs,
// which real-repo's own data shows naming Components (a boundary's members
// are the components inside it, not other boundaries) — so member_refs
// resolves against Component, not Boundary. Anything that resolves to the
// wrong kind, or doesn't resolve at all, becomes a diagnostic and is
// omitted from geometry — never guessed, never drawn to the wrong target.
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
// Cross-node routing (only exercised by the synthetic map-rich fixture,
// since real-repo has none) goes through each component's own lane's right-
// edge gutter column — a strip of horizontal space that is empty of node
// content by construction (it's the spacing between lane columns) — down to
// a shared horizontal gutter row placed below all region content, then
// across, then back up through the target's lane gutter. This is safe by
// construction: the only two kinds of segments are (a) a short horizontal
// hop from a component's own right edge to its own lane's gutter, which
// only ever passes through that component's own region's reserved margin,
// and (b) vertical/horizontal travel confined to gutter columns/rows that
// never contain node rects.

import type { Contract, Flow, Boundary } from "../../contract/generated/dashboard-projection-v1.js";
import type { ResolvableKind, Rect, RoutePath, RoutePoint, MapContractEdge, MapFlowPath, MapFlowStepPoint, MapFlowSegment, MapBoundary } from "./model.js";
import type { MapDiagnostic } from "./diagnostics.js";
import { unresolvedReference, wrongKindReference, duplicateFlowStepOrder } from "./diagnostics.js";
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

/** Resolves an id that must name a Component. Returns the component's rect
 * on success; pushes exactly one diagnostic and returns undefined
 * otherwise (unresolved entirely, wrong kind, or a Component id that exists
 * but was never placed because its own region_ref didn't resolve). */
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
    diagnostics.push(wrongKindReference(sourceKind, sourceId, field, refId, "component", kind));
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
        diagnostics.push(wrongKindReference("contract", c.id, "boundary_refs", refId, "boundary", kind));
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
        diagnostics.push(wrongKindReference("boundary", b.id, "member_refs", memberId, "component", kind));
        continue;
      }
      const rect = componentRectById.get(memberId);
      if (!rect) {
        diagnostics.push(unresolvedReference("boundary", b.id, "member_refs", memberId));
        continue;
      }
      connectors.push({ memberId, point: { x: rect.x + rect.width / 2, y: rect.y + rect.height } });
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
