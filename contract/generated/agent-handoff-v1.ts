/* eslint-disable */
/**
 * This file was automatically generated from the pinned canonical schema
 * agent-handoff-v1.schema.json (see contract/pin.json for the exact Sensei source commit
 * and digest). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

export type Refs = string[];

/**
 * A bounded, dashboard-populated request handed to a connected agent (Claude, Codex, or another agent) to continue the user's current architectural investigation. This is a separate, mutable, per-interaction envelope, not part of the immutable dashboard-projection-v1 document.
 */
export interface SenseiDashboardAgentHandoffV1 {
  schema_version: "sensei.dashboard.agent-handoff.v1";
  repository: Repository;
  revision: Revision;
  graph_authority: GraphAuthority;
  selected_element: {
    id: string;
    kind: "region" | "component" | "boundary" | "contract" | "flow" | "attention";
  } | null;
  lens: "structure" | "authority" | "behavior" | "risk" | "change" | "closure";
  visible_concern: {
    route: string;
    summary: string | null;
  };
  /**
   * Stable identifiers already supplied by the current projection that ground this request. All categories are optional lists, not inferred relationships.
   */
  referenced_ids: {
    attention_refs?: Refs;
    contract_refs?: Refs;
    boundary_refs?: Refs;
    flow_refs?: Refs;
    evidence_refs?: Refs;
    decision_refs?: Refs;
  };
  active_context: ActiveContext | null;
  requested_intent: "explain" | "review" | "compare" | "propose";
  /**
   * Carried forward from the source projection's availability/coverage limitations so the handoff never implies that visible evidence is exhaustive when observation was partial.
   */
  observation_limitations: string[];
  capability: "read_only" | "propose";
}
export interface Repository {
  key: string;
  display_name: string;
  url?: string | null;
  domain?: string | null;
}
export interface Revision {
  id: string;
  display?: string | null;
  ref?: string | null;
  committed_at?: string | null;
}
export interface GraphAuthority {
  observed: "yes" | "no" | "unknown";
  current: "yes" | "no" | "unknown";
  identity: string | null;
  summary: string;
  provenance?: Provenance;
}
export interface Provenance {
  evidence_refs: Refs;
  decision_refs?: Refs;
  source_refs?: Refs;
  observed_at?: string | null;
  limitations?: string[];
}
export interface ActiveContext {
  kind: "task" | "pull_request" | "change" | "session";
  id: string;
  label: string;
  url?: string | null;
  element_refs?: Refs;
}
