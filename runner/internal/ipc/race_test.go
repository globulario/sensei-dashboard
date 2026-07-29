package ipc

// White-box (package ipc, not ipc_test) so this test can reach
// newHandler's unexported eventsSyncHook seam directly -- the only way to
// deterministically reproduce the exact lost-wakeup race window without
// relying on timing sleeps.

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/globulario/sensei-dashboard/runner/internal/auth"
	"github.com/globulario/sensei-dashboard/runner/internal/eventlog"
	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

// TestHandleEvents_NoLostWakeupBetweenRegisterAndSnapshot deterministically
// publishes an event exactly between the moment handleEvents captures the
// notify channel and the moment it takes its Since(after) snapshot -- the
// precise window in which the previous check-then-register code lost the
// wakeup entirely (the event was retained in the ring but nothing woke the
// reader, since its channel-close had already been consumed capturing a
// "new" channel that would only close on some later, unrelated publish).
func TestHandleEvents_NoLostWakeupBetweenRegisterAndSnapshot(t *testing.T) {
	dir := t.TempDir()
	tokenValue := "0123456789abcdef0123456789abcdef01234567"
	tokenPath := filepath.Join(dir, "token")
	if err := os.WriteFile(tokenPath, []byte(tokenValue), 0o600); err != nil {
		t.Fatal(err)
	}
	tok, err := auth.LoadTokenFile(tokenPath)
	if err != nil {
		t.Fatal(err)
	}

	events := eventlog.New("race-test-instance", eventlog.DefaultCapacity)

	var once sync.Once
	hook := func() {
		once.Do(func() {
			if _, err := events.Publish(protocol.EventKindRunnerStarted, protocol.RunnerStartedPayload{}); err != nil {
				t.Error(err)
			}
		})
	}

	var listenAddr string
	handler := newHandler(Deps{
		Token:         tok,
		Events:        events,
		InstanceID:    "race-test-instance",
		StartedAt:     "2026-01-01T00:00:00Z",
		PID:           1,
		ListenAddress: func() string { return listenAddr },
		State:         func() protocol.RunnerState { return protocol.RunnerStateReady },
	}, hook)

	srv := httptest.NewServer(handler)
	defer srv.Close()
	listenAddr = srv.Listener.Addr().String()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/v1/events?after=0", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+tokenValue)
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	lineCh := make(chan protocol.RunnerEvent, 1)
	go func() {
		scanner := bufio.NewScanner(resp.Body)
		if scanner.Scan() {
			var ev protocol.RunnerEvent
			if err := json.Unmarshal(scanner.Bytes(), &ev); err == nil {
				lineCh <- ev
			}
		}
	}()

	select {
	case ev := <-lineCh:
		if ev.Sequence != 1 {
			t.Fatalf("expected sequence 1, got %d", ev.Sequence)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the event published exactly between register and snapshot was never delivered -- lost wakeup")
	}
}
