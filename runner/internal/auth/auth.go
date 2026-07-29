// Package auth owns bearer-token loading and constant-time verification for
// sensei-runner's local IPC (docs/claude-workspace-o2-1-runner-ipc-foundation-
// brief.md §D). The native launcher is the future owner of secret creation
// and delivery; O2.1 only ever reads a pre-created token file once at
// startup. Token bytes never leave this package except through Verify's
// boolean result -- nothing here ever formats, logs, or returns the token
// itself.
package auth

import (
	"bytes"
	"crypto/subtle"
	"errors"
	"fmt"
	"os"
)

// MinTokenBytes is the minimum effective token length this package accepts
// (brief §D: "requires at least 32 bytes of effective token material").
const MinTokenBytes = 32

// Token holds loaded bearer-token material. The zero value is not valid;
// construct with LoadTokenFile.
type Token struct {
	bytes []byte
}

// LoadTokenFile reads and validates the token file at path exactly once.
// It refuses a missing, empty, weak, directory, non-regular, or symlink
// path, and -- on Unix -- a group- or world-readable one. It never returns
// the token bytes to the caller except bound inside the returned *Token,
// whose only public behavior is constant-time comparison.
func LoadTokenFile(path string) (*Token, error) {
	if path == "" {
		return nil, errors.New("auth: --auth-token-file is required")
	}

	info, err := os.Lstat(path)
	if err != nil {
		return nil, fmt.Errorf("auth: token file: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return nil, errors.New("auth: token file must not be a symlink")
	}
	if info.IsDir() {
		return nil, errors.New("auth: token path is a directory, not a file")
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("auth: token path is not a regular file")
	}
	if err := checkUnixPermissions(info); err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("auth: reading token file: %w", err)
	}
	trimmed := bytes.TrimRight(data, "\r\n")
	if len(trimmed) < MinTokenBytes {
		return nil, fmt.Errorf("auth: token material is shorter than the required minimum of %d bytes", MinTokenBytes)
	}

	owned := make([]byte, len(trimmed))
	copy(owned, trimmed)
	return &Token{bytes: owned}, nil
}

// Verify reports whether supplied matches the loaded token, in constant
// time with respect to the token's content. A length mismatch is not
// secret (it leaks no more than "wrong"), so it may short-circuit; the
// byte content comparison itself never does.
func (t *Token) Verify(supplied string) bool {
	suppliedBytes := []byte(supplied)
	if len(suppliedBytes) != len(t.bytes) {
		return false
	}
	return subtle.ConstantTimeCompare(suppliedBytes, t.bytes) == 1
}
