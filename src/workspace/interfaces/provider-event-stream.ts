// A read-only, subscribable stream of normalized provider events for one
// run (docs/architecture-workspace-v1.md §13, docs/claude-workspace-o1-
// brief.md §7). Deliberately not an EventTarget/DOM type and not a Node
// EventEmitter -- this interface layer has no DOM or Node-process
// dependency (Law B). A future O2+ implementation may back this with
// either, or an async generator; none of those choices are made here.

import type { SenseiDashboardWorkspaceProviderEventV1 } from "../../../contract/generated/workspace-provider-event-v1.js";

export type Unsubscribe = () => void;

export interface ProviderEventStream {
  subscribe(listener: (event: SenseiDashboardWorkspaceProviderEventV1) => void): Unsubscribe;
}
