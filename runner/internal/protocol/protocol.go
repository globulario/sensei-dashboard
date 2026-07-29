// Package protocol defines the closed, versioned wire contract for
// sensei-runner's authenticated local IPC (docs/runner-protocol-v1.schema.json,
// schema_version "sensei.runner.protocol.v1"). Every exported type here has a
// field-for-field, name-for-name correspondence with that JSON Schema --
// struct tags are the wire truth this package must never let drift from the
// committed schema and fixtures (docs/fixtures/runner/v1/).
//
// This package owns wire shapes and strict (de)serialization only. It knows
// nothing about HTTP routing, authentication, locking, or process lifecycle.
package protocol

import "encoding/json"

// SchemaVersion is the const every message on the wire must carry.
const SchemaVersion = "sensei.runner.protocol.v1"

// CurrentProtocolVersion is the only protocol version sensei-runner O2.1
// speaks. A handshake request that does not list it in
// supported_protocol_versions is refused with RefusalProtocolUnsupported.
const CurrentProtocolVersion = "1"

// MessageKind discriminates the five closed message families this protocol
// defines. Every wire message carries exactly one of these as message_kind.
type MessageKind string

const (
	MessageKindHandshakeRequest  MessageKind = "handshake_request"
	MessageKindHandshakeResponse MessageKind = "handshake_response"
	MessageKindRunnerStatus      MessageKind = "runner_status"
	MessageKindRunnerEvent       MessageKind = "runner_event"
	MessageKindRefusal           MessageKind = "refusal"
)

// ClientKind enumerates the only client kinds a handshake may declare.
// Browser/web clients are deliberately not a member of this set (docs/
// claude-workspace-o2-1-runner-ipc-foundation-brief.md §4.2, §E) -- the
// webview is not an IPC client in O2.1.
type ClientKind string

const (
	ClientKindDashboardNative ClientKind = "dashboard_native"
	ClientKindTestClient      ClientKind = "test_client"
)

// RunnerState is the runner-local process state reported by /v1/status. It
// reports process truth only -- never provider, repository, Sensei, or job
// readiness (brief §4.4).
type RunnerState string

const (
	RunnerStateReady    RunnerState = "ready"
	RunnerStateStopping RunnerState = "stopping"
)

// Capability lists the exactly-bounded set of capabilities O2.1 may
// advertise in a handshake response (brief §4.3). Extending this list is an
// O2.2+ decision, not a wire-compatible addition to make casually.
type Capability string

const (
	CapabilityRunnerStatus Capability = "runner.status"
	CapabilityRunnerEvents Capability = "runner.events"
)

// EventKind enumerates the exactly three event kinds O2.1 may emit (brief
// §4.5). Each has its own closed, kind-specific payload type below -- never
// an arbitrary string map.
type EventKind string

const (
	EventKindRunnerStarted       EventKind = "runner_started"
	EventKindClientAuthenticated EventKind = "client_authenticated"
	EventKindRunnerStopping      EventKind = "runner_stopping"
)

// RefusalCode enumerates the closed, stable refusal codes this protocol
// defines (brief §4.6). New codes are a protocol change, not a value an
// individual handler may invent.
type RefusalCode string

const (
	RefusalUnauthorized           RefusalCode = "runner.unauthorized"
	RefusalBrowserOriginForbidden RefusalCode = "runner.browser_origin_forbidden"
	RefusalProtocolUnsupported    RefusalCode = "runner.protocol_unsupported"
	RefusalInvalidRequest         RefusalCode = "runner.invalid_request"
	RefusalUnknownRoute           RefusalCode = "runner.unknown_route"
	RefusalEventGap               RefusalCode = "runner.event_gap"
	RefusalStopping               RefusalCode = "runner.stopping"
)

// HandshakeRequest is the POST /v1/handshake request body.
type HandshakeRequest struct {
	MessageKind               MessageKind `json:"message_kind"`
	SchemaVersion             string      `json:"schema_version"`
	ClientID                  string      `json:"client_id"`
	ClientKind                ClientKind  `json:"client_kind"`
	SupportedProtocolVersions []string    `json:"supported_protocol_versions"`
}

// HandshakeResponse is the POST /v1/handshake success response body.
type HandshakeResponse struct {
	MessageKind             MessageKind  `json:"message_kind"`
	SchemaVersion           string       `json:"schema_version"`
	SelectedProtocolVersion string       `json:"selected_protocol_version"`
	RunnerInstanceID        string       `json:"runner_instance_id"`
	StartedAt               string       `json:"started_at"`
	Capabilities            []Capability `json:"capabilities"`
	LatestEventSequence     uint64       `json:"latest_event_sequence"`
}

// RunnerStatus is the GET /v1/status response body.
type RunnerStatus struct {
	MessageKind                MessageKind `json:"message_kind"`
	SchemaVersion              string      `json:"schema_version"`
	RunnerInstanceID           string      `json:"runner_instance_id"`
	State                      RunnerState `json:"state"`
	StartedAt                  string      `json:"started_at"`
	PID                        int         `json:"pid"`
	ListenAddress              string      `json:"listen_address"`
	LatestEventSequence        uint64      `json:"latest_event_sequence"`
	RetainedEventStartSequence uint64      `json:"retained_event_start_sequence"`
}

// RunnerStartedPayload is the closed, empty payload for "runner_started".
type RunnerStartedPayload struct{}

// ClientAuthenticatedPayload is the closed payload for "client_authenticated".
type ClientAuthenticatedPayload struct {
	ClientID string `json:"client_id"`
}

// RunnerStoppingPayload is the closed payload for "runner_stopping".
type RunnerStoppingPayload struct {
	Reason string `json:"reason"`
}

// RunnerEvent is one line of the GET /v1/events NDJSON stream. Payload is
// kept as json.RawMessage at this layer so encoding/decoding can be strict
// per-kind (see DecodeEventPayload) without a second, looser struct shape.
type RunnerEvent struct {
	MessageKind      MessageKind     `json:"message_kind"`
	SchemaVersion    string          `json:"schema_version"`
	RunnerInstanceID string          `json:"runner_instance_id"`
	Sequence         uint64          `json:"sequence"`
	EmittedAt        string          `json:"emitted_at"`
	Kind             EventKind       `json:"kind"`
	Payload          json.RawMessage `json:"payload"`
}

// Refusal is the closed typed-refusal shape returned for every expected
// client or protocol failure (brief §4.6). It implements error so handler
// code can `return nil, &Refusal{...}` naturally.
type Refusal struct {
	MessageKind   MessageKind `json:"message_kind"`
	SchemaVersion string      `json:"schema_version"`
	Code          RefusalCode `json:"code"`
	Detail        string      `json:"detail"`
	Retryable     bool        `json:"retryable"`
}

func (r *Refusal) Error() string {
	return string(r.Code) + ": " + r.Detail
}

// NewRefusal builds a closed Refusal with schema_version/message_kind
// already filled in, so call sites never have to repeat that boilerplate
// (and never have a chance to typo the constants).
func NewRefusal(code RefusalCode, detail string, retryable bool) *Refusal {
	return &Refusal{
		MessageKind:   MessageKindRefusal,
		SchemaVersion: SchemaVersion,
		Code:          code,
		Detail:        detail,
		Retryable:     retryable,
	}
}
