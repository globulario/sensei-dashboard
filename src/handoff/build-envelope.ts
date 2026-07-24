// Pure agent-handoff envelope builder (claude-stage-3-brief.md §3.1-3.3).
//
// Populates sensei.dashboard.agent-handoff.v1 fields deterministically from
// a validated dashboard-projection-v1 document, the current selection, and
// explicit user choices only — no DOM access, no fetch, no invented text.
// Every architectural field is copied verbatim from the projection; the only
// author-supplied fields are the ones the schema defines as user-driven
// (visible_concern.summary, requested_intent, lens).

import type {
  Contract,
  FocusRecord,
  SenseiDashboardProjectionV1,
} from "../../contract/generated/dashboard-projection-v1.js";
import type { SenseiDashboardAgentHandoffV1 } from "../../contract/generated/agent-handoff-v1.js";

export type HandoffElementKind = "region" | "component" | "boundary" | "contract" | "flow" | "attention";
export type HandoffLens = "structure" | "authority" | "behavior" | "risk" | "change" | "closure";
export type HandoffIntent = "explain" | "review" | "compare" | "propose";

export const DEFAULT_HANDOFF_LENS: HandoffLens = "structure";

/**
 * The currently-selected Focus element, if any. `focusRecord` is the
 * already-resolved record for `id` (the same one the Focus view is
 * rendering) — the builder never re-resolves it, so it can never disagree
 * with what the user is looking at.
 */
export interface HandoffSelection {
  id: string;
  kind: HandoffElementKind;
  focusRecord: FocusRecord;
}

export interface HandoffUserChoices {
  requestedIntent: HandoffIntent;
  lens: HandoffLens;
  /** Explicit user-authored text only. Never dashboard-generated prose. */
  visibleConcernSummary: string | null;
}

function dedupePreserveOrder(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

function findContract(projection: SenseiDashboardProjectionV1, id: string): Contract | undefined {
  return projection.contracts.find((c) => c.id === id);
}

function buildReferencedIds(
  projection: SenseiDashboardProjectionV1,
  selection: HandoffSelection | null
): SenseiDashboardAgentHandoffV1["referenced_ids"] {
  if (!selection) {
    return {};
  }

  const fr = selection.focusRecord;
  const attentionRefs = [...fr.attention_refs];
  const contractRefs = [...fr.contract_refs];
  const flowRefs = [...fr.flow_refs];
  const decisionRefs = [...fr.decision_refs];
  const evidenceRefs = [...fr.provenance.evidence_refs];
  const boundaryRefs: string[] = [];

  // Each selected element kind additionally contributes its own id to the
  // one referenced_ids category the schema defines for that kind (brief
  // §3.3) — FocusRecord itself has no boundary_refs field at all, so
  // boundary_refs is only ever populated via these two branches.
  switch (selection.kind) {
    case "boundary":
      boundaryRefs.push(selection.id);
      break;
    case "contract": {
      contractRefs.push(selection.id);
      const contract = findContract(projection, selection.id);
      if (contract?.boundary_refs) {
        boundaryRefs.push(...contract.boundary_refs);
      }
      break;
    }
    case "flow":
      flowRefs.push(selection.id);
      break;
    case "attention":
      attentionRefs.push(selection.id);
      break;
    default:
      break;
  }

  const referenced: SenseiDashboardAgentHandoffV1["referenced_ids"] = {};
  const attention = dedupePreserveOrder(attentionRefs);
  const contract = dedupePreserveOrder(contractRefs);
  const boundary = dedupePreserveOrder(boundaryRefs);
  const flow = dedupePreserveOrder(flowRefs);
  const evidence = dedupePreserveOrder(evidenceRefs);
  const decision = dedupePreserveOrder(decisionRefs);
  if (attention.length) referenced.attention_refs = attention;
  if (contract.length) referenced.contract_refs = contract;
  if (boundary.length) referenced.boundary_refs = boundary;
  if (flow.length) referenced.flow_refs = flow;
  if (evidence.length) referenced.evidence_refs = evidence;
  if (decision.length) referenced.decision_refs = decision;
  return referenced;
}

function buildObservationLimitations(projection: SenseiDashboardProjectionV1): string[] {
  const collected: string[] = [
    ...projection.availability.limitations,
    ...(projection.assessments.observation_completeness.provenance.limitations ?? []),
    ...projection.availability.sources.flatMap((s) => s.limitations ?? []),
  ];
  return dedupePreserveOrder(collected);
}

/**
 * Builds a sensei.dashboard.agent-handoff.v1 envelope. Pure and synchronous:
 * every value is either copied verbatim from `projection`/`selection` or
 * supplied explicitly by the caller via `choices` — nothing is computed,
 * inferred, or authored here. Callers must run the result through
 * `validateHandoffEnvelope` (src/adapter/schema-validate.ts) before allowing
 * export.
 */
export function buildHandoffEnvelope(
  projection: SenseiDashboardProjectionV1,
  route: string,
  selection: HandoffSelection | null,
  choices: HandoffUserChoices
): SenseiDashboardAgentHandoffV1 {
  return {
    schema_version: "sensei.dashboard.agent-handoff.v1",
    repository: projection.identity.repository,
    revision: projection.identity.revision,
    graph_authority: projection.identity.graph_authority,
    selected_element: selection ? { id: selection.id, kind: selection.kind } : null,
    lens: choices.lens,
    visible_concern: {
      route,
      summary: choices.visibleConcernSummary,
    },
    referenced_ids: buildReferencedIds(projection, selection),
    active_context: projection.active_context ?? null,
    requested_intent: choices.requestedIntent,
    observation_limitations: buildObservationLimitations(projection),
    capability: choices.requestedIntent === "propose" ? "propose" : "read_only",
  };
}
