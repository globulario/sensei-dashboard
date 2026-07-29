package config

import (
	"net"
	"testing"
)

func TestValidateLoopbackAddress(t *testing.T) {
	// IP-literal cases only: these are deterministic in every test
	// environment. "localhost" is deliberately NOT included here -- its
	// validity depends on how the current environment's resolver answers
	// it (see TestValidateLoopbackAddress_LocalhostMatchesActualResolution
	// below), which differs between a typical dev machine (often IPv4-only)
	// and a CI runner (commonly both 127.0.0.1 and ::1).
	valid := []string{
		"127.0.0.1:0",
		"127.0.0.1:8080",
		"127.5.5.5:1234",
	}
	for _, addr := range valid {
		t.Run("valid/"+addr, func(t *testing.T) {
			if err := ValidateLoopbackAddress(addr); err != nil {
				t.Fatalf("expected %q to be accepted, got error: %v", addr, err)
			}
		})
	}

	invalid := []string{
		"0.0.0.0:8080",
		"1.2.3.4:8080",
		":8080",
		"[::1]:8080",
		"[::]:8080",
		"example.com:8080",
		"not-an-address",
	}
	for _, addr := range invalid {
		t.Run("invalid/"+addr, func(t *testing.T) {
			if err := ValidateLoopbackAddress(addr); err == nil {
				t.Fatalf("expected %q to be refused", addr)
			}
		})
	}
}

// TestValidateLoopbackAddress_LocalhostMatchesActualResolution proves the
// "hostname whose resolution is ambiguous" rule (brief §C) against
// whatever this environment's real resolver returns for "localhost",
// rather than assuming a fixed answer: a dev machine that resolves
// "localhost" to 127.0.0.1 only must accept it; a CI runner that also
// resolves it to ::1 must refuse it, since net.Listen("tcp",
// "localhost:0") could then silently bind IPv6 instead of the required
// IPv4-only loopback.
func TestValidateLoopbackAddress_LocalhostMatchesActualResolution(t *testing.T) {
	addrs, err := net.LookupHost("localhost")
	if err != nil {
		t.Skipf("cannot resolve localhost in this environment: %v", err)
	}

	allIPv4Loopback := true
	for _, a := range addrs {
		ip := net.ParseIP(a)
		if ip == nil || !ip.IsLoopback() || ip.To4() == nil {
			allIPv4Loopback = false
		}
	}

	err = ValidateLoopbackAddress("localhost:0")
	if allIPv4Loopback && err != nil {
		t.Fatalf("localhost resolves to IPv4 loopback only (%v) but was refused: %v", addrs, err)
	}
	if !allIPv4Loopback && err == nil {
		t.Fatalf("localhost resolution %v is not exclusively IPv4 loopback but was accepted", addrs)
	}
}

func TestConfig_Validate_RequiresAuthTokenFileAndStateDir(t *testing.T) {
	cfg := &Config{Listen: DefaultListen}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected an error when --auth-token-file and --state-dir are both missing")
	}

	cfg = &Config{AuthTokenFile: "/tmp/token", Listen: DefaultListen}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected an error when --state-dir is missing")
	}

	cfg = &Config{AuthTokenFile: "/tmp/token", StateDir: "/tmp/state", Listen: DefaultListen}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected a fully specified config to validate, got: %v", err)
	}
}

func TestConfig_Validate_RejectsNonLoopbackListen(t *testing.T) {
	cfg := &Config{AuthTokenFile: "/tmp/token", StateDir: "/tmp/state", Listen: "0.0.0.0:8080"}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected a non-loopback --listen to be refused")
	}
}

func TestParse_DefaultsListenToLoopbackEphemeral(t *testing.T) {
	cfg, err := Parse([]string{"--auth-token-file", "/tmp/token", "--state-dir", "/tmp/state"})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Listen != DefaultListen {
		t.Fatalf("expected default listen %q, got %q", DefaultListen, cfg.Listen)
	}
}

func TestParse_RequiresAuthTokenFile(t *testing.T) {
	if _, err := Parse([]string{"--state-dir", "/tmp/state"}); err == nil {
		t.Fatal("expected an error when --auth-token-file is omitted")
	}
}
