// Diagnostics for the pure Architecture Map model (claude-stage-4-map-brief.md
// §2.2, §3, deliverable 8.3). A diagnostic records that the map omitted or
// could not reconcile something explicit in the projection — it is never a
// repair. No DOM, no rendering, no dependency on anything outside plain data:
// this module is imported by the pure model/layout/routing modules, which
// must stay free of DOM/transport dependencies (deliverable 10).
//
// Three distinct "the reference didn't work" shapes are kept separate
// rather than collapsed into one generic "unresolved" diagnostic, because
// they mean different things to whoever reads them:
//
// - `unresolved_reference`: this id does not exist anywhere in the
//   projection at all. Always a genuine data problem.
// - `wrong_kind_reference`: this id exists, but as a kind the *contract*
//   itself defines this field to mean something else — currently only
//   `component.region_ref`, which the product doc unambiguously defines as
//   "the region this component belongs to." A region_ref naming a
//   Component or Boundary id can't be reinterpreted any other way, so this
//   stays a genuine data problem too.
// - `unrendered_reference_kind`: this id exists and is *valid* data — the
//   pinned schema (docs/dashboard-projection-v1.schema.json) declares
//   source_ref/target_ref/element_ref/authority_refs/boundary_refs/
//   member_refs as generic stableId with no kind restriction anywhere, and
//   neither the schema nor architecture-dashboard-v1.md documents one. This
//   build's routing/geometry only knows how to draw a route for specific
//   kinds in each position (e.g. a Component for a contract endpoint) —
//   when a reference resolves to a different, real object, that is this
//   build's rendering limitation, not the producer's error. Never collapse
//   this into `wrong_kind_reference`, which reads as "the data is wrong."

export type MapDiagnosticKind =
  | "unresolved_reference"
  | "wrong_kind_reference"
  | "unrendered_reference_kind"
  | "membership_mismatch"
  | "duplicate_flow_step_order";

interface DiagnosticBase {
  id: string;
  kind: MapDiagnosticKind;
  message: string;
}

/** The referenced id does not exist anywhere in the projection. */
export interface UnresolvedReferenceDiagnostic extends DiagnosticBase {
  kind: "unresolved_reference";
  sourceKind: string;
  sourceId: string;
  field: string;
  unresolvedId: string;
}

/** The referenced id exists, but names an object of a kind the *contract*
 * defines this field to mean something else (currently region_ref only —
 * see the module header comment). */
export interface WrongKindReferenceDiagnostic extends DiagnosticBase {
  kind: "wrong_kind_reference";
  sourceKind: string;
  sourceId: string;
  field: string;
  referencedId: string;
  expectedKind: string;
  actualKind: string;
}

/** The referenced id exists and is valid data, but resolves to a kind this
 * build's routing does not currently draw geometry for in this position —
 * a rendering limitation, not a producer-data problem (see module header). */
export interface UnrenderedReferenceKindDiagnostic extends DiagnosticBase {
  kind: "unrendered_reference_kind";
  sourceKind: string;
  sourceId: string;
  field: string;
  referencedId: string;
  renderedKinds: readonly string[];
  actualKind: string;
}

/** `region.component_refs` and `component.region_ref` disagree about
 * membership for one region/component pair. Diagnostic only — the map never
 * silently unions or picks a side (brief §2.2: "Do not silently choose a
 * union and hide the conflict"). */
export interface MembershipMismatchDiagnostic extends DiagnosticBase {
  kind: "membership_mismatch";
  regionId: string;
  componentId: string;
  direction: "region_claims_component_but_component_disagrees" | "component_claims_region_but_region_disagrees";
}

/** Two or more steps in one flow share the same explicit `order` value. The
 * stable-id ordering named in `stepElementIds` is used only to describe the
 * ambiguity deterministically, never to silently resolve a real route
 * through it (brief §3.2: "stable-id tie-breaking only for invalid duplicate
 * order diagnostics"). */
