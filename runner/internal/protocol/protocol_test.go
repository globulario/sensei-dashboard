package protocol

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
)

// fixturesDir locates docs/fixtures/runner/v1 relative to this test file,
// so the same fixtures the npm/ajv side validates against the schema
// (test/runner-protocol.test.mjs) are also the ones Go's real wire output
// is compared against here -- one set of fixtures, checked from both
// ends, per brief §9.1 ("fixture field names and enum values match Go
// wire output exactly").
func fixturesDir(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not determine test file path")
	}
	return filepath.Join(filepath.Dir(file), "..", "..", "..", "docs", "fixtures", "runner", "v1")
}

func assertMarshalsToFixture(t *testing.T, v interface{}, fixtureName string) {
	t.Helper()
	got, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshaling: %v", err)
	}
	want, err := os.ReadFile(filepath.Join(fixturesDir(t), fixtureName))
	if err != nil {
		t.Fatalf("reading fixture %s: %v", fixtureName, err)
	}

	var gotMap, wantMap map[string]interface{}
	if err := json.Unmarshal(got, &gotMap); err != nil {
		t.Fatalf("unmarshaling Go output: %v", err)
	}
	if err := json.Unmarshal(want, &wantMap); err != nil {
		t.Fatalf("unmarshaling fixture %s: %v", fixtureName, err)
	}
	if !reflect.DeepEqual(gotMap, wantMap) {
		t.Errorf("Go wire output does not match fixture %s\n  got:  %s\n  want: %s", fixtureName, got, want)
	}
}

func TestGoWireOutput_HandshakeRequest_MatchesFixture(t *testing.T) {
	req := HandshakeRequest{
		MessageKind:               MessageKindHandshakeRequest,
		SchemaVersion:             SchemaVersion,
		ClientID:                  "test-client-1",
		ClientKind:                ClientKindTestClient,
		SupportedProtocolVersions: []string{"1"},
	}
	assertMarshalsToFixture(t, req, "handshake-request.json")
}

func TestGoWireOutput_HandshakeResponse_MatchesFixture(t *testing.T) {
	resp := HandshakeResponse{
		MessageKind:             MessageKindHandshakeResponse,
		SchemaVersion:           SchemaVersion,
		SelectedProtocolVersion: CurrentProtocolVersion,
		RunnerInstanceID:        "runner-instance-0123456789abcdef0123456789abcdef",
		StartedAt:               "2026-07-29T13:00:00.000000000Z",
		Capabilities:            []Capability{CapabilityRunnerStatus, CapabilityRunnerEvents},
		LatestEventSequence:     1,
	}
	assertMarshalsToFixture(t, resp, "handshake-response.json")
}

func TestGoWireOutput_RunnerStatusReady_MatchesFixture(t *testing.T) {
	status := RunnerStatus{
		MessageKind:                MessageKindRunnerStatus,
		SchemaVersion:              SchemaVersion,
		RunnerInstanceID:           "runner-instance-0123456789abcdef0123456789abcdef",
		State:                      RunnerStateReady,
		StartedAt:                  "2026-07-29T13:00:00.000000000Z",
		PID:                        4242,
		ListenAddress:              "127.0.0.1:54321",
		LatestEventSequence:        3,
		RetainedEventStartSequence: 1,
	}
	assertMarshalsToFixture(t, status, "status-ready.json")
}

func TestGoWireOutput_RunnerStatusStopping_MatchesFixture(t *testing.T) {
	status := RunnerStatus{
		MessageKind:                MessageKindRunnerStatus,
		SchemaVersion:              SchemaVersion,
		RunnerInstanceID:           "runner-instance-0123456789abcdef0123456789abcdef",
		State:                      RunnerStateStopping,
		StartedAt:                  "2026-07-29T13:00:00.000000000Z",
		PID:                        4242,
		ListenAddress:              "127.0.0.1:54321",
		LatestEventSequence:        4,
		RetainedEventStartSequence: 1,
	}
	assertMarshalsToFixture(t, status, "status-stopping.json")
}

