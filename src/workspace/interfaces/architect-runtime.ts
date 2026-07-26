// The primary AI architect runtime boundary (docs/architecture-workspace-v1.md
// §5, docs/claude-workspace-o1-brief.md §7). O1 defines this interface only
// -- no Codex app-server lifecycle, no authentication flow, no process
// management belongs here (Law B; that implementation is O2+ Phase O3).

import type { SenseiDashboardWorkspaceArchitectSessionV1 } from "../../../contract/generated/workspace-architect-session-v1.js";
import type { SenseiDashboardWorkspaceProviderCapabilitiesV1 } from "../../../contract/generated/workspace-provider-capabilities-v1.js";
import type { CancellationSignal, Result } from "./shared.js";

export interface StartSessionRequest {
  readonly repositoryDomain: string;
  readonly assuranceMode: "manual" | "governed";
}

export interface ArchitectRuntime {
  readonly providerId: string;
  capabilities(): Promise<Result<SenseiDashboardWorkspaceProviderCapabilitiesV1>>;
  startSession(request: StartSessionRequest, signal?: CancellationSignal): Promise<Result<SenseiDashboardWorkspaceArchitectSessionV1>>;
  resumeSession(sessionId: string, signal?: CancellationSignal): Promise<Result<SenseiDashboardWorkspaceArchitectSessionV1>>;
  endSession(sessionId: string): Promise<Result<void>>;
}
