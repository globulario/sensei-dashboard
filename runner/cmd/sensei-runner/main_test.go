package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"
	"testing"
	"time"

	"github.com/globulario/sensei-dashboard/runner/internal/instance"
	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

const processTestToken = "012345678901234567890123456789ab"

// buildBinary compiles the real sensei-runner executable once per test
// run, proving the actual `go build ./cmd/sensei-runner` artifact -- not
// an in-process fake -- behaves correctly across the OS process boundary
// (brief §7: "Tests may spawn the compiled runner process to prove
// process-boundary behavior").
func buildBinary(t *testing.T) string {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("this process-boundary test uses SIGINT, which is Unix-specific")
	}
	dir := t.TempDir()
	bin := filepath.Join(dir, "sensei-runner")
	cmd := exec.Command("go", "build", "-o", bin, ".")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("building sensei-runner: %v\n%s", err, out)
	}
	return bin
}

func waitForDescriptor(t *testing.T, stateDir string, timeout time.Duration) *instance.Descriptor {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		d, err := instance.ReadDescriptor(stateDir)
		if err == nil {
			return d
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("descriptor did not appear within the timeout")
	return nil
}

// drainStderr prevents the spawned process from ever blocking on a full
// stderr pipe; it discards output rather than asserting on log format.
func drainStderr(r io.Reader) {
	go func() {
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
		}
	}()
}

func TestProcessBoundary_StartHandshakeStatusSignalShutdownRestart(t *testing.T) {
	bin := buildBinary(t)
	dir := t.TempDir()
	tokenPath := filepath.Join(dir, "token")
	if err := os.WriteFile(tokenPath, []byte(processTestToken), 0o600); err != nil {
		t.Fatal(err)
	}
	stateDir := filepath.Join(dir, "state")

	cmd := exec.Command(bin, "--auth-token-file", tokenPath, "--state-dir", stateDir, "--listen", "127.0.0.1:0")
	stderr, err := cmd.StderrPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	drainStderr(stderr)

	desc := waitForDescriptor(t, stateDir, 10*time.Second)
	if desc.PID != cmd.Process.Pid {
		t.Fatalf("descriptor pid %d does not match the spawned process pid %d", desc.PID, cmd.Process.Pid)
	}
	if desc.RunnerInstanceID == "" {
		t.Fatal("descriptor must carry a non-empty runner_instance_id")
	}

	client := &http.Client{}
	doReq := func(method, path string, body []byte) *http.Response {
		req, err := http.NewRequest(method, "http://"+desc.ListenAddress+path, bytes.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		req.Header.Set("Authorization", "Bearer "+processTestToken)
		resp, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp
	}

	handshakeReq := protocol.HandshakeRequest{
		MessageKind:               protocol.MessageKindHandshakeRequest,
		SchemaVersion:             protocol.SchemaVersion,
		ClientID:                  "process-boundary-test",
		ClientKind:                protocol.ClientKindTestClient,
		SupportedProtocolVersions: []string{protocol.CurrentProtocolVersion},
	}
	body, err := json.Marshal(handshakeReq)
	if err != nil {
		t.Fatal(err)
	}
	handshakeResp := doReq(http.MethodPost, "/v1/handshake", body)
	defer handshakeResp.Body.Close()
	if handshakeResp.StatusCode != http.StatusOK {
		t.Fatalf("expected a 200 handshake response from the real process, got %d", handshakeResp.StatusCode)
	}

	statusResp := doReq(http.MethodGet, "/v1/status", nil)
	defer statusResp.Body.Close()
	var status protocol.RunnerStatus
	if err := json.NewDecoder(statusResp.Body).Decode(&status); err != nil {
		t.Fatal(err)
	}
	if status.State != protocol.RunnerStateReady {
		t.Fatalf("expected ready, got %s", status.State)
	}

	// Unauthenticated request against the real process must be refused
	// the same way the in-process tests already prove.
	unauth, err := http.NewRequest(http.MethodGet, "http://"+desc.ListenAddress+"/v1/status", nil)
	if err != nil {
		t.Fatal(err)
	}
	unauthResp, err := client.Do(unauth)
	if err != nil {
		t.Fatal(err)
	}
	unauthResp.Body.Close()
	if unauthResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without credentials, got %d", unauthResp.StatusCode)
	}

	// Real SIGINT must trigger the exact graceful-shutdown sequence.
	if err := cmd.Process.Signal(syscall.SIGINT); err != nil {
		t.Fatal(err)
	}

	waitErr := make(chan error, 1)
	go func() { waitErr <- cmd.Wait() }()
	select {
	case err := <-waitErr:
		if err != nil {
			t.Fatalf("process did not exit cleanly after SIGINT: %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("process did not exit after SIGINT within the timeout")
	}

	if _, err := instance.ReadDescriptor(stateDir); !os.IsNotExist(err) {
		t.Fatalf("expected the descriptor to be removed after graceful shutdown, err=%v", err)
	}

	// Restart on the same state directory: must succeed and mint a new
	// runner_instance_id (brief §4.1, §9.4).
	cmd2 := exec.Command(bin, "--auth-token-file", tokenPath, "--state-dir", stateDir, "--listen", "127.0.0.1:0")
	stderr2, err := cmd2.StderrPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd2.Start(); err != nil {
		t.Fatal(err)
	}
	drainStderr(stderr2)
	t.Cleanup(func() {
		_ = cmd2.Process.Signal(syscall.SIGINT)
		_ = cmd2.Wait()
	})

	desc2 := waitForDescriptor(t, stateDir, 10*time.Second)
	if desc2.RunnerInstanceID == desc.RunnerInstanceID {
		t.Fatal("a restarted process must mint a new runner_instance_id, never reuse the previous one")
	}
}

func TestProcessBoundary_SecondInstanceOnSameStateDirFails(t *testing.T) {
	bin := buildBinary(t)
	dir := t.TempDir()
	tokenPath := filepath.Join(dir, "token")
	if err := os.WriteFile(tokenPath, []byte(processTestToken), 0o600); err != nil {
		t.Fatal(err)
	}
	stateDir := filepath.Join(dir, "state")

	first := exec.Command(bin, "--auth-token-file", tokenPath, "--state-dir", stateDir, "--listen", "127.0.0.1:0")
	stderr1, err := first.StderrPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := first.Start(); err != nil {
		t.Fatal(err)
	}
	drainStderr(stderr1)
	t.Cleanup(func() {
		_ = first.Process.Signal(syscall.SIGINT)
		_ = first.Wait()
	})
	waitForDescriptor(t, stateDir, 10*time.Second)

	second := exec.Command(bin, "--auth-token-file", tokenPath, "--state-dir", stateDir, "--listen", "127.0.0.1:0")
	out, err := second.CombinedOutput()
	if err == nil {
		t.Fatalf("expected the second process to exit with an error; output: %s", out)
	}
}
