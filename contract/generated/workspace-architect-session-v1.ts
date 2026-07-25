/* eslint-disable */
/**
 * This file was automatically generated from workspace-architect-session-v1.schema.json (see contract/workspace/contracts.json for ownership —
 * this is a Dashboard/runner-owned contract, authored and versioned
 * locally, not pinned from globulario/sensei). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * A Dashboard/runner-owned record of one persistent primary-architect conversation thread (docs/architecture-workspace-v1.md §5, docs/claude-workspace-o1-brief.md §2). Mutable local orchestration state -- not architectural truth, not part of dashboard-projection-v1, and never a claim that this session is the same stored thread as an ordinary browser chat conversation.
 */
export type SenseiDashboardWorkspaceArchitectSessionV1 = {
  [k: string]: unknown;
} & {
  schema_version: "sensei.dashboard.architect-session.v1";
  session_id: string;
  repository_domain: string;
  architect_runtime: {
    provider_id: string;
    runtime: string;
    account_mode?: string | null;
    thread_id: string | null;
    resumable: boolean | null;
  };
  assurance_mode: AssuranceMode;
  governing_snapshot: GoverningSnapshot;
  admission_reference: AdmissionReference | null;
  lifecycle_state: "created" | "authenticating" | "ready" | "active" | "paused" | "expired" | "terminated" | "refused";
  created_at: string;
  updated_at: string;
  active_context: {
    issue_ref?: string | null;
    pr_ref?: string | null;
    task_id?: string | null;
  } | null;
  continuity_refs: string[];
};
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "assuranceMode".
 */
export type AssuranceMode = "manual" | "governed";

/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "governingSnapshot".
 */
export interface GoverningSnapshot {
  repository_domain: string;
  revision: string | null;
  revision_status: "resolved" | "unavailable" | "not_git" | "not_requested";
  tree_digest_sha256: string | null;
  graph_digest_sha256: string | null;
  graph_digest_status: "resolved" | "unavailable" | "unknown";
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "admissionReference".
 */
export interface AdmissionReference {
  admission_id: string;
  decision: "admitted" | "admitted_with_conditions" | "waiting" | "refused" | "uncertifiable";
  decision_digest_sha256: string;
  policy_id: string | null;
}