export interface DuplicateFlowStepOrderDiagnostic extends DiagnosticBase {
  kind: "duplicate_flow_step_order";
  flowId: string;
  order: number;
  stepElementIds: string[];
}

export type MapDiagnostic =
  | UnresolvedReferenceDiagnostic
  | WrongKindReferenceDiagnostic
  | UnrenderedReferenceKindDiagnostic
  | MembershipMismatchDiagnostic
  | DuplicateFlowStepOrderDiagnostic;

export function unresolvedReference(
  sourceKind: string,
  sourceId: string,
  field: string,
  unresolvedId: string
): UnresolvedReferenceDiagnostic {
  return {
    id: `diagnostic.unresolved_reference.${sourceKind}.${sourceId}.${field}.${unresolvedId}`,
    kind: "unresolved_reference",
    sourceKind,
    sourceId,
    field,
    unresolvedId,
    message: `${sourceKind} "${sourceId}" field "${field}" references "${unresolvedId}", which the map could not resolve to placed geometry (absent from this projection, or itself unplaced due to its own unresolved reference); the map omitted the unresolved geometry.`,
  };
}

export function wrongKindReference(
  sourceKind: string,
  sourceId: string,
  field: string,
  referencedId: string,
  expectedKind: string,
  actualKind: string
): WrongKindReferenceDiagnostic {
  return {
    id: `diagnostic.wrong_kind_reference.${sourceKind}.${sourceId}.${field}.${referencedId}`,
    kind: "wrong_kind_reference",
    sourceKind,
    sourceId,
    field,
    referencedId,
    expectedKind,
    actualKind,
    message: `${sourceKind} "${sourceId}" field "${field}" references "${referencedId}", which is a ${actualKind} — this field only resolves ${expectedKind} ids; the map omitted the unresolved geometry.`,
  };
}

export function unrenderedReferenceKind(
  sourceKind: string,
  sourceId: string,
  field: string,
  referencedId: string,
  renderedKinds: readonly string[],
  actualKind: string
): UnrenderedReferenceKindDiagnostic {
  return {
    id: `diagnostic.unrendered_reference_kind.${sourceKind}.${sourceId}.${field}.${referencedId}`,
    kind: "unrendered_reference_kind",
    sourceKind,
    sourceId,
    field,
    referencedId,
    renderedKinds,
    actualKind,
    message: `${sourceKind} "${sourceId}" field "${field}" references "${referencedId}", a real ${actualKind} — valid data, but this build only draws geometry for a ${renderedKinds.join(" or ")} in this position; the map omitted the geometry (not a producer-data error).`,
  };
}

export function membershipMismatch(
  regionId: string,
  componentId: string,
  direction: MembershipMismatchDiagnostic["direction"]
): MembershipMismatchDiagnostic {
  return {
    id: `diagnostic.membership_mismatch.${regionId}.${componentId}.${direction}`,
    kind: "membership_mismatch",
    regionId,
    componentId,
    direction,
    message:
      direction === "region_claims_component_but_component_disagrees"
        ? `Region "${regionId}" lists component "${componentId}" in component_refs, but that component's own region_ref does not name this region; placement follows the component's region_ref only.`
        : `Component "${componentId}" names region "${regionId}" as its region_ref, but that region's component_refs does not list this component.`,
  };
}

export function duplicateFlowStepOrder(flowId: string, order: number, stepElementIds: string[]): DuplicateFlowStepOrderDiagnostic {
  return {
    id: `diagnostic.duplicate_flow_step_order.${flowId}.${order}`,
    kind: "duplicate_flow_step_order",
    flowId,
    order,
    stepElementIds,
    message: `Flow "${flowId}" has ${stepElementIds.length} steps sharing order ${order} (${stepElementIds.join(", ")}); the map cannot determine a single sequence and did not invent one.`,
  };
}
