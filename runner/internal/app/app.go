// Package app composes config, auth, instance, eventlog, and ipc into the
// runner's full foreground lifecycle (docs/claude-workspace-o2-1-runner-
// ipc-foundation-brief.md §F). It is the only package that decides
// startup and shutdown ORDER -- every other package exposes independent
// operations, never a sequence.
package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"sync/atomic"
	"time"

	"github.com/globulario/sensei-dashboard/runner/internal/auth"
	"github.com/globulario/sensei-dashboard/runner/internal/config"
	"github.com/globulario/sensei-dashboard/runner/internal/eventlog"
	"github.com/globulario/sensei-dashboard/runner/internal/instance"
	"github.com/globulario/sensei-dashboard/runner/internal/ipc"
	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

// GracefulDrainInterval bounds how long Run waits for in-flight requests
// (including open event streams) to finish after entering "stopping"
// before forcing them closed (brief §F step 4: "a short bounded
// graceful-drain interval").
const GracefulDrainInterval = 3 * time.Second

// streamFlushGrace is a short pause between publishing the final
// runner_stopping event and forcibly cancelling still-open connections,
// so an already-open event stream has a real chance to flush that event
// before being cut off. http.Server.Shutdown alone does not force-close
// long-lived handlers (e.g. an open NDJSON stream) when its own deadline
// expires -- it only waits -- so Run additionally cancels a shared
// BaseContext to make in-flight streaming handlers observe cancellation
// promptly (see the shutdown sequence below).
const streamFlushGrace = 200 * time.Millisecond

// Options configures one Run call. OnReady, when set, is invoked exactly
// once, synchronously, right after the descriptor has been published and
// the runner_started event emitted -- i.e. the earliest point at which the
// runner is a fully authoritative instance. Tests use it to learn the
// ephemeral listen address without racing Run's blocking serve loop.
type Options struct {
	Config  *config.Config
	OnReady func(listenAddress string, instanceID string)
}

type stateBox struct{ v atomic.Value }

func (s *stateBox) store(v protocol.RunnerState) { s.v.Store(v) }
func (s *stateBox) load() protocol.RunnerState {
	v, _ := s.v.Load().(protocol.RunnerState)
	if v == "" {
		return protocol.RunnerStateReady
	}
	return v
}

