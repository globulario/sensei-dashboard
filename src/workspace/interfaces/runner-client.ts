// The Dashboard-facing boundary of the future local `sensei-runner`
// (docs/architecture-workspace-v1.md §4.3, docs/claude-workspace-o1-
// brief.md §7). O1 defines this interface only -- no process/PTY lifecycle,
// no local IPC server, no worktree manager, no MCP process management
// belongs here (Law B; that implementation is O2+ Phase O2). The Dashboard
// consumes only this interface; it never imports a provider SDK or spawns
// a process itself.

import type { SenseiDashboardWorkspaceAgentRunV1 } from "../../../contract/generated/workspace-agent-run-v1.js";
import type { SenseiDashboardWorkspaceExecutionReceiptV1 } from "../../../contract/generated/workspace-execution-receipt-v1.js";
import type { AgentProvider } from "./agent-provider.js";
import type { ArchitectRuntime } from "./architect-runtime.js";
import type { ProviderEventStream } from "./provider-event-stream.js";
import type { CancellationSignal, Result } from "./shared.js";

export interface RunnerClient {
  listProviders(): Promise<Result<readonly AgentProvider[]>>;
  architectRuntime(providerId: string): Promise<Result<ArchitectRuntime>>;
  runEvents(runId: string): ProviderEventStream;
  currentRun(runId: string): Promise<Result<SenseiDashboardWorkspaceAgentRunV1>>;
  fetchReceipt(runId: string, signal?: CancellationSignal): Promise<Result<SenseiDashboardWorkspaceExecutionReceiptV1>>;
}
