package ipc_test

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/globulario/sensei-dashboard/runner/internal/auth"
	"github.com/globulario/sensei-dashboard/runner/internal/eventlog"
	"github.com/globulario/sensei-dashboard/runner/internal/ipc"
	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

const testTokenValue = "0123456789abcdef0123456789abcdef01234567"

type testServer struct {
	*httptest.Server
	events *eventlog.Log
}

func newTestServer(t *testing.T) *testServer {
	return newTestServerWithState(t, protocol.RunnerStateReady)
}

func newTestServerWithState(t *testing.T, state protocol.RunnerState) *testServer {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, "token")
	if err := os.WriteFile(p, []byte(testTokenValue), 0o600); err != nil {
		t.Fatal(err)
	}
	tok, err := auth.LoadTokenFile(p)
	if err != nil {
		t.Fatal(err)
	}

	events := eventlog.New("test-instance", eventlog.DefaultCapacity)
	var listenAddr string
	handler := ipc.NewHandler(ipc.Deps{
		Token:         tok,
		Events:        events,
		InstanceID:    "test-instance",
		StartedAt:     "2026-07-29T13:00:00Z",
		PID:           4242,
		ListenAddress: func() string { return listenAddr },
		State:         func() protocol.RunnerState { return state },
	})
	srv := httptest.NewServer(handler)
	listenAddr = srv.Listener.Addr().String()
	t.Cleanup(srv.Close)
	return &testServer{Server: srv, events: events}
}

func (s *testServer) do(t *testing.T, method, path, token string, body []byte) *http.Response {
	t.Helper()
	req, err := http.NewRequest(method, s.URL+path, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := s.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func decodeRefusal(t *testing.T, resp *http.Response) *protocol.Refusal {
	t.Helper()
	defer resp.Body.Close()
	var r protocol.Refusal
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		t.Fatalf("decoding refusal body: %v", err)
	}
	return &r
}

func handshakeBody() []byte {
	req := protocol.HandshakeRequest{
		MessageKind:               protocol.MessageKindHandshakeRequest,
		SchemaVersion:             protocol.SchemaVersion,
		ClientID:                  "test-client",
		ClientKind:                protocol.ClientKindTestClient,
		SupportedProtocolVersions: []string{protocol.CurrentProtocolVersion},
	}
	b, _ := json.Marshal(req)
	return b
}

func TestHandshake_Success(t *testing.T) {
	s := newTestServer(t)
	resp := s.do(t, http.MethodPost, "/v1/handshake", testTokenValue, handshakeBody())
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var got protocol.HandshakeResponse
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got.RunnerInstanceID != "test-instance" {
		t.Fatalf("unexpected instance id %q", got.RunnerInstanceID)
	}
	if len(got.Capabilities) != 2 {
		t.Fatalf("expected exactly 2 capabilities, got %v", got.Capabilities)
	}
}

func TestHandshake_EmitsClientAuthenticatedEvent(t *testing.T) {
	s := newTestServer(t)
	resp := s.do(t, http.MethodPost, "/v1/handshake", testTokenValue, handshakeBody())
	defer resp.Body.Close()

	var hresp protocol.HandshakeResponse
	if err := json.NewDecoder(resp.Body).Decode(&hresp); err != nil {
		t.Fatal(err)
	}
	if hresp.LatestEventSequence < 1 {
		t.Fatalf("expected latest_event_sequence to include the just-published client_authenticated event, got %d", hresp.LatestEventSequence)
	}

	events, gap := s.events.Since(0)
	if gap {
		t.Fatal("unexpected gap")
	}
	var found bool
	for _, ev := range events {
		if ev.Kind != protocol.EventKindClientAuthenticated {
			continue
		}
		var payload protocol.ClientAuthenticatedPayload
		if err := json.Unmarshal(ev.Payload, &payload); err != nil {
			t.Fatal(err)
		}
		if payload.ClientID == "test-client" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected a client_authenticated event bound to the handshake's client_id in the ring")
	}
}

func TestHandshake_RefusedWhileStopping(t *testing.T) {
	s := newTestServerWithState(t, protocol.RunnerStateStopping)
	resp := s.do(t, http.MethodPost, "/v1/handshake", testTokenValue, handshakeBody())
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", resp.StatusCode)
	}
	if refusal := decodeRefusal(t, resp); refusal.Code != protocol.RefusalStopping {
		t.Fatalf("expected %s, got %s", protocol.RefusalStopping, refusal.Code)
	}
}

