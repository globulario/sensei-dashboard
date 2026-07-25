// Diagnostics for the pure Architecture Map model (claude-stage-4-map-brief.md
// §2.2, §3, deliverable 8.3). A diagnostic records that the map omitted or
// could not reconcile something explicit in the projection — it is never a
// repair. No DOM, no rendering, no dependency on anything outside plain data:
// this module is imported by the pure model/layout/routing modules, which
// must stay free of DOM/transport dependencies (deliverable 10).
//
// Two distinct "the reference didn't work" shapes are kept separate rather
// than collapsed into one generic "unresolved" diagnostic, because they mean
// different things to whoever reads them: `unresolved_reference` is "this id
// does not exist anywhere in the projection", `wrong_kind_reference` is "this
// id exists, but as a kind this field is not permitted to point at" (e.g. a
// contract's source_ref naming a real Region id — contracts may only
// reference components; see routing.ts).

export type MapDiagnosticKind =
  | "unresolved_reference"
  | "wrong_kind_reference"
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

/** The referenced id exists, but names an object of a kind this field is not
 * permitted to resolve against (see routing.ts's endpoint-resolution scope). */
export interface WrongKindReferenceDiagnostic extends DiagnosticBase {
  kind: "wrong_kind_reference";
  sourceKind: string;
  sourceId: string;
  field: string;
  referencedId: string;
  expectedKind: string;
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
