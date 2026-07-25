/* eslint-disable */
/**
 * This file was automatically generated from workspace-github-action-v1.schema.json (see contract/workspace/contracts.json for ownership —
 * this is a Dashboard/runner-owned contract, authored and versioned
 * locally, not pinned from globulario/sensei). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * A governed GitHub action request or result envelope for the future runner gateway (docs/architecture-workspace-v1.md §10, docs/claude-workspace-o1-brief.md §6). Defines the envelope shape only -- it does not implement GitHub writes. Automatic merge is deliberately not a representable action_kind.
 */
export type SenseiDashboardWorkspaceGitHubActionV1 = RequestEnvelope | ResultEnvelope;
export type ActionKind =
  | "inspect_repository_state"
  | "inspect_issue_state"
  | "inspect_pr_state"
  | "inspect_commit_state"
  | "inspect_check_state"
  | "create_issue"
  | "update_issue"
  | "create_draft_pr"
  | "post_comment"
  | "post_exact_sha_review"
  | "mark_ready_for_review"
  | "request_human_merge_authorization";

export interface RequestEnvelope {
  schema_version: "sensei.dashboard.github-action.v1";
  kind: "request";
  action_kind: ActionKind;
  idempotency_key: string;
  repository_domain: string;
  job_id: string;
  role: "implementer" | "architect" | "reviewer";
  issue_ref: string | null;
  pr_ref: string | null;
  expected_head_sha: string | null;
  human_confirmation: {
    required: boolean;
    state: "not_required" | "pending" | "confirmed" | "denied";
  };
  payload: {
    title?: string | null;
    body?: string | null;
    base_sha?: string | null;
    head_sha?: string | null;
  };
}
export interface ResultEnvelope {
  schema_version: "sensei.dashboard.github-action.v1";
  kind: "result";
  action_kind: ActionKind;
  idempotency_key: string;
  status: "succeeded" | "failed" | "refused";
  observed: {
    repository_domain: string | null;
    issue_ref: string | null;
    pr_ref: string | null;
    sha: string | null;
    url: string | null;
  };
  reason: Reason | null;
  observed_at: string;
}
export interface Reason {
  code: string;
  detail: string;
}
