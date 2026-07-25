// Pure Architecture Map model (claude-stage-4-map-brief.md, deliverable 1).
// buildArchitectureMapModel() receives an already-validated projection and
// returns plain immutable data — no DOM nodes, no lens parameter (Structure
// and Authority render the exact same model; lens only changes emphasis in
// render-svg.ts, never geometry — brief Law C), no fetch, no globals, no
// projection mutation. Types here are imported (type-only, so no runtime
// circular dependency) by layout.ts and routing.ts, which own the actual
// placement/routing algorithms; this file only orchestrates them in the
// fixed order the geometry depends on: lanes/regions/components first
// (routing needs their finished rects), then contracts, then flows, then
// the boundary rail, then bounds last.

import type {
  SenseiDashboardProjectionV1,
  Region,
  Component,
  Boundary,
  Contract,
  Flow,
  KnowledgeState,
} from "../../contract/generated/dashboard-projection-v1.js";
import type { MapDiagnostic } from "./diagnostics.js";
import { placeMap } from "./layout.js";
import { routeContracts, routeFlows, routeBoundaries, routeAuthorityConnectors } from "./routing.js";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutePoint {
  x: number;
  y: number;
}

export interface RoutePath {
  points: RoutePoint[];
}

/** Every real object kind this map's shared id→kind lookup can identify —
 * i.e. every kind an explicit reference field in this schema might
 * plausibly name, whether or not this build currently draws geometry for
 * that combination (see routing.ts's reference-kind matrix for exactly
 * which field renders which kind). ARCHITECT REVIEW (third pass) on PR #6:
 * this must cover every real projection object kind a stableId reference
 * could name — region/component/boundary alone under-covers it, since a
 * reference could just as easily name a real Contract or Flow id (e.g. a
 * `contract.source_ref` typo'd into another contract's id). Attention
 * items and evolution changes are deliberately excluded: no field this map
 * resolves (brief Law D's explicit list) is documented to ever name either
 * kind, so they stay outside this lookup's scope rather than being added
 * speculatively. */
export type ResolvableKind = "region" | "component" | "boundary" | "contract" | "flow";

export interface MapLane {
  id: string;
  /** Normalized `visual_anchor.lane` token, or the documented default when
   * absent (see layout.ts's DEFAULT_LANE_TOKEN). An owner hint, not an
   * architectural entity (brief §2.3) — never rendered as a domain/owner. */
  token: string;
  /** Human-facing label: the original (non-normalized) lane string from the
   * first region/component that supplied one, or a neutral placeholder. */
  label: string;
  order: number;
  rect: Rect;
}

export interface MapRegionNode {
  id: string;
  name: string;
  responsibility: string;
  state: KnowledgeState;
  laneId: string;
  rect: Rect;
  source: Region;
}

export interface MapComponentNode {
  id: string;
  name: string;
  responsibility: string;
  state: KnowledgeState;
  regionId: string;
  rect: Rect;
  /** Resolved-only boundary ids from `component.authority_refs` (brief
   * §3.3: "may emphasize direct links to the referenced boundary/authority
   * object only" — Authority-lens-only emphasis, not a new relationship). */
  authorityRefs: readonly string[];
  source: Component;
}

export interface MapBoundaryConnector {
  memberId: string;
  /** Full route from the member component's own lane gutter down to the
   * rail row (see routing.ts's gutter-drop pattern) — never a straight line
   * from the member's own x, which could cross a sibling component stacked
   * below it in the same region/lane. */
  route: RoutePath;
}

/** A `component.authority_refs` connector — a distinct signal from
 * `boundary.member_refs` membership (brief §3.3), so kept as its own
 * top-level relationship collection rather than nested under either side.
 * Computed in routing.ts, never in render-svg.ts (brief deliverable 10:
 * "the pure map model/layout owner has no DOM or transport dependency" —
 * all geometry, including this one, belongs to the pure model). */
