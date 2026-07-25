/* eslint-disable */
/**
 * This file was automatically generated from workspace-agent-run-v1.schema.json (see contract/workspace/contracts.json for ownership —
 * this is a Dashboard/runner-owned contract, authored and versioned
 * locally, not pinned from globulario/sensei). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * A Dashboard/runner-owned envelope binding one bounded worker or architect/reviewer attempt to an exact repository, revision, worktree, and role (docs/architecture-workspace-v1.md §12, docs/claude-workspace-o1-brief.md §3). Mutable local orchestration state -- defines no orchestration behavior, only the record shape (Law B).
 */
export type SenseiDashboardWorkspaceAgentRunV1 = {
  [k: string]: unknown;
} & {
  schema_version: "sensei.dashboard.agent-run.v1";
  run_id: string;
  job_id: string;
  repository_domain: string;
  governing_snapshot: GoverningSnapshot;
  expected_head_sha: string | null;
  worktree_id: string | null;
  task_ref: {
    issue_ref?: string | null;
    pr_ref?: string | null;
    task_id?: string | null;
  } | null;
  role: "implementer" | "architect" | "reviewer";
  provider: {
    provider_id: string;
    runtime: string;
  };
  assurance_mode: AssuranceMode;
  required_capabilities: string[];
  operation_class: "read_only" | "mutation";
  governing_contract_ref: {
    brief_path: string | null;
    accepted_sha: string;
  };
  admission_reference: AdmissionReference | null;
  lifecycle_state:
    "queued" | "admitting" | "running" | "waiting_for_human" | "completed" | "failed" | "refused" | "cancelled";
  cancellation: {
    reason: Reason;
    at: string;
  } | null;
  created_at: string;
  updated_at: string;
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
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "reason".
 */
export interface Reason {
  code: string;
  detail: string;
}
