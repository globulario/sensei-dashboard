/* eslint-disable */
/**
 * This file was automatically generated from workspace-execution-receipt-v1.schema.json (see contract/workspace/contracts.json for ownership —
 * this is a Dashboard/runner-owned contract, authored and versioned
 * locally, not pinned from globulario/sensei). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * A Dashboard/runner-owned summary of immutable run evidence after one bounded attempt (docs/architecture-workspace-v1.md §13, docs/claude-workspace-o1-brief.md §5). Reports evidence, never a trust claim -- it must not assert that code is safe, correct, architecturally complete, or mergeable merely because a run completed (Law E).
 */
export type SenseiDashboardWorkspaceExecutionReceiptV1 = {
  [k: string]: unknown;
} & {
  schema_version: "sensei.dashboard.execution-receipt.v1";
  receipt_id: string;
  run_id: string;
  job_id: string;
  provider: {
    provider_id: string;
    runtime: string;
  };
  role: "implementer" | "architect" | "reviewer";
  repository_domain: string;
  governing_snapshot: GoverningSnapshot;
  expected_head_sha: string | null;
  worktree_id: string | null;
  assurance_mode: AssuranceMode;
  accepted_governing_brief_ref: {
    brief_path: string | null;
    accepted_sha: string;
  };
  admission_reference: AdmissionReference | null;
  command_summaries: {
    summary_id: string;
    approved: boolean | null;
    outcome: "completed" | "failed" | "cancelled" | "pending";
  }[];
  changed_files: {
    path: string;
    change_kind: "added" | "modified" | "removed" | "renamed";
    digest_sha256: string | null;
  }[];
  tests: {
    name: string;
    outcome: "passed" | "failed" | "skipped" | "unknown";
  }[];
  ci_observations: {
    provider: string;
    check_name: string;
    status: "success" | "failure" | "pending" | "unknown";
    sha: string;
    observed_at: string;
  }[];
  github_write_refs: string[];
  completion_facts: {
    worker_completed: FactState;
    tests_passed: FactState;
    ci_observed_green: FactState;
    sensei_completion_verified: FactState;
    architect_exact_sha_approval: FactState;
    human_merge_occurred: FactState;
  };
  limitations: string[];
  outcome_detail: {
    kind: "cancelled" | "failed" | "refused";
    reason: Reason;
  } | null;
  redaction_declaration: {
    redacted: boolean;
    note: string | null;
  };
  created_at: string;
};
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "assuranceMode".
 */
export type AssuranceMode = "manual" | "governed";
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "factState".
 */
export type FactState = "yes" | "no" | "unknown" | "not_applicable";

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