func TestEvents_NewSubscriptionRefusedWhileStopping(t *testing.T) {
	s := newTestServerWithState(t, protocol.RunnerStateStopping)
	resp := s.do(t, http.MethodGet, "/v1/events", testTokenValue, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", resp.StatusCode)
	}
	if refusal := decodeRefusal(t, resp); refusal.Code != protocol.RefusalStopping {
		t.Fatalf("expected %s, got %s", protocol.RefusalStopping, refusal.Code)
	}
}

func TestStatus_StillServedWhileStopping(t *testing.T) {
	s := newTestServerWithState(t, protocol.RunnerStateStopping)
	resp := s.do(t, http.MethodGet, "/v1/status", testTokenValue, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status must remain observable while stopping, got %d", resp.StatusCode)
	}
	var status protocol.RunnerStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		t.Fatal(err)
	}
	if status.State != protocol.RunnerStateStopping {
		t.Fatalf("expected status to report stopping, got %s", status.State)
	}
}

func TestHandshake_UnsupportedProtocolVersion(t *testing.T) {
	s := newTestServer(t)
	req := protocol.HandshakeRequest{
		MessageKind:               protocol.MessageKindHandshakeRequest,
		SchemaVersion:             protocol.SchemaVersion,
		ClientID:                  "c",
		ClientKind:                protocol.ClientKindTestClient,
		SupportedProtocolVersions: []string{"99"},
	}
	b, _ := json.Marshal(req)
	resp := s.do(t, http.MethodPost, "/v1/handshake", testTokenValue, b)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	refusal := decodeRefusal(t, resp)
	if refusal.Code != protocol.RefusalProtocolUnsupported {
		t.Fatalf("expected %s, got %s", protocol.RefusalProtocolUnsupported, refusal.Code)
	}
}

