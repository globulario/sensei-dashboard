package auth

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func writeToken(t *testing.T, dir, name string, contents []byte, perm os.FileMode) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, contents, perm); err != nil {
		t.Fatal(err)
	}
	return p
}

func validTokenBytes() []byte {
	return []byte(strings.Repeat("a", MinTokenBytes))
}

func TestLoadTokenFile_MissingFileIsRefused(t *testing.T) {
	dir := t.TempDir()
	if _, err := LoadTokenFile(filepath.Join(dir, "does-not-exist")); err == nil {
		t.Fatal("expected an error for a missing token file")
	}
}

func TestLoadTokenFile_EmptyPathIsRefused(t *testing.T) {
	if _, err := LoadTokenFile(""); err == nil {
		t.Fatal("expected an error for an empty path")
	}
}

func TestLoadTokenFile_DirectoryIsRefused(t *testing.T) {
	dir := t.TempDir()
	if _, err := LoadTokenFile(dir); err == nil {
		t.Fatal("expected an error when the token path is a directory")
	}
}

func TestLoadTokenFile_SymlinkIsRefused(t *testing.T) {
	dir := t.TempDir()
	real := writeToken(t, dir, "real-token", validTokenBytes(), 0o600)
	link := filepath.Join(dir, "token-link")
	if err := os.Symlink(real, link); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadTokenFile(link); err == nil {
		t.Fatal("expected an error for a symlink token path")
	}
}

func TestLoadTokenFile_WeakTokenIsRefused(t *testing.T) {
	dir := t.TempDir()
	p := writeToken(t, dir, "weak-token", []byte("too-short"), 0o600)
	if _, err := LoadTokenFile(p); err == nil {
		t.Fatal("expected an error for a token shorter than the minimum")
	}
}

func TestLoadTokenFile_EmptyTokenIsRefused(t *testing.T) {
	dir := t.TempDir()
	p := writeToken(t, dir, "empty-token", []byte{}, 0o600)
	if _, err := LoadTokenFile(p); err == nil {
		t.Fatal("expected an error for an empty token file")
	}
}

func TestLoadTokenFile_ValidTokenSucceeds(t *testing.T) {
	dir := t.TempDir()
	p := writeToken(t, dir, "good-token", validTokenBytes(), 0o600)
	tok, err := LoadTokenFile(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !tok.Verify(string(validTokenBytes())) {
		t.Fatal("Verify must succeed for the exact loaded token")
	}
	if tok.Verify("wrong-token-wrong-token-wrong-token") {
		t.Fatal("Verify must fail for an incorrect token")
	}
}

func TestLoadTokenFile_TrailingNewlineIsTrimmed(t *testing.T) {
	dir := t.TempDir()
	p := writeToken(t, dir, "newline-token", append(validTokenBytes(), '\n'), 0o600)
	tok, err := LoadTokenFile(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !tok.Verify(string(validTokenBytes())) {
		t.Fatal("a trailing newline in the token file must not change the effective token")
	}
}

func TestLoadTokenFile_GroupOrWorldReadableIsRefusedOnUnix(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("group/world-readable enforcement is Unix-specific (brief §D); Windows is a documented platform limitation")
	}
	dir := t.TempDir()
	p := writeToken(t, dir, "readable-token", validTokenBytes(), 0o644)
	if _, err := LoadTokenFile(p); err == nil {
		t.Fatal("expected an error for a group/world-readable token file on a Unix platform")
	}
}

func TestLoadTokenFile_OwnerOnlyPermissionsSucceedOnUnix(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("permission bits are Unix-specific")
	}
	dir := t.TempDir()
	p := writeToken(t, dir, "owner-only-token", validTokenBytes(), 0o600)
	if _, err := LoadTokenFile(p); err != nil {
		t.Fatalf("unexpected error for an owner-only-readable token file: %v", err)
	}
}

func TestToken_VerifyNeverPanicsOnLengthMismatch(t *testing.T) {
	dir := t.TempDir()
	p := writeToken(t, dir, "good-token", validTokenBytes(), 0o600)
	tok, err := LoadTokenFile(p)
	if err != nil {
		t.Fatal(err)
	}
	if tok.Verify("short") {
		t.Fatal("a shorter supplied credential must never verify")
	}
	if tok.Verify(strings.Repeat("b", 1000)) {
		t.Fatal("a longer supplied credential must never verify")
	}
	if tok.Verify("") {
		t.Fatal("an empty supplied credential must never verify")
	}
}
