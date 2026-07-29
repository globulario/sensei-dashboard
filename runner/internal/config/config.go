// Package config owns validated startup configuration for sensei-runner
// (docs/claude-workspace-o2-1-runner-ipc-foundation-brief.md §C, §D, §6).
// Nothing outside this package should parse flags or decide whether a
// listen address is safe to bind.
package config

import (
	"errors"
	"flag"
	"fmt"
	"net"
)

// DefaultListen is the default IPv4 loopback listener: the operating
// system chooses a free port (brief §C).
const DefaultListen = "127.0.0.1:0"

// Config is fully validated startup configuration.
type Config struct {
	AuthTokenFile string
	StateDir      string
	Listen        string
}

// Parse parses args (typically os.Args[1:]) into a validated Config.
func Parse(args []string) (*Config, error) {
	fs := flag.NewFlagSet("sensei-runner", flag.ContinueOnError)
	tokenFile := fs.String("auth-token-file", "", "path to a file containing the bearer token (required)")
	stateDir := fs.String("state-dir", "", "path to the runner state directory (required)")
	listen := fs.String("listen", DefaultListen, "IPv4 loopback address to listen on")
	if err := fs.Parse(args); err != nil {
		return nil, err
	}

	cfg := &Config{AuthTokenFile: *tokenFile, StateDir: *stateDir, Listen: *listen}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// Validate re-checks every field, independent of how the Config was built
// -- callers constructing a Config directly (tests) get the exact same
// enforcement as the CLI path.
func (c *Config) Validate() error {
	if c.AuthTokenFile == "" {
		return errors.New("config: --auth-token-file is required")
	}
	if c.StateDir == "" {
		return errors.New("config: --state-dir is required")
	}
	return ValidateLoopbackAddress(c.Listen)
}

// ValidateLoopbackAddress enforces brief §C's bind-refusal rules: the
// runner must refuse startup when configured to bind to 0.0.0.0, a
// non-loopback address, an ambiguous hostname, a wildcard, or an empty
// host -- and must accept IPv4 loopback only (not ::1), per "IPv4
// loopback listener only".
func ValidateLoopbackAddress(addr string) error {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("config: invalid --listen address %q: %w", addr, err)
	}
	if host == "" {
		return fmt.Errorf("config: --listen host must not be empty, which would imply all interfaces: %q", addr)
	}

	if ip := net.ParseIP(host); ip != nil {
		if !ip.IsLoopback() {
			return fmt.Errorf("config: --listen must be a loopback address, got %q", addr)
		}
		if ip.To4() == nil {
			return fmt.Errorf("config: --listen must be an IPv4 loopback address (not IPv6), got %q", addr)
		}
		return nil
	}

	if host != "localhost" {
		return fmt.Errorf("config: --listen host must be an IPv4 loopback literal or %q, got %q", "localhost", addr)
	}
	addrs, err := net.LookupHost(host)
	if err != nil {
		return fmt.Errorf("config: could not resolve --listen host %q: %w", host, err)
	}
	if len(addrs) == 0 {
		return fmt.Errorf("config: --listen host %q resolved to no addresses", host)
	}
	for _, a := range addrs {
		resolved := net.ParseIP(a)
		if resolved == nil || !resolved.IsLoopback() || resolved.To4() == nil {
			return fmt.Errorf("config: --listen host %q resolution is ambiguous (resolved to non-IPv4-loopback %q)", host, a)
		}
	}
	return nil
}
