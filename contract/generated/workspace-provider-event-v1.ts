/* eslint-disable */
/**
 * This file was automatically generated from workspace-provider-event-v1.schema.json (see contract/workspace/contracts.json for ownership —
 * this is a Dashboard/runner-owned contract, authored and versioned
 * locally, not pinned from globulario/sensei). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * One normalized event from the runner-translated provider event stream (docs/architecture-workspace-v1.md §13, docs/claude-workspace-o1-brief.md §4.3). A strict discriminated union keyed on event_kind, each kind carrying its own small bounded payload -- deliberately not one giant event object with dozens of optional fields.
 */
export type SenseiDashboardWorkspaceProviderEventV1 = {
  schema_version: "sensei.dashboard.provider-event.v1";
  event_id: string;
  run_id: string;
  sequence: number;
  event_kind:
    | "Started"
    | "AuthenticationRequired"
    | "WorkspaceAdmissionStarted"
    | "WorkspaceAdmitted"
    | "PlanProduced"
    | "ToolRequested"
    | "ApprovalRequested"
    | "CommandStarted"
    | "CommandFinished"
    | "FileChanged"
    | "TestStarted"
    | "TestFinished"
    | "SenseiRefused"
    | "GitHubUpdated"
    | "WaitingForHuman"
    | "Completed"
    | "Failed"
    | "Cancelled";
  payload: unknown;
  recorded_at: string;
  native_event_ref: string | null;
  redaction_state: "none" | "partial" | "full";
} & (
  | {
      event_kind: "Started";
      payload: EmptyPayload;
    }
  | {
      event_kind: "AuthenticationRequired";
      payload: {
        provider_id: string;
      };
    }
  | {
      event_kind: "WorkspaceAdmissionStarted";
      payload: EmptyPayload;
    }
  | {
      event_kind: "WorkspaceAdmitted";
      payload: {
        admission_id: string;
      };
    }
  | {
      event_kind: "PlanProduced";
      payload: {
        summary: string;
      };
    }
  | {
      event_kind: "ToolRequested";
      payload: {
        tool_name: string;
      };
    }
  | {
      event_kind: "ApprovalRequested";
      payload: {
        approval_kind: "command" | "file";
        summary_id: string;
      };
    }
  | {
      event_kind: "CommandStarted";
      payload: {
        summary_id: string;
      };
    }
  | {
      event_kind: "CommandFinished";
      payload: {
        summary_id: string;
        outcome: "completed" | "failed" | "cancelled";
      };
    }
  | {
      event_kind: "FileChanged";
      payload: {
        path: string;
        change_kind: "added" | "modified" | "removed" | "renamed";
      };
    }
  | {
      event_kind: "TestStarted";
      payload: {
        name: string;
      };
    }
  | {
      event_kind: "TestFinished";
      payload: {
        name: string;
        outcome: "passed" | "failed" | "skipped" | "unknown";
      };
    }
  | {
      event_kind: "SenseiRefused";
      payload: {
        reason: Reason;
      };
    }
  | {
      event_kind: "GitHubUpdated";
      payload: {
        action_ref: string;
      };
    }
  | {
      event_kind: "WaitingForHuman";
      payload: {
        reason: string | null;
      };
    }
  | {
      event_kind: "Completed";
      payload: EmptyPayload;
    }
  | {
      event_kind: "Failed";
      payload: {
        reason: Reason;
      };
    }
  | {
      event_kind: "Cancelled";
      payload: {
        reason: Reason;
      };
    }
);

/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "emptyPayload".
 */
export interface EmptyPayload {}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "reason".
 */
export interface Reason {
  code: string;
  detail: string;
}
