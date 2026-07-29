package app_test

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/globulario/sensei-dashboard/runner/internal/app"
	"github.com/globulario/sensei-dashboard/runner/internal/config"
	"github.com/globulario/sensei-dashboard/runner/internal/instance"
	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

const testToken = "01234567890123456789012345678901"

func writeTestToken(t *testing.T, dir string) string {
	t.Helper()
	p := filepath.Join(dir, "token")
	if err := os.WriteFile(p, []byte(testToken), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func startRunner(t *testing.T, ctx context.Context, cfg *config.Config) (listenAddr, instanceID string, runErr <-chan error) {
	t.Helper()
	ready := make(chan struct{})
	errCh := make(chan error, 1)
	go func() {
		errCh <- app.Run(ctx, app.Options{
			Config: cfg,
			OnReady: func(addr, id string) {
				listenAddr = addr
				instanceID = id
				close(ready)
			},
		})
	}()
	select {
	case <-ready:
	case err := <-errCh:
		t.Fatalf("app.Run failed before becoming ready: %v", err)
	case <-time.After(5 * time.Second):
		t.Fatal("app did not become ready in time")
	}
	return listenAddr, instanceID, errCh
}

func TestRun_FullLifecycleHandshakeStatusAndGracefulShutdown(t *testing.T) {
	dir := t.TempDir()
	tokenPath := writeTestToken(t, dir)
	stateDir := filepath.Join(dir, "state")
	cfg := &config.Config{AuthTokenFile: tokenPath, StateDir: stateDir, Listen: "127.0.0.1:0"}

	ctx, cancel := context.WithCancel(context.Background())
	listenAddr, instanceID, runErr := startRunner(t, ctx, cfg)

	desc, err := instance.ReadDescriptor(stateDir)
	if err != nil {
		t.Fatalf("descriptor must exist once the runner is ready: %v", err)
	}
	if desc.RunnerInstanceID != instanceID || desc.ListenAddress != listenAddr {
		t.Fatalf("descriptor does not match the ready runner: %+v", desc)
	}

	client := &http.Client{}
	get := func(path string) *http.Response {
		req, err := http.NewRequest(http.MethodGet, "http://"+listenAddr+path, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+testToken)
		resp, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp
	}

	statusResp := get("/v1/status")
	defer statusResp.Body.Close()
	if statusResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 from /v1/status, got %d", statusResp.StatusCode)
	}
	var status protocol.RunnerStatus
	if err := json.NewDecoder(statusResp.Body).Decode(&status); err != nil {
		t.Fatal(err)
	}
	if status.State != protocol.RunnerStateReady {
		t.Fatalf("expected ready state, got %s", status.State)
	}

	// Open a live event stream, then trigger graceful shutdown, and prove
	// runner_stopping is observed on the stream before it closes (brief
	// §F steps 2 and 5).
	eventsReq, err := http.NewRequest(http.MethodGet, "http://"+listenAddr+"/v1/events", nil)
	if err != nil {
		t.Fatal(err)
	}
	eventsReq.Header.Set("Authorization", "Bearer "+testToken)
	eventsResp, err := client.Do(eventsReq)
	if err != nil {
		t.Fatal(err)
	}
	defer eventsResp.Body.Close()

	cancel() // simulates SIGINT/SIGTERM being delivered to the process

	scanner := bufio.NewScanner(eventsResp.Body)
	sawStopping := false
	for scanner.Scan() {
		var ev protocol.RunnerEvent
		if err := json.Unmarshal(scanner.Bytes(), &ev); err != nil {
			continue
		}
		if ev.Kind == protocol.EventKindRunnerStopping {
			sawStopping = true
		}
	}
	if !sawStopping {
		t.Fatal("expected to observe a runner_stopping event on the open stream before it closed")
	}

	select {
	case err := <-runErr:
		if err != nil {
			t.Fatalf("app.Run returned an error on graceful shutdown: %v", err)
		}
	case <-time.After(app.GracefulDrainInterval + 5*time.Second):
		t.Fatal("app.Run did not return after shutdown")
	}

	if _, err := instance.ReadDescriptor(stateDir); !os.IsNotExist(err) {
		t.Fatalf("expected the descriptor to be removed after clean shutdown, err=%v", err)
	}
}

func TestRun_RestartMintsANewInstanceID(t *testing.T) {
	dir := t.TempDir()
	tokenPath := writeTestToken(t, dir)
	stateDir := filepath.Join(dir, "state")
	cfg := &config.Config{AuthTokenFile: tokenPath, StateDir: stateDir, Listen: "127.0.0.1:0"}

	ctx1, cancel1 := context.WithCancel(context.Background())
	_, instanceID1, runErr1 := startRunner(t, ctx1, cfg)
	cancel1()
	select {
	case <-runErr1:
	case <-time.After(10 * time.Second):
		t.Fatal("first instance did not shut down in time")
	}

	ctx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()
	_, instanceID2, _ := startRunner(t, ctx2, cfg)

	if instanceID1 == instanceID2 {
		t.Fatal("a restarted runner must mint a new runner_instance_id")
	}
}

func TestRun_SecondInstanceOnSameStateDirFails(t *testing.T) {
	dir := t.TempDir()
	tokenPath := writeTestToken(t, dir)
	stateDir := filepath.Join(dir, "state")
	cfg := &config.Config{AuthTokenFile: tokenPath, StateDir: stateDir, Listen: "127.0.0.1:0"}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	startRunner(t, ctx, cfg)

	// A second Run() on the same state directory must fail promptly
	// rather than publishing a competing descriptor or listener.
	err := app.Run(context.Background(), app.Options{Config: cfg})
	if err == nil {
		t.Fatal("expected the second instance to fail to acquire the state directory")
	}
}

func TestRun_RefusesAnUnreadableTokenBeforeBindingAnything(t *testing.T) {
	dir := t.TempDir()
	stateDir := filepath.Join(dir, "state")
	cfg := &config.Config{AuthTokenFile: filepath.Join(dir, "does-not-exist"), StateDir: stateDir, Listen: "127.0.0.1:0"}

	if err := app.Run(context.Background(), app.Options{Config: cfg}); err == nil {
		t.Fatal("expected an error for a missing token file")
	}
	if _, err := instance.ReadDescriptor(stateDir); !os.IsNotExist(err) {
		t.Fatal("no descriptor should ever be published when startup fails before binding")
	}
}

func TestRun_RejectsNonLoopbackListenAtValidation(t *testing.T) {
	dir := t.TempDir()
	tokenPath := writeTestToken(t, dir)
	cfg := &config.Config{AuthTokenFile: tokenPath, StateDir: filepath.Join(dir, "state"), Listen: "0.0.0.0:0"}
	if err := app.Run(context.Background(), app.Options{Config: cfg}); err == nil {
		t.Fatal("expected a non-loopback listen address to be refused")
	}
}
