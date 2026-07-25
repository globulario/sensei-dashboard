/* eslint-disable */
/**
 * This file was automatically generated from workspace-provider-status-v1.schema.json (see contract/workspace/contracts.json for ownership —
 * this is a Dashboard/runner-owned contract, authored and versioned
 * locally, not pinned from globulario/sensei). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * Observed readiness for one agent provider (docs/architecture-workspace-v1.md §14, docs/claude-workspace-o1-brief.md §4.2). Configured MCP is not verified MCP; provider readiness is not workspace admission -- mcp_configured and mcp_verified are kept as two independent booleans specifically so the second can never be silently inferred from the first.
 */
export interface SenseiDashboardWorkspaceProviderStatusV1 {
  schema_version: "sensei.dashboard.provider-status.v1";
  provider_id: string;
  status:
    | "absent"
    | "installed"
    | "unauthenticated"
    | "authenticating"
    | "ready"
    | "expired"
    | "blocked"
    | "unavailable"
    | "unknown";
  mcp_configured: boolean;
  mcp_verified: boolean;
  detail: string | null;
  observed_at: string;
}
