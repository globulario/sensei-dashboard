// Command sensei-runner is the O2.1 runner/IPC foundation executable
// (docs/claude-workspace-o2-1-runner-ipc-foundation-brief.md). This file is
// CLI composition only: parse flags, wire OS signals into a cancellable
// context, run the app lifecycle, report the outcome. All real behavior
// lives in the internal packages.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/globulario/sensei-dashboard/runner/internal/app"
	"github.com/globulario/sensei-dashboard/runner/internal/config"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "sensei-runner:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Parse(os.Args[1:])
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	return app.Run(ctx, app.Options{
		Config: cfg,
		OnReady: func(listenAddress, instanceID string) {
			log.Printf("sensei-runner: listening on %s (instance %s)", listenAddress, instanceID)
		},
	})
}