export interface MapAuthorityConnector {
  id: string;
  componentId: string;
  boundaryId: string;
  route: RoutePath;
}

export interface MapBoundary {
  id: string;
  name: string;
  kind: Boundary["kind"];
  state: KnowledgeState;
  summary: string;
  /** One row in the boundary rail band (brief §3.3's "deterministic
   * labelled boundary rail/band" — never a geometric enclosure). */
  railRect: Rect;
  /** Only resolved members get a connector; unresolved member_refs entries
   * are diagnostics only (see ArchitectureMapModel.diagnostics). */
  connectors: MapBoundaryConnector[];
  source: Boundary;
}

export interface MapContractEdge {
  id: string;
  name: string;
  kind: string;
  state: KnowledgeState;
  summary: string;
  direction: Contract["direction"];
  sourceId: string;
  targetId: string;
  isSelfLoop: boolean;
  /** null when source_ref or target_ref did not resolve to a component —
   * the edge is omitted from geometry and only appears in diagnostics
   * (brief §3.1: "omit the geometric edge ... emit a visible diagnostic"). */
  route: RoutePath | null;
  /** Resolved-only boundary ids this contract explicitly names via
   * boundary_refs (brief §3.3: "may emphasize the explicit crossing only"). */
  boundaryRefs: readonly string[];
  source: Contract;
}

export interface MapFlowStepPoint {
  order: number;
  elementId: string;
  resolved: boolean;
  point: RoutePoint | null;
  /** Resolved-only contract id this step explicitly names, if any. */
  contractId: string | null;
}

export interface MapFlowSegment {
  fromOrder: number;
  toOrder: number;
  route: RoutePath;
}

export interface MapFlowPath {
  id: string;
  name: string;
  kind: string;
  state: KnowledgeState;
  summary: string;
  /** Every step, in `order` order, whether or not it resolved — render-svg
   * uses this to place per-step markers even for a step whose neighbor
   * didn't resolve. */
  steps: MapFlowStepPoint[];
  /** Only between immediately-consecutive resolved steps (brief §3.2:
   * "connect only consecutive explicit element_ref steps"). */
  segments: MapFlowSegment[];
  source: Flow;
}

export interface ArchitectureMapModel {
  projectionId: string;
  bounds: Rect;
  lanes: MapLane[];
  regions: MapRegionNode[];
  components: MapComponentNode[];
  boundaries: MapBoundary[];
  authorityConnectors: MapAuthorityConnector[];
  contracts: MapContractEdge[];
  flows: MapFlowPath[];
  diagnostics: MapDiagnostic[];
}

/** Local, pure id→kind lookup covering every `ResolvableKind` (region/
 * component/boundary/contract/flow — see that type's own doc for why
 * attention/evolution-changes are excluded). This is the single shared
 * classifier every reference-resolution call site in layout.ts/routing.ts
 * consults to tell "this id names a real object of a different kind" apart
 * from "this id doesn't exist anywhere" — it must index every kind a
 * reference field could plausibly name, not just the kinds this build
 * currently draws geometry for (that narrower "what do we render"
 * decision lives per-field in routing.ts's matrix, applied after this
 * lookup, never baked into the lookup itself). Deliberately not
 * `ReferenceIndex` (src/adapter/reference-index.ts): that class imports
 * `elementHref`, which reads `window.location`, and the pure model must
 * have zero DOM dependency (brief deliverable 10). Rebuilt fresh on every
 * call — cheap for a human-scale projection, and it keeps the model a pure
 * function of its input with no shared mutable state. */
function buildIdKindMap(projection: SenseiDashboardProjectionV1): Map<string, ResolvableKind> {
  const map = new Map<string, ResolvableKind>();
  for (const r of projection.regions) map.set(r.id, "region");
  for (const c of projection.components) map.set(c.id, "component");
  for (const b of projection.boundaries) map.set(b.id, "boundary");
  for (const c of projection.contracts) map.set(c.id, "contract");
  for (const f of projection.flows) map.set(f.id, "flow");
  return map;
}

