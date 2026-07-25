// The Dashboard-facing boundary for Sensei workspace identity/admission
// checks (docs/architecture-workspace-v1.md §7, docs/claude-workspace-o1-
// brief.md §7, §1). O1 defines this interface only -- it does not
// implement admission itself (that remains exclusively Sensei-core
// authority, Law A) and performs no network/process call here (O2+).
// Every method returns the Dashboard-owned governing-snapshot/admission-
// reference shapes already defined in the architect-session/agent-run/
// execution-receipt schemas (mirrored locally here rather than imported,
// since those are $defs-nested types the generated modules don't export as
// standalone names), never a Dashboard-invented admission verdict.

import type { CancellationSignal, Result } from "./shared.js";

export interface GoverningSnapshot {
  readonly repositoryDomain: string;
  readonly revision: string | null;
  readonly revisionStatus: "resolved" | "unavailable" | "not_git" | "not_requested";
  readonly treeDigestSha256: string | null;
  readonly graphDigestSha256: string | null;
  readonly graphDigestStatus: "resolved" | "unavailable" | "unknown";
}

export interface AdmissionReference {
  readonly admissionId: string;
  readonly decision: "admitted" | "admitted_with_conditions" | "waiting" | "refused" | "uncertifiable";
  readonly decisionDigestSha256: string;
  readonly policyId: string | null;
}

export interface VerifyAdmissionRequest {
  readonly repositoryDomain: string;
  readonly taskClass: string;
  readonly mode: "read_only" | "mutation";
}

export interface WorkspaceAdmissionClient {
  workspaceIdentity(repositoryDomain: string, signal?: CancellationSignal): Promise<Result<GoverningSnapshot>>;
  verifyAdmission(request: VerifyAdmissionRequest, signal?: CancellationSignal): Promise<Result<AdmissionReference>>;
}
