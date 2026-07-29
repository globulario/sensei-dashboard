package config

import "testing"

func TestValidateLoopbackAddress(t *testing.T) {
	valid := []string{
		"127.0.0.1:0",
		"127.0.0.1:8080",
		"127.5.5.5:1234",
		"localhost:0",
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
