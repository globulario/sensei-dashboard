// The one application-facing data adapter interface (claude-stage-1-brief.md
// §3). Views only ever see these typed outcomes — never a raw fetch
// response, never arbitrary JSON, and never whether the data came from a
// static snapshot or (later) a live server.

import type { SenseiDashboardProjectionV1, FocusRecord } from "../../contract/generated/dashboard-projection-v1.js";

export type ProjectionOutcome =
  | { status: "loading" }
  | { status: "available"; projection: SenseiDashboardProjectionV1 }
  /** The document loaded and is schema-valid, and its own availability.state
   * honestly says the architectural view could not be fully or partially
   * constructed. This is data-level honesty, not a transport failure. */
  | { status: "unavailable"; projection: SenseiDashboardProjectionV1 }
  /** The document could not be parsed as JSON, or failed schema validation.
   * A useful diagnostic is required — never silently repaired or defaulted. */
  | { status: "invalid"; reason: string; errors: string[] }
  /** No projection could be retrieved at all: missing static snapshot, or
   * (for a future live adapter) the server was unreachable. */
  | { status: "disconnected"; reason: string };

export type FocusOutcome =
  | { status: "loading" }
  | { status: "found"; record: FocusRecord }
  | { status: "not_found"; elementId: string }
  /** The current projection itself is not available, so no focus record can
   * be resolved from it. */
  | { status: "unavailable"; reason: string };

export interface AdapterCapabilities {
  /** Whether the adapter can be asked to reload without a full page refresh. */
  liveRefresh: boolean;
  /** Whether the adapter can list/compare multiple revisions. */
  revisionCompare: boolean;
  mode: "static" | "live";
}

/**
 * The single boundary through which every view reaches projection data.
 * Implementations: StaticFixtureAdapter (this stage). A future live adapter
 * implements the same interface — no view code changes when it lands.
 */
export interface ProjectionAdapter {
  loadProjection(): Promise<ProjectionOutcome>;
  loadFocusRecord(elementId: string): Promise<FocusOutcome>;
  capabilities(): AdapterCapabilities;
}