func mustEncodePayload(t *testing.T, payload interface{}) json.RawMessage {
	t.Helper()
	raw, err := EncodeEventPayload(payload)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestGoWireOutput_EventRunnerStarted_MatchesFixture(t *testing.T) {
	ev := RunnerEvent{
		MessageKind:      MessageKindRunnerEvent,
		SchemaVersion:    SchemaVersion,
		RunnerInstanceID: "runner-instance-0123456789abcdef0123456789abcdef",
		Sequence:         1,
		EmittedAt:        "2026-07-29T13:00:00.000000000Z",
		Kind:             EventKindRunnerStarted,
		Payload:          mustEncodePayload(t, RunnerStartedPayload{}),
	}
	assertMarshalsToFixture(t, ev, "event-runner-started.json")
}

func TestGoWireOutput_EventClientAuthenticated_MatchesFixture(t *testing.T) {
	ev := RunnerEvent{
		MessageKind:      MessageKindRunnerEvent,
		SchemaVersion:    SchemaVersion,
		RunnerInstanceID: "runner-instance-0123456789abcdef0123456789abcdef",
		Sequence:         2,
		EmittedAt:        "2026-07-29T13:00:01.000000000Z",
		Kind:             EventKindClientAuthenticated,
		Payload:          mustEncodePayload(t, ClientAuthenticatedPayload{ClientID: "test-client-1"}),
	}
	assertMarshalsToFixture(t, ev, "event-client-authenticated.json")
}

func TestGoWireOutput_EventRunnerStopping_MatchesFixture(t *testing.T) {
	ev := RunnerEvent{
		MessageKind:      MessageKindRunnerEvent,
		SchemaVersion:    SchemaVersion,
		RunnerInstanceID: "runner-instance-0123456789abcdef0123456789abcdef",
		Sequence:         4,
		EmittedAt:        "2026-07-29T13:05:00.000000000Z",
		Kind:             EventKindRunnerStopping,
		Payload:          mustEncodePayload(t, RunnerStoppingPayload{Reason: "runner is shutting down"}),
	}
	assertMarshalsToFixture(t, ev, "event-runner-stopping.json")
}

func TestGoWireOutput_RefusalUnauthorized_MatchesFixture(t *testing.T) {
	r := NewRefusal(RefusalUnauthorized, "missing or invalid bearer credentials", false)
	assertMarshalsToFixture(t, r, "refusal-unauthorized.json")
}

func TestGoWireOutput_RefusalEventGap_MatchesFixture(t *testing.T) {
	r := NewRefusal(RefusalEventGap, "requested sequence is older than the retained event window", false)
	assertMarshalsToFixture(t, r, "refusal-event-gap.json")
}

func TestDecodeStrict_RejectsUnknownFields(t *testing.T) {
	var req HandshakeRequest
	body := `{"message_kind":"handshake_request","schema_version":"sensei.runner.protocol.v1","client_id":"c","client_kind":"test_client","supported_protocol_versions":["1"],"unexpected":true}`
	if err := DecodeStrict(strings.NewReader(body), &req); err == nil {
		t.Fatal("expected an error for an unknown field")
	}
}

func TestDecodeStrict_RejectsTrailingData(t *testing.T) {
	var req HandshakeRequest
	body := `{"message_kind":"handshake_request","schema_version":"sensei.runner.protocol.v1","client_id":"c","client_kind":"test_client","supported_protocol_versions":["1"]}{}`
	if err := DecodeStrict(strings.NewReader(body), &req); err != ErrTrailingData {
		t.Fatalf("expected ErrTrailingData, got %v", err)
	}
}

func TestDecodeStrict_RejectsOversizedBody(t *testing.T) {
	var req HandshakeRequest
	huge := bytes.Repeat([]byte("a"), MaxRequestBodyBytes+1)
	body := `{"message_kind":"handshake_request","schema_version":"sensei.runner.protocol.v1","client_id":"` + string(huge) + `","client_kind":"test_client","supported_protocol_versions":["1"]}`
	if err := DecodeStrict(strings.NewReader(body), &req); err != ErrBodyTooLarge {
		t.Fatalf("expected ErrBodyTooLarge, got %v", err)
	}
}

func TestHandshakeRequest_Validate(t *testing.T) {
	base := HandshakeRequest{
		MessageKind:               MessageKindHandshakeRequest,
		SchemaVersion:             SchemaVersion,
		ClientID:                  "c",
		ClientKind:                ClientKindTestClient,
		SupportedProtocolVersions: []string{"1"},
	}
	if refusal := base.Validate(); refusal != nil {
		t.Fatalf("expected a valid base request, got refusal: %v", refusal)
	}

	cases := []struct {
		name string
		req  HandshakeRequest
		code RefusalCode
	}{
		{"wrong message_kind", func() HandshakeRequest { r := base; r.MessageKind = MessageKindRefusal; return r }(), RefusalInvalidRequest},
		{"wrong schema_version", func() HandshakeRequest { r := base; r.SchemaVersion = "sensei.runner.protocol.v0"; return r }(), RefusalInvalidRequest},
		{"empty client_id", func() HandshakeRequest { r := base; r.ClientID = ""; return r }(), RefusalInvalidRequest},
		{"unknown client_kind", func() HandshakeRequest { r := base; r.ClientKind = "browser"; return r }(), RefusalInvalidRequest},
		{"empty supported_protocol_versions", func() HandshakeRequest { r := base; r.SupportedProtocolVersions = nil; return r }(), RefusalInvalidRequest},
		{"unsupported protocol version", func() HandshakeRequest { r := base; r.SupportedProtocolVersions = []string{"99"}; return r }(), RefusalProtocolUnsupported},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			refusal := c.req.Validate()
			if refusal == nil {
				t.Fatal("expected a refusal")
			}
			if refusal.Code != c.code {
				t.Fatalf("expected code %s, got %s", c.code, refusal.Code)
			}
		})
	}
}

