package protocol

import "slices"

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
