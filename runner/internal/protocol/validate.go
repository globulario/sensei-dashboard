package protocol

import (
	"fmt"
	"slices"
)

// Validate checks a decoded HandshakeRequest against the closed protocol
// rules DecodeStrict's field-shape checking cannot express: exact
// schema_version, non-empty identifiers, and a known client_kind. It
// returns a *Refusal ready to send back to the client, never a bare error.
func (r *HandshakeRequest) Validate() *Refusal {
	if r.MessageKind != MessageKindHandshakeRequest {
		return NewRefusal(RefusalInvalidRequest, "message_kind must be \"handshake_request\"", false)
	}
	if r.SchemaVersion != SchemaVersion {
		return NewRefusal(RefusalInvalidRequest, "schema_version must be \""+SchemaVersion+"\"", false)
	}
	if r.ClientID == "" {
		return NewRefusal(RefusalInvalidRequest, "client_id must not be empty", false)
	}
	switch r.ClientKind {
	case ClientKindDashboardNative, ClientKindTestClient:
	default:
		return NewRefusal(RefusalInvalidRequest, "client_kind must be \"dashboard_native\" or \"test_client\"", false)
	}
	if len(r.SupportedProtocolVersions) == 0 {
		return NewRefusal(RefusalInvalidRequest, "supported_protocol_versions must not be empty", false)
	}
	if !slices.Contains(r.SupportedProtocolVersions, CurrentProtocolVersion) {
		return NewRefusal(RefusalProtocolUnsupported, "none of the supplied supported_protocol_versions match the runner's current protocol version \""+CurrentProtocolVersion+"\"", false)
	}
	return nil
}

// ValidateEventPayloadType enforces the exact kind-to-payload pairing the
// schema declares (brief §4.5: "Each kind has a closed, kind-specific
// payload... Do not use an arbitrary string map"). The event log calls
// this before assigning a sequence, so an unknown kind or a
// kind/payload mismatch never consumes a sequence or enters the ring --
// it is authority-checked before it becomes authoritative, not merely
// json.Marshal-ed and trusted.
func ValidateEventPayloadType(kind EventKind, payload interface{}) error {
	switch kind {
	case EventKindRunnerStarted:
		if _, ok := payload.(RunnerStartedPayload); !ok {
			return fmt.Errorf("protocol: event kind %q requires a RunnerStartedPayload, got %T", kind, payload)
		}
		return nil
	case EventKindClientAuthenticated:
		p, ok := payload.(ClientAuthenticatedPayload)
		if !ok {
			return fmt.Errorf("protocol: event kind %q requires a ClientAuthenticatedPayload, got %T", kind, payload)
		}
		if p.ClientID == "" {
			return fmt.Errorf("protocol: event kind %q payload's client_id must not be empty", kind)
		}
		return nil
	case EventKindRunnerStopping:
		p, ok := payload.(RunnerStoppingPayload)
		if !ok {
			return fmt.Errorf("protocol: event kind %q requires a RunnerStoppingPayload, got %T", kind, payload)
		}
		if p.Reason == "" {
			return fmt.Errorf("protocol: event kind %q payload's reason must not be empty", kind)
		}
		return nil
	default:
		return fmt.Errorf("protocol: unknown event kind %q", kind)
	}
}
