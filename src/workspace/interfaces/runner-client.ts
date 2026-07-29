// The Dashboard-facing boundary of the future local `sensei-runner`
// (docs/architecture-workspace-v1.md §4.3, docs/claude-workspace-o1-
// brief.md §7). O1 defines this interface only -- no process/PTY lifecycle,
// no local IPC server, no worktree manager, no MCP process management
// belongs here (Law B; that implementation is O2+ Phase O2). The Dashboard
// consumes only this interface; it never imports a provider SDK or spawns
// a process itself.
//
// O2.1 (runner/, docs/claude-workspace-o2-1-runner-ipc-foundation-brief.md)
// implemented the runner's actual authenticated transport and closed wire
// protocol (docs/runner-protocol-v1.schema.json, generated as
// contract/generated/runner-protocol-v1.ts) -- but deliberately did not
// wire it to this interface, and did not add a browser-side client for it
// at all (the webview is not an IPC client in O2.1). RunnerClient remains
// the future *semantic* client (providers, runs, receipts) a later phase
// implements on top of that transport; it is a different, higher layer
// than the transport-level handshake/status/events surface O2.1 defined,
// not a re-statement of it.

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