func TestHandshake_UnknownFieldRejected(t *testing.T) {
	s := newTestServer(t)
	body := []byte(`{"message_kind":"handshake_request","schema_version":"sensei.runner.protocol.v1","client_id":"c","client_kind":"test_client","supported_protocol_versions":["1"],"unexpected":1}`)
	resp := s.do(t, http.MethodPost, "/v1/handshake", testTokenValue, body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	if refusal := decodeRefusal(t, resp); refusal.Code != protocol.RefusalInvalidRequest {
		t.Fatalf("expected %s, got %s", protocol.RefusalInvalidRequest, refusal.Code)
	}
}

func TestHandshake_TrailingDataRejected(t *testing.T) {
	s := newTestServer(t)
	body := append(handshakeBody(), []byte("{}")...)
	resp := s.do(t, http.MethodPost, "/v1/handshake", testTokenValue, body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandshake_OversizedBodyRejected(t *testing.T) {
	s := newTestServer(t)
	huge := bytes.Repeat([]byte("a"), protocol.MaxRequestBodyBytes+100)
	body := []byte(`{"message_kind":"handshake_request","schema_version":"sensei.runner.protocol.v1","client_id":"` + string(huge) + `","client_kind":"test_client","supported_protocol_versions":["1"]}`)
	resp := s.do(t, http.MethodPost, "/v1/handshake", testTokenValue, body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestAuth_MissingAndIncorrectCredentialsProduceIdenticalRefusal(t *testing.T) {
	s := newTestServer(t)

	missing := s.do(t, http.MethodGet, "/v1/status", "", nil)
	missingRefusal := decodeRefusal(t, missing)

	wrong := s.do(t, http.MethodGet, "/v1/status", "totally-wrong-credential-value", nil)
	wrongRefusal := decodeRefusal(t, wrong)

	if missing.StatusCode != http.StatusUnauthorized || wrong.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected both to be 401, got missing=%d wrong=%d", missing.StatusCode, wrong.StatusCode)
	}
	if *missingRefusal != *wrongRefusal {
		t.Fatalf("missing and incorrect credentials must produce the exact same refusal body: %+v vs %+v", missingRefusal, wrongRefusal)
	}
}

func TestAuth_CorrectCredentialSucceeds(t *testing.T) {
	s := newTestServer(t)
	resp := s.do(t, http.MethodGet, "/v1/status", testTokenValue, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestStatus_ReportsRunnerLocalFields(t *testing.T) {
	s := newTestServer(t)
	resp := s.do(t, http.MethodGet, "/v1/status", testTokenValue, nil)
	defer resp.Body.Close()
	var status protocol.RunnerStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		t.Fatal(err)
	}
	if status.State != protocol.RunnerStateReady {
		t.Fatalf("expected state ready, got %s", status.State)
	}
	if status.PID != 4242 {
		t.Fatalf("expected pid 4242, got %d", status.PID)
	}
	if status.RunnerInstanceID != "test-instance" {
		t.Fatalf("unexpected instance id %q", status.RunnerInstanceID)
	}
}

func TestOriginHeaderIsRefusedOnEveryEndpoint(t *testing.T) {
	s := newTestServer(t)
	for _, path := range []string{"/v1/handshake", "/v1/status", "/v1/events"} {
		t.Run(path, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, s.URL+path, nil)
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("Origin", "https://example.com")
			req.Header.Set("Authorization", "Bearer "+testTokenValue)
			resp, err := s.Client().Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusForbidden {
				t.Fatalf("expected 403 for an Origin-bearing request, got %d", resp.StatusCode)
			}
			if resp.Header.Get("Access-Control-Allow-Origin") != "" {
				t.Fatal("must never emit Access-Control-Allow-Origin")
			}
			refusal := decodeRefusal(t, resp)
			if refusal.Code != protocol.RefusalBrowserOriginForbidden {
				t.Fatalf("expected %s, got %s", protocol.RefusalBrowserOriginForbidden, refusal.Code)
			}
		})
	}
}

func TestOptionsIsRefused(t *testing.T) {
	s := newTestServer(t)
	resp := s.do(t, http.MethodOptions, "/v1/status", testTokenValue, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestNoResponseEverCarriesACORSHeader(t *testing.T) {
	s := newTestServer(t)
	responses := []*http.Response{
		s.do(t, http.MethodGet, "/v1/status", testTokenValue, nil),
		s.do(t, http.MethodGet, "/v1/status", "", nil),
		s.do(t, http.MethodGet, "/v1/does-not-exist", testTokenValue, nil),
	}
	for _, resp := range responses {
		defer resp.Body.Close()
		for _, h := range []string{"Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers"} {
			if resp.Header.Get(h) != "" {
				t.Fatalf("response must never carry %s", h)
			}
		}
	}
}

func TestUnknownRouteReturnsUnknownRoute(t *testing.T) {
	s := newTestServer(t)
	resp := s.do(t, http.MethodGet, "/v1/does-not-exist", testTokenValue, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
	if refusal := decodeRefusal(t, resp); refusal.Code != protocol.RefusalUnknownRoute {
		t.Fatalf("expected %s, got %s", protocol.RefusalUnknownRoute, refusal.Code)
	}
}

func TestWrongMethodOnKnownPathIsUnknownRoute(t *testing.T) {
	s := newTestServer(t)
	resp := s.do(t, http.MethodDelete, "/v1/status", testTokenValue, nil)
	defer resp.Body.Close()
	if refusal := decodeRefusal(t, resp); refusal.Code != protocol.RefusalUnknownRoute {
		t.Fatalf("expected %s, got %s", protocol.RefusalUnknownRoute, refusal.Code)
	}
}

func TestEvents_AfterFiltersToLaterEvents(t *testing.T) {
	s := newTestServer(t)
	for i := 0; i < 3; i++ {
		if _, err := s.events.Publish(protocol.EventKindClientAuthenticated, protocol.ClientAuthenticatedPayload{ClientID: "c"}); err != nil {
			t.Fatal(err)
		}
	}

	req, err := http.NewRequest(http.MethodGet, s.URL+"/v1/events?after=1", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+testTokenValue)
	resp, err := s.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/x-ndjson" {
		t.Fatalf("expected application/x-ndjson, got %q", ct)
	}

	scanner := bufio.NewScanner(resp.Body)
	var got []protocol.RunnerEvent
	for len(got) < 2 && scanner.Scan() {
		var ev protocol.RunnerEvent
		if err := json.Unmarshal(scanner.Bytes(), &ev); err != nil {
			t.Fatal(err)
		}
		got = append(got, ev)
	}
	if len(got) != 2 || got[0].Sequence != 2 || got[1].Sequence != 3 {
		t.Fatalf("expected sequences [2,3], got %+v", got)
	}
}

func TestEvents_GapReturns409(t *testing.T) {
	// Forces real ring eviction (capacity+5 events published) so a
	// request for a sequence older than the retained window is a genuine
	// gap, not just an empty-log edge case.
	s := newTestServer(t)
	for i := 0; i < eventlog.DefaultCapacity+5; i++ {
		if _, err := s.events.Publish(protocol.EventKindClientAuthenticated, protocol.ClientAuthenticatedPayload{ClientID: "c"}); err != nil {
			t.Fatal(err)
		}
	}
	resp := s.do(t, http.MethodGet, "/v1/events?after=0", testTokenValue, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", resp.StatusCode)
	}
	if refusal := decodeRefusal(t, resp); refusal.Code != protocol.RefusalEventGap {
		t.Fatalf("expected %s, got %s", protocol.RefusalEventGap, refusal.Code)
	}
}

func TestEvents_StreamsNewEventsWithoutPolling(t *testing.T) {
	s := newTestServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.URL+"/v1/events", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+testTokenValue)
	resp, err := s.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	lineCh := make(chan protocol.RunnerEvent, 4)
	go func() {
		for scanner.Scan() {
			var ev protocol.RunnerEvent
			if err := json.Unmarshal(scanner.Bytes(), &ev); err == nil {
				lineCh <- ev
			}
		}
	}()

	time.Sleep(50 * time.Millisecond) // let the stream establish and start blocking on NotifyChannel
	if _, err := s.events.Publish(protocol.EventKindRunnerStarted, protocol.RunnerStartedPayload{}); err != nil {
		t.Fatal(err)
	}

	select {
	case ev := <-lineCh:
		if ev.Sequence != 1 {
			t.Fatalf("expected sequence 1, got %d", ev.Sequence)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("did not receive the newly published event over the stream in time")
	}
}

func TestEvents_ClientDisconnectUnblocksHandler(t *testing.T) {
	s := newTestServer(t)

	ctx, cancel := context.WithCancel(context.Background())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.URL+"/v1/events", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+testTokenValue)
	resp, err := s.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}

	// Cancel the client's request context (simulating disconnect) and
	// confirm the read side unblocks promptly rather than hanging forever
	// -- evidence the server-side handler is not leaking a blocked
	// goroutine on this connection either.
	cancel()
	done := make(chan struct{})
	go func() {
		_, _ = bufio.NewReader(resp.Body).ReadString('\n')
		resp.Body.Close()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("client-side read did not unblock after context cancellation")
	}
}

func TestHandshake_RequiresJSONContentType(t *testing.T) {
	s := newTestServer(t)
	req, err := http.NewRequest(http.MethodPost, s.URL+"/v1/handshake", strings.NewReader(string(handshakeBody())))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+testTokenValue)
	req.Header.Set("Content-Type", "text/plain")
	resp, err := s.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}