func TestValidateEventPayloadType(t *testing.T) {
	valid := []struct {
		kind    EventKind
		payload interface{}
	}{
		{EventKindRunnerStarted, RunnerStartedPayload{}},
		{EventKindClientAuthenticated, ClientAuthenticatedPayload{ClientID: "c"}},
		{EventKindRunnerStopping, RunnerStoppingPayload{Reason: "shutting down"}},
	}
	for _, c := range valid {
		if err := ValidateEventPayloadType(c.kind, c.payload); err != nil {
			t.Errorf("expected %s/%T to be valid, got: %v", c.kind, c.payload, err)
		}
	}

	invalid := []struct {
		name    string
		kind    EventKind
		payload interface{}
	}{
		{"wrong type for runner_started", EventKindRunnerStarted, ClientAuthenticatedPayload{ClientID: "c"}},
		{"wrong type for client_authenticated", EventKindClientAuthenticated, RunnerStartedPayload{}},
		{"empty client_id", EventKindClientAuthenticated, ClientAuthenticatedPayload{ClientID: ""}},
		{"wrong type for runner_stopping", EventKindRunnerStopping, RunnerStartedPayload{}},
		{"empty stopping reason", EventKindRunnerStopping, RunnerStoppingPayload{Reason: ""}},
		{"unknown kind", EventKind("bogus"), RunnerStartedPayload{}},
	}
	for _, c := range invalid {
		t.Run(c.name, func(t *testing.T) {
			if err := ValidateEventPayloadType(c.kind, c.payload); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
}

func TestDecodeEventPayload_RejectsUnknownFieldPerKind(t *testing.T) {
	_, err := DecodeEventPayload(EventKindRunnerStarted, json.RawMessage(`{"unexpected":true}`))
	if err == nil {
		t.Fatal("expected an error for an unknown field in a closed empty payload")
	}
}

func TestDecodeEventPayload_RoundTrips(t *testing.T) {
	raw := mustEncodePayload(t, ClientAuthenticatedPayload{ClientID: "abc"})
	decoded, err := DecodeEventPayload(EventKindClientAuthenticated, raw)
	if err != nil {
		t.Fatal(err)
	}
	payload, ok := decoded.(*ClientAuthenticatedPayload)
	if !ok {
		t.Fatalf("unexpected type %T", decoded)
	}
	if payload.ClientID != "abc" {
		t.Fatalf("unexpected client_id %q", payload.ClientID)
	}
}