// Run executes one full foreground runner lifecycle: load token, acquire
// the single-instance lock, bind the loopback listener, publish the
// descriptor, serve until ctx is cancelled (the caller wires SIGINT/
// SIGTERM into ctx's cancellation -- see cmd/sensei-runner/main.go), then
// run the exact graceful-shutdown sequence brief §F requires. It returns
// nil on a clean shutdown.
func Run(ctx context.Context, opts Options) error {
	cfg := opts.Config
	if err := cfg.Validate(); err != nil {
		return err
	}

	token, err := auth.LoadTokenFile(cfg.AuthTokenFile)
	if err != nil {
		return fmt.Errorf("app: loading auth token: %w", err)
	}

	lock, err := instance.AcquireLock(cfg.StateDir)
	if err != nil {
		return fmt.Errorf("app: acquiring instance lock: %w", err)
	}

	instanceID, err := instance.NewInstanceID()
	if err != nil {
		_ = lock.Release()
		return fmt.Errorf("app: generating instance id: %w", err)
	}

	listener, err := net.Listen("tcp", cfg.Listen)
	if err != nil {
		_ = lock.Release()
		return fmt.Errorf("app: binding listener: %w", err)
	}
	listenAddr := listener.Addr().String()

	startedAt := time.Now().UTC().Format(time.RFC3339Nano)
	desc := instance.Descriptor{
		SchemaVersion:    instance.DescriptorSchemaVersion,
		ProtocolVersion:  instance.DescriptorProtocolVersion,
		RunnerInstanceID: instanceID,
		PID:              os.Getpid(),
		ListenAddress:    listenAddr,
		StartedAt:        startedAt,
	}
	if err := instance.WriteDescriptor(cfg.StateDir, desc); err != nil {
		_ = listener.Close()
		_ = lock.Release()
		return fmt.Errorf("app: publishing descriptor: %w", err)
	}

	events := eventlog.New(instanceID, eventlog.DefaultCapacity)
	if _, err := events.Publish(protocol.EventKindRunnerStarted, protocol.RunnerStartedPayload{}); err != nil {
		_ = instance.RemoveDescriptorIfOwned(cfg.StateDir, instanceID)
		_ = listener.Close()
		_ = lock.Release()
		return fmt.Errorf("app: publishing runner_started event: %w", err)
	}

	var state stateBox
	state.store(protocol.RunnerStateReady)

	handler := ipc.NewHandler(ipc.Deps{
		Token:         token,
		Events:        events,
		InstanceID:    instanceID,
		StartedAt:     startedAt,
		PID:           os.Getpid(),
		ListenAddress: func() string { return listenAddr },
		State:         state.load,
	})
	baseCtx, cancelBaseCtx := context.WithCancel(context.Background())
	defer cancelBaseCtx()

	httpServer := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		IdleTimeout:       60 * time.Second,
		BaseContext:       func(net.Listener) context.Context { return baseCtx },
	}

	if opts.OnReady != nil {
		opts.OnReady(listenAddr, instanceID)
	}

	serveErr := make(chan error, 1)
	go func() { serveErr <- httpServer.Serve(listener) }()

	select {
	case <-ctx.Done():
	case err := <-serveErr:
		if err != nil && err != http.ErrServerClosed {
			_ = instance.RemoveDescriptorIfOwned(cfg.StateDir, instanceID)
			_ = lock.Release()
			return fmt.Errorf("app: serving: %w", err)
		}
	}

	// Graceful shutdown sequence (brief §F): stopping state -> final
	// event -> stop accepting -> bounded drain -> close streams ->
	// remove descriptor -> release lock -> exit.
	//
	// Handlers also independently refuse new handshakes/event
	// subscriptions once state is "stopping" (runner.stopping / 503) --
	// defense in depth for a request that arrives on an already-
	// established keep-alive connection in the brief window before
	// Shutdown finishes closing the listener.
	state.store(protocol.RunnerStateStopping)
	_, _ = events.Publish(protocol.EventKindRunnerStopping, protocol.RunnerStoppingPayload{Reason: "runner is shutting down"})

	shutdownCtx, cancel := context.WithTimeout(context.Background(), GracefulDrainInterval)
	defer cancel()

	// Shutdown's first synchronous action is closing the listener(s), so
	// starting it here -- immediately after publishing the final event,
	// with no sleep beforehand -- is what actually stops new accepts at
	// this step, not merely at the end of a prior pause.
	shutdownDone := make(chan struct{})
	go func() {
		_ = httpServer.Shutdown(shutdownCtx) // stops accepting new requests immediately; waits for connections to go idle
		close(shutdownDone)
	}()

	// Let an already-open event stream flush the runner_stopping event
	// just published before anything is force-closed. This pause runs
	// concurrently with Shutdown's own wait, not before it starts.
	select {
	case <-time.After(streamFlushGrace):
	case <-shutdownDone:
	}
	// http.Server.Shutdown does not force-close a still-active long-lived
	// handler (e.g. an open NDJSON stream) merely because its own
	// deadline expired -- it only stops waiting. Cancelling BaseContext
	// makes every in-flight request's r.Context() observe cancellation,
	// so handleEvents's blocking select returns promptly.
	cancelBaseCtx()
	<-shutdownDone

	if err := instance.RemoveDescriptorIfOwned(cfg.StateDir, instanceID); err != nil {
		_ = lock.Release()
		return fmt.Errorf("app: removing descriptor on shutdown: %w", err)
	}
	if err := lock.Release(); err != nil {
		return fmt.Errorf("app: releasing instance lock: %w", err)
	}
	return nil
}