function countSelfContracts(contracts: readonly Contract[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of contracts) {
    if (c.source_ref === c.target_ref) {
      counts.set(c.source_ref, (counts.get(c.source_ref) ?? 0) + 1);
    }
  }
  return counts;
}

function unionRect(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function buildArchitectureMapModel(projection: SenseiDashboardProjectionV1): ArchitectureMapModel {
  const idKind = buildIdKindMap(projection);
  const selfContractCounts = countSelfContracts(projection.contracts);

  const layout = placeMap(projection.regions, projection.components, idKind, selfContractCounts);

  const componentRectById = new Map<string, Rect>();
  const componentRegionIdById = new Map<string, string>();
  for (const c of layout.componentNodes) {
    componentRectById.set(c.id, c.rect);
    componentRegionIdById.set(c.id, c.regionId);
  }
  const regionLaneIdById = new Map<string, string>();
  for (const r of layout.regionNodes) regionLaneIdById.set(r.id, r.laneId);
  const laneRectById = new Map<string, Rect>();
  for (const l of layout.lanes) laneRectById.set(l.id, l.rect);

  const componentLaneGutterX = new Map<string, number>();
  for (const c of layout.componentNodes) {
    const laneId = regionLaneIdById.get(c.regionId);
    const laneRect = laneId ? laneRectById.get(laneId) : undefined;
    if (laneRect) componentLaneGutterX.set(c.id, laneRect.x + laneRect.width);
  }

  const contentBounds = unionRect(layout.lanes.map((l) => l.rect));

  const contractsResult = routeContracts(
    projection.contracts,
    componentRectById,
    componentLaneGutterX,
    idKind,
    selfContractCounts,
    contentBounds
  );

  const contractsById = new Map<string, Contract>();
  for (const c of projection.contracts) contractsById.set(c.id, c);

  const afterContractsBounds = unionRect([contentBounds, ...contractsResult.contracts.map((c) => routeBoundsOf(c.route))]);

  const flowsResult = routeFlows(projection.flows, componentRectById, componentLaneGutterX, contractsById, idKind, afterContractsBounds);

  const afterFlowsBounds = unionRect([
    afterContractsBounds,
    ...flowsResult.flows.flatMap((f) => f.segments.map((s) => routeBoundsOf(s.route))),
  ]);

  const boundariesResult = routeBoundaries(
    projection.boundaries,
    componentRectById,
    componentLaneGutterX,
    idKind,
    afterFlowsBounds
  );

  const boundaryRailRectById = new Map(boundariesResult.boundaries.map((b) => [b.id, b.railRect]));
  const authorityConnectors = routeAuthorityConnectors(layout.componentNodes, componentLaneGutterX, boundaryRailRectById);

  const boundsRects = [
    afterFlowsBounds,
    ...boundariesResult.boundaries.map((b) => b.railRect),
    ...authorityConnectors.map((c) => routeBoundsOf(c.route)),
  ];
  const bounds = padRect(unionRect(boundsRects), VIEWBOX_MARGIN);

  return {
    projectionId: projection.identity.projection_id,
    bounds,
    lanes: layout.lanes,
    regions: layout.regionNodes,
    components: layout.componentNodes,
    boundaries: boundariesResult.boundaries,
    authorityConnectors,
    contracts: contractsResult.contracts,
    flows: flowsResult.flows,
    diagnostics: [...layout.diagnostics, ...contractsResult.diagnostics, ...flowsResult.diagnostics, ...boundariesResult.diagnostics],
  };
}

const VIEWBOX_MARGIN = 24;

function routeBoundsOf(route: RoutePath | null): Rect {
  if (!route || route.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  return unionRect(route.points.map((p) => ({ x: p.x, y: p.y, width: 0, height: 0 })));
}

function padRect(rect: Rect, margin: number): Rect {
  return { x: rect.x - margin, y: rect.y - margin, width: rect.width + margin * 2, height: rect.height + margin * 2 };
}
