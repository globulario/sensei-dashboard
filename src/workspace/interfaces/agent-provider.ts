// A bounded worker or architect/reviewer agent provider (Claude Code, Codex,
// Antigravity) (docs/architecture-workspace-v1.md §6, docs/claude-workspace-
// o1-brief.md §7). O1 defines this interface only -- no provider-specific
// SDK import, no process execution, no authentication implementation
// belongs here (Law B; that implementation is O2+ Phase O5).

import type { SenseiDashboardWorkspaceAgentRunV1 } from "../../../contract/generated/workspace-agent-run-v1.js";
import type { SenseiDashboardWorkspaceProviderCapabilitiesV1 } from "../../../contract/generated/workspace-provider-capabilities-v1.js";
import type { SenseiDashboardWorkspaceProviderStatusV1 } from "../../../contract/generated/workspace-provider-status-v1.js";
import type { CancellationSignal, Result } from "./shared.js";

export interface StartRunRequest {
  readonly jobId: string;
  readonly repositoryDomain: string;
  readonly role: "implementer" | "architect" | "reviewer";
  readonly assuranceMode: "manual" | "governed";
  /** Capability tokens this run needs -- checked against the provider's own
   * capabilities() result by the caller before starting, not by this
   * interface (explicit capability negotiation stays at the call site). */
  readonly requiredCapabilities: readonly string[];
}

export interface AgentProvider {
  readonly providerId: string;
  status(): Promise<Result<SenseiDashboardWorkspaceProviderStatusV1>>;
  capabilities(): Promise<Result<SenseiDashboardWorkspaceProviderCapabilitiesV1>>;
  startRun(request: StartRunRequest, signal?: CancellationSignal): Promise<Result<SenseiDashboardWorkspaceAgentRunV1>>;
  cancelRun(runId: string, reason: string): Promise<Result<void>>;
}
