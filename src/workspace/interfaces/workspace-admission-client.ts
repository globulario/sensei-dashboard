// The Dashboard-facing boundary for Sensei workspace identity/admission
// checks (docs/architecture-workspace-v1.md §7, docs/claude-workspace-o1-
// brief.md §7, §1; docs/claude-workspace-o1-sensei-pin-parity-brief.md §4.5).
// O1 defines this interface only -- it does not implement admission itself
// (that remains exclusively Sensei-core authority, Law A) and performs no
// network/filesystem/process call here (O2+). Every method's authoritative
// return value is the canonical Sensei-generated type, pinned byte-for-byte
// via contract/workspace/sensei-pin.json -- never a Dashboard-invented
// admission verdict, a collapsed decision/verification record, or an
// inferred correctness claim. Workspace identity is evidence, not
// admission; admission is permission to attempt, not correctness; scope
// compliance is not correctness certification
// (docs/architecture-workspace-contracts-v1.md).

import type { CancellationSignal, Result } from "./shared.js";
import type { SenseiWorkspaceIdentityV1 } from "../../../contract/generated/workspace-identity-v1.js";
import type { SenseiWorkspaceAdmissionV1 } from "../../../contract/generated/workspace-admission-v1.js";

/**
 * Mirrors the real MCP tool's "task" argument exactly: the key is either
 * entirely absent (not_requested) or present as a string, "" meaning the
 * active task (globulario/sensei cmd/awareness-mcp/workspace_tools.go
 * callWorkspaceStatus's taskProvided/task pair). A discriminated union
 * makes the two impossible combinations -- a task string paired with
 * "not requested", or "requested" with no task string -- unrepresentable,
 * rather than merely undocumented on two independent nullable/boolean
 * fields.
 */
export type WorkspaceTaskRequest = { readonly requested: false } | { readonly requested: true; readonly task: string };

/**
 * Mirrors sensei_workspace_status's real MCP tool arguments exactly
 * (callWorkspaceStatus).
 */
export interface WorkspaceStatusRequest {
  readonly repositoryPath: string;
  readonly task: WorkspaceTaskRequest;
}

/**
 * Mirrors sensei_workspace_admit_change's real MCP tool arguments exactly
 * (callWorkspaceAdmitChange). Every path/identifier field is a local
 * filesystem path or policy identifier this interface never resolves,
 * reads, or writes itself -- admission.Evaluate is the sole evaluator
 * (Law A). The real tool's "policy" argument is always a present string
 * key ("" meaning no policy) -- never an absent key -- so policyId is a
 * plain required string, not a nullable/optional field that would need an
 * unstated null-to-omitted-argument conversion at this boundary. Any
 * camelCase-to-wire-argument transport adaptation belongs to a future O2
 * implementation of this interface, not to this request type.
 */
export interface AdmitChangeRequest {
  readonly bundleDir: string;
  readonly requestPath: string;
  readonly graphNT: string;
  readonly repositoryPath: string;
  readonly policyId: string;
}

/**
 * Mirrors sensei_workspace_verify_admission's real MCP tool arguments
 * exactly (callWorkspaceVerifyAdmission). decisionPath references the
 * exact on-disk decision artifact verify_admission itself reads --
 * verification is bound to that specific decision, never re-derived.
 */
export interface VerifyAdmissionRequest {
  readonly decisionPath: string;
  readonly bundleDir: string;
  readonly repositoryPath: string;
}

export interface WorkspaceAdmissionClient {
  /**
   * sensei_workspace_status. Evidence, not permission --
   * composition_state is complete/partial/unavailable and never implies
   * admission or correctness.
   */
  workspaceStatus(
    request: WorkspaceStatusRequest,
    signal?: CancellationSignal
  ): Promise<Result<SenseiWorkspaceIdentityV1>>;

  /**
   * sensei_workspace_admit_change. Returns a decision record
   * (record_kind: "decision", verification: null) -- permission to
   * attempt, not correctness.
   */
  admitChange(request: AdmitChangeRequest, signal?: CancellationSignal): Promise<Result<SenseiWorkspaceAdmissionV1>>;

  /**
   * sensei_workspace_verify_admission. Returns a verification record
   * (record_kind: "verification", verification bound to the same
   * admission_id/decision_digest_sha256 as the decision it verifies) --
   * scope_compliant never implies correctness_certified.
   */
  verifyAdmission(
    request: VerifyAdmissionRequest,
    signal?: CancellationSignal
  ): Promise<Result<SenseiWorkspaceAdmissionV1>>;
}
