/* eslint-disable */
/**
 * This file was automatically generated from runner-protocol-v1.schema.json (see contract/workspace/contracts.json for ownership —
 * this is a Dashboard/runner-owned contract, authored and versioned
 * locally, not pinned from globulario/sensei). Do not edit
 * this file directly — run `npm run generate:types` to regenerate it, and
 * do not hand-add fields, loosen required-ness, or otherwise diverge from
 * what the schema declares.
 */

/**
 * The closed, versioned local IPC wire protocol for sensei-runner's authenticated loopback HTTP surface (docs/claude-workspace-o2-1-runner-ipc-foundation-brief.md). Owned by the runner (contract/runner/contracts.json), not by Sensei core and not pinned from globulario/sensei. Five closed, mutually exclusive message shapes selected by message_kind -- not one flat object with optional fields from every shape.
 */
export type SenseiRunnerProtocolV1 = HandshakeRequest | HandshakeResponse | RunnerStatus | RunnerEvent | Refusal;
export type RunnerEvent = {
  message_kind: "runner_event";
  schema_version: "sensei.runner.protocol.v1";
  runner_instance_id: string;
  sequence: number;
  emitted_at: string;
  kind: "runner_started" | "client_authenticated" | "runner_stopping";
  payload: unknown;
} & RunnerEvent1;
export type RunnerEvent1 =
  | {
      kind: "runner_started";
      payload: EmptyPayload;
    }
  | {
      kind: "client_authenticated";
      payload: ClientAuthenticatedPayload;
    }
  | {
      kind: "runner_stopping";
      payload: RunnerStoppingPayload;
    };

export interface HandshakeRequest {
  message_kind: "handshake_request";
  schema_version: "sensei.runner.protocol.v1";
  client_id: string;
  client_kind: "dashboard_native" | "test_client";
  /**
   * @minItems 1
   */
  supported_protocol_versions: [string, ...string[]];
}
export interface HandshakeResponse {
  message_kind: "handshake_response";
  schema_version: "sensei.runner.protocol.v1";
  selected_protocol_version: string;
  runner_instance_id: string;
  started_at: string;
  capabilities: ("runner.status" | "runner.events")[];
  latest_event_sequence: number;
}
export interface RunnerStatus {
  message_kind: "runner_status";
  schema_version: "sensei.runner.protocol.v1";
  runner_instance_id: string;
  state: "ready" | "stopping";
  started_at: string;
  pid: number;
  listen_address: string;
  latest_event_sequence: number;
  retained_event_start_sequence: number;
}
export type EmptyPayload = Record<string, never>;
export interface ClientAuthenticatedPayload {
  client_id: string;
}
export interface RunnerStoppingPayload {
  reason: string;
}
export interface Refusal {
  message_kind: "refusal";
  schema_version: "sensei.runner.protocol.v1";
  code:
    | "runner.unauthorized"
    | "runner.browser_origin_forbidden"
    | "runner.protocol_unsupported"
    | "runner.invalid_request"
    | "runner.unknown_route"
    | "runner.event_gap"
    | "runner.stopping";
  detail: string;
  retryable: boolean;
}
