/* eslint-disable */
/**
 * This file was automatically generated from the pinned canonical schema
 * workspace-identity-v1.schema.json (see contract/workspace/sensei-pin.json for the exact
 * Sensei source commit and digest). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * This interface was referenced by `SenseiWorkspaceIdentityV1`'s JSON-Schema
 * via the `definition` "binding".
 */
export type Binding = {
  repository_domain: string;
  revision: string | null;
  revision_status: "resolved" | "unavailable" | "not_git" | "not_requested";
  tree_digest_sha256: Sha256Hex | null;
  graph_digest_sha256: Sha256Hex | null;
  graph_digest_status: "resolved" | "unavailable" | "not_requested";
};
/**
 * This interface was referenced by `SenseiWorkspaceIdentityV1`'s JSON-Schema
 * via the `definition` "sha256Hex".
 */
export type Sha256Hex = string;
/**
 * This interface was referenced by `SenseiWorkspaceIdentityV1`'s JSON-Schema
 * via the `definition` "taskIdentity".
 */
export type TaskIdentity = {
  state: "not_requested" | "resolved" | "unavailable";
  task_id: string | null;
};

/**
 * A closed, versioned composition of existing Sensei-owned facts about one checkout: configured repository identity, revision/tree binding, graph authority, coverage, and optional task identity. Evidence, not permission.
 */
export interface SenseiWorkspaceIdentityV1 {
  schema_version: "sensei.workspace.identity.v1";
  generated_by: string;
  composition_state: "complete" | "partial" | "unavailable";
  binding: Binding;
  repository_domain_source: "configured" | "unbound";
  graph_authority: GraphAuthority | null;
  coverage_state:
    "COVERAGE_STATE_UNSPECIFIED" | "COVERAGE_STATE_EMPTY" | "COVERAGE_STATE_THIN" | "COVERAGE_STATE_SUFFICIENT";
  task_identity: TaskIdentity;
  limitations: Limitation[];
}
/**
 * This interface was referenced by `SenseiWorkspaceIdentityV1`'s JSON-Schema
 * via the `definition` "graphAuthority".
 */
export interface GraphAuthority {
  authoritative: boolean;
  graph_freshness_state:
    | "GRAPH_FRESHNESS_STATE_UNSPECIFIED"
    | "GRAPH_FRESHNESS_STATE_CURRENT"
    | "GRAPH_FRESHNESS_STATE_STALE"
    | "GRAPH_FRESHNESS_STATE_UNKNOWN"
    | "GRAPH_FRESHNESS_STATE_EMPTY"
    | "GRAPH_FRESHNESS_STATE_CHECK_ERROR";
  graph_freshness_detail: string;
  seed_state: "SEED_STATE_UNSPECIFIED" | "SEED_STATE_CURRENT" | "SEED_STATE_STALE" | "SEED_STATE_UNSTAMPED";
  build_provenance_state:
    | "BUILD_PROVENANCE_STATE_UNSPECIFIED"
    | "BUILD_PROVENANCE_STATE_STAMPED"
    | "BUILD_PROVENANCE_STATE_DEV"
    | "BUILD_PROVENANCE_STATE_INCOMPLETE";
  live_store_graph_digest_sha256: Sha256Hex;
  live_store_graph_triple_count: number;
  embedded_seed_digest_sha256: Sha256Hex;
  embedded_transaction_stamp_present: boolean;
  embedded_transaction_matches_seed: boolean;
  certified_awareness_graph_commit: string;
  certified_services_repo_commit: string;
}
/**
 * This interface was referenced by `SenseiWorkspaceIdentityV1`'s JSON-Schema
 * via the `definition` "limitation".
 */
export interface Limitation {
  source: string;
  scope: string;
  reason: string;
  blocking: boolean;
}
