/* eslint-disable */
/**
 * This file was automatically generated from workspace-provider-capabilities-v1.schema.json (see contract/workspace/contracts.json for ownership —
 * this is a Dashboard/runner-owned contract, authored and versioned
 * locally, not pinned from globulario/sensei). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * This interface was referenced by `SenseiDashboardWorkspaceProviderCapabilitiesV1`'s JSON-Schema
 * via the `definition` "supportState".
 */
export type SupportState = "supported" | "unsupported" | "unknown" | "conditional";

/**
 * Explicit, bounded capability support for one agent provider (docs/architecture-workspace-v1.md §6, docs/claude-workspace-o1-brief.md §4.1). The common abstraction must not pretend every provider has identical authentication, MCP, streaming, resume, sandboxing, approval, or structured-output support -- a boolean is insufficient when support depends on runtime mode, hence the four-state enum.
 */
export interface SenseiDashboardWorkspaceProviderCapabilitiesV1 {
  schema_version: "sensei.dashboard.provider-capabilities.v1";
  provider_id: string;
  runtime: string;
  capabilities: {
    interactive_auth: SupportState;
    browser_auth: SupportState;
    headless_execution: SupportState;
    streaming_output: SupportState;
    session_resume: SupportState;
    mcp: SupportState;
    skills: SupportState;
    sandboxing: SupportState;
    command_approvals: SupportState;
    file_approvals: SupportState;
    structured_output: SupportState;
  };
  recorded_at: string;
}
