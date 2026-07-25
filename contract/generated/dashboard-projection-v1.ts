/* eslint-disable */
/**
 * This file was automatically generated from the pinned canonical schema
 * dashboard-projection-v1.schema.json (see contract/pin.json for the exact Sensei source commit
 * and digest). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "stableId".
 */
export type StableId = string;
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "triState".
 */
export type TriState = "yes" | "no" | "unknown";
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "refs".
 */
export type Refs = StableId[];
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "availabilityState".
 */
export type AvailabilityState = "available" | "partial" | "unavailable";
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "knowledgeState".
 */
export type KnowledgeState =
  | "healthy"
  | "attention"
  | "at_risk"
  | "degraded"
  | "open"
  | "proven"
  | "contested"
  | "unknown"
  | "unobserved"
  | "not_applicable";
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "severity".
 */
export type Severity = "info" | "low" | "medium" | "high" | "critical" | "unknown" | "not_applicable";

/**
 * A versioned, human-scale architectural projection produced by Sensei core and rendered by Sensei Dashboard.
 */
export interface SenseiDashboardProjectionV1 {
  schema_version: "sensei.dashboard.projection.v1";
  identity: Identity;
  availability: ProjectionAvailability;
  assessments: {
    architecture_health: Assessment;
    projection_integrity: Assessment;
    observation_completeness: ObservationAssessment;
  };
  active_context?: ActiveContext | null;
  /**
   * @maxItems 12
   */
  briefing:
    | []
    | [BriefingStatement]
    | [BriefingStatement, BriefingStatement]
    | [BriefingStatement, BriefingStatement, BriefingStatement]
    | [BriefingStatement, BriefingStatement, BriefingStatement, BriefingStatement]
    | [BriefingStatement, BriefingStatement, BriefingStatement, BriefingStatement, BriefingStatement]
    | [BriefingStatement, BriefingStatement, BriefingStatement, BriefingStatement, BriefingStatement, BriefingStatement]
    | [
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement
      ]
    | [
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement
      ]
    | [
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement
      ]
    | [
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement
      ]
    | [
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement
      ]
    | [
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement,
        BriefingStatement
      ];
  /**
   * @maxItems 24
   */
  facts?: Fact[];
  regions: Region[];
  components: Component[];
  boundaries: Boundary[];
  contracts: Contract[];
  flows: Flow[];
  attention: AttentionItem[];
  evolution: Evolution;
  focus_records: FocusRecord[];
  capabilities?: Capabilities;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "identity".
 */
export interface Identity {
  projection_id: StableId;
  repository: {
    key: StableId;
    display_name: string;
    url?: string | null;
    domain?: string | null;
  };
  revision: {
    id: StableId;
    display?: string | null;
    ref?: string | null;
    committed_at?: string | null;
  };
  graph_authority: {
    observed: "yes" | "no" | "unknown";
    current: TriState;
    identity: string | null;
    summary: string;
    provenance?: Provenance;
  };
  generated_at: string;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "provenance".
 */
export interface Provenance {
  evidence_refs: Refs;
  decision_refs?: Refs;
  source_refs?: Refs;
  observed_at?: string | null;
  limitations?: string[];
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "projectionAvailability".
 */
export interface ProjectionAvailability {
  state: AvailabilityState;
  summary: string;
  limitations: string[];
  sources: SourceState[];
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "sourceState".
 */
export interface SourceState {
  owner: StableId;
  availability: AvailabilityState;
  summary: string;
  limitations?: string[];
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "assessment".
 */
export interface Assessment {
  state: KnowledgeState;
  label: string;
  summary: string;
  severity: Severity;
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "observationAssessment".
 */
export interface ObservationAssessment {
  state: KnowledgeState;
  label: string;
  summary: string;
  severity: Severity;
  coverage: {
    observed: number | null;
    total: number | null;
    unit: string;
  };
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "activeContext".
 */
export interface ActiveContext {
  kind: "task" | "pull_request" | "change" | "session";
  id: StableId;
  label: string;
  url?: string | null;
  element_refs?: Refs;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "briefingStatement".
 */
export interface BriefingStatement {
  id: StableId;
  kind: "orientation" | "health" | "integrity" | "observation" | "change" | "attention";
  text: string;
  severity: Severity;
  element_refs: Refs;
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "fact".
 */
export interface Fact {
  id: StableId;
  label: string;
  value: string | number | null;
  unit?: string | null;
  state: KnowledgeState;
  element_refs?: Refs;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "region".
 */
export interface Region {
  id: StableId;
  name: string;
  responsibility: string;
  state: KnowledgeState;
  component_refs: Refs;
  visual_anchor: VisualAnchor;
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "visualAnchor".
 */
export interface VisualAnchor {
  order: number;
  lane?: string | null;
  group?: string | null;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "component".
 */
export interface Component {
  id: StableId;
  name: string;
  region_ref: StableId;
  responsibility: string;
  state: KnowledgeState;
  authority_refs: Refs;
  visual_anchor: VisualAnchor;
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "boundary".
 */
export interface Boundary {
  id: StableId;
  name: string;
  kind: "authority" | "ownership" | "domain" | "trust" | "deployment" | "other";
  member_refs: Refs;
  state: KnowledgeState;
  summary: string;
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "contract".
 */
export interface Contract {
  id: StableId;
  name: string;
  source_ref: StableId;
  target_ref: StableId;
  kind: string;
  direction: "source_to_target" | "target_to_source" | "bidirectional" | "undirected";
  state: KnowledgeState;
  summary: string;
  boundary_refs?: Refs;
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "flow".
 */
export interface Flow {
  id: StableId;
  name: string;
  kind: "command" | "query" | "event" | "data" | "publication" | "governance" | "other";
  state: KnowledgeState;
  /**
   * @minItems 1
   */
  steps: [FlowStep, ...FlowStep[]];
  summary: string;
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "flowStep".
 */
export interface FlowStep {
  order: number;
  element_ref: StableId;
  contract_ref?: StableId | null;
  summary?: string | null;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "attentionItem".
 */
export interface AttentionItem {
  id: StableId;
  kind:
    | "contradiction"
    | "question"
    | "missing_evidence"
    | "stale_evidence"
    | "boundary_pressure"
    | "failure_mode"
    | "forbidden_move"
    | "integrity"
    | "observation_gap"
    | "other";
  title: string;
  summary: string;
  severity: Severity;
  state: KnowledgeState;
  element_refs: Refs;
  selectable?: boolean;
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "evolution".
 */
export interface Evolution {
  availability: AvailabilityState;
  base_revision: StableId | null;
  head_revision: StableId;
  summary?: string | null;
  limitations?: string[];
  changes: Change[];
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "change".
 */
export interface Change {
  id: StableId;
  kind:
    | "region_added"
    | "region_removed"
    | "component_added"
    | "component_removed"
    | "component_moved"
    | "responsibility_changed"
    | "authority_changed"
    | "boundary_added"
    | "boundary_removed"
    | "boundary_changed"
    | "contract_added"
    | "contract_removed"
    | "contract_changed"
    | "flow_changed"
    | "evidence_improved"
    | "evidence_degraded"
    | "question_opened"
    | "question_resolved"
    | "contradiction_introduced"
    | "contradiction_resolved"
    | "observation_changed"
    | "other";
  title: string;
  summary: string;
  impact: "improved" | "degraded" | "changed" | "unknown";
  element_refs: Refs;
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "focusRecord".
 */
export interface FocusRecord {
  element_ref: StableId;
  element_kind: "region" | "component" | "boundary" | "contract" | "flow" | "attention";
  name: string;
  responsibility: string;
  state: KnowledgeState;
  owner_refs: Refs;
  owned_refs?: Refs;
  contract_refs: Refs;
  flow_refs: Refs;
  attention_refs: Refs;
  decision_refs: Refs;
  recent_change_refs?: Refs;
  source_links?: {
    label: string;
    target: string;
  }[];
  provenance: Provenance;
}
/**
 * This interface was referenced by `SenseiDashboardProjectionV1`'s JSON-Schema
 * via the `definition` "capabilities".
 */
export interface Capabilities {
  live_refresh?: boolean;
  revision_compare?: boolean;
  agent_handoff?: "none" | "export" | "live";
  source_deep_links?: boolean;
}
