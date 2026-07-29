/* eslint-disable */
/**
 * This file was automatically generated from the pinned canonical schema
 * workspace-admission-v1.schema.json (see contract/workspace/sensei-pin.json for the exact
 * Sensei source commit and digest). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * A closed, versioned external projection of Sensei's existing local admission.Decision and admission.Verification owners. Does not redefine admission: permission to attempt is not correctness, and scope compliance is not correctness certification.
 */
export type SenseiWorkspaceAdmissionV1 = {
  schema_version: "sensei.workspace.admission.v1";
  record_kind: "decision" | "verification";
  admission_id: string;
  decision_digest_sha256: Sha256Hex;
  policy_id: string;
  policy_version: string;
  decision: DecisionOutcome;
  requested_mode: "inspect" | "modify";
  binding: Binding;
  session_receipt: SessionReceipt;
  request_receipt: RequestReceipt;
  inspection_capability: DecisionOutcome;
  mutation_capability: DecisionOutcome;
  envelope: Envelope;
  reasons: Reason[];
  limitations: Limitation[];
  scope_only: boolean;
  correctness_certified: boolean;
  verification: Verification | null;
};
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "sha256Hex".
 */
export type Sha256Hex = string;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "decisionOutcome".
 */
export type DecisionOutcome = "admitted" | "admitted_with_conditions" | "waiting" | "refused" | "uncertifiable";

/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "binding".
 */
export interface Binding {
  repository_domain: string;
  revision: string | null;
  revision_status: "resolved" | "unavailable" | "not_git" | "not_requested";
  tree_digest_sha256: Sha256Hex | null;
  graph_digest_sha256: Sha256Hex | null;
  graph_digest_status: "resolved" | "unavailable" | "not_requested";
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "sessionReceipt".
 */
export interface SessionReceipt {
  session_id: string;
  latest_iteration: number;
  iteration_digest_sha256: Sha256Hex;
  semantic_state_digest_sha256: Sha256Hex;
  status: string;
  closure_verdict: string;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "requestReceipt".
 */
export interface RequestReceipt {
  digest_sha256: Sha256Hex;
  scope: ChangeScope;
  mode: "inspect" | "modify";
  task_class: string;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "changeScope".
 */
export interface ChangeScope {
  files: FileOperation[];
  symbols: string[];
  components: string[];
  claim_ids: string[];
  proposition_keys: string[];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "fileOperation".
 */
export interface FileOperation {
  path: string;
  operation: "read" | "modify";
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "envelope".
 */
export interface Envelope {
  read_paths: string[];
  modify_paths: string[];
  symbols: string[];
  components: string[];
  claim_ids: string[];
  proposition_keys: string[];
  unsupported_operations: string[];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "reason".
 */
export interface Reason {
  code: string;
  detail?: string;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "limitation".
 */
export interface Limitation {
  source: string;
  scope: string;
  reason: string;
  blocking: boolean;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "verification".
 */
export interface Verification {
  status: "scope_compliant" | "scope_violated" | "stale" | "uncertifiable";
  verification_digest_sha256: Sha256Hex;
  iteration_digest_sha256: Sha256Hex;
  patch_digest_sha256: Sha256Hex;
  changes: ChangeReceipt[];
  violations: Violation[];
  pending_condition_ids: string[];
  pending_test_ids: string[];
  pending_proof_obligation_ids: string[];
  pending_runtime_evidence_ids: string[];
  reasons: Reason[];
  limitations: Limitation[];
  scope_only: boolean;
  correctness_certified: boolean;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "changeReceipt".
 */
export interface ChangeReceipt {
  path: string;
  old_path?: string;
  change_type: "modified" | "added" | "deleted" | "renamed" | "copied" | "type_changed" | "unmerged" | "untracked";
  current_digest_sha256?: Sha256Hex;
  current_size?: number;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "violation".
 */
export interface Violation {
  code: string;
  path?: string;
  observed_operation?: string;
  expected_operation?: string;
  detail?: string;
}
