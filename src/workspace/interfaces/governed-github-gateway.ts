// The Dashboard-facing boundary for governed GitHub actions
// (docs/architecture-workspace-v1.md §10, docs/claude-workspace-o1-
// brief.md §6-7). O1 defines this interface only -- no GitHub API write
// implementation, no unrestricted token placed in model context (Law B;
// that implementation is O2+ Phase O4).

import type { SenseiDashboardWorkspaceGitHubActionV1 } from "../../../contract/generated/workspace-github-action-v1.js";
import type { CancellationSignal, Result } from "./shared.js";

export interface GovernedGitHubGateway {
  submit(
    request: Extract<SenseiDashboardWorkspaceGitHubActionV1, { kind: "request" }>,
    signal?: CancellationSignal
  ): Promise<Result<Extract<SenseiDashboardWorkspaceGitHubActionV1, { kind: "result" }>>>;
}
