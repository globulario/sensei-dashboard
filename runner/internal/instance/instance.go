// Package instance owns single-instance ownership of a runner state
// directory, the atomic runner.json descriptor, and runner instance
// identity (docs/claude-workspace-o2-1-runner-ipc-foundation-brief.md §6).
//
// A stale lock file without an active lock is not authority (brief §6.1):
// this package always acquires a real OS-backed lock before treating a
// state directory as owned, and only ever replaces descriptor bytes after
// that lock is held.
package instance

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// DescriptorSchemaVersion identifies runner.json's own local format. It is
// deliberately distinct from protocol.SchemaVersion: the descriptor is a
// filesystem artifact this runner instance publishes about itself, not a
// message on the IPC wire.
const DescriptorSchemaVersion = "sensei.runner.descriptor.v1"

// DescriptorProtocolVersion mirrors protocol.CurrentProtocolVersion,
// duplicated as a plain string constant here so this package has no
// dependency on the protocol package for a single field's value.
const DescriptorProtocolVersion = "1"

// Descriptor is the exact shape written to runner.json (brief §6.2). It
// must never contain the bearer token or token-file contents.
type Descriptor struct {
	SchemaVersion    string `json:"schema_version"`
	ProtocolVersion  string `json:"protocol_version"`
	RunnerInstanceID string `json:"runner_instance_id"`
	PID              int    `json:"pid"`
	ListenAddress    string `json:"listen_address"`
	StartedAt        string `json:"started_at"`
}

// LockFileName and DescriptorFileName are the two files a runner state
// directory owns (brief §6).
const (
	LockFileName       = "runner.lock"
	DescriptorFileName = "runner.json"
)

// NewInstanceID generates a fresh, unpredictable runner_instance_id. A new
// id is minted for every successful process start and is never reused
// after restart (brief §4.1).
func NewInstanceID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("instance: generating runner_instance_id: %w", err)
	}
	return "runner-instance-" + hex.EncodeToString(b), nil
}

// Lock represents a held, OS-backed exclusive lock on one state
// directory's runner.lock file. Release must be called exactly once.
type Lock struct {
	f *os.File
}

// AcquireLock acquires exclusive, non-blocking ownership of stateDir's
// lock file. It fails immediately (never blocks) if another live process
// already holds it -- brief §6.1's "a second runner using the same state
// directory must fail before publishing a descriptor or listening as an
// authoritative instance."
func AcquireLock(stateDir string) (*Lock, error) {
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		return nil, fmt.Errorf("instance: creating state directory: %w", err)
	}
	lockPath := filepath.Join(stateDir, LockFileName)
	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("instance: opening lock file: %w", err)
	}
	if err := flock(f); err != nil {
		_ = f.Close()
		return nil, fmt.Errorf("instance: another runner instance already owns %s: %w", stateDir, err)
	}
	return &Lock{f: f}, nil
}

// Release releases the lock and closes its file handle. Safe to call at
// most once per successfully acquired Lock.
func (l *Lock) Release() error {
	defer l.f.Close()
	return unflock(l.f)
}

// WriteDescriptor atomically publishes d to stateDir/runner.json:
// write-to-temporary-file, fsync where supported, then atomic rename
// (brief §6.2). The descriptor is never observable in a partially written
// state.
func WriteDescriptor(stateDir string, d Descriptor) error {
	data, err := json.Marshal(d)
	if err != nil {
		return fmt.Errorf("instance: encoding descriptor: %w", err)
	}

	tmp, err := os.CreateTemp(stateDir, DescriptorFileName+".tmp-*")
	if err != nil {
		return fmt.Errorf("instance: creating temporary descriptor file: %w", err)
	}
	tmpPath := tmp.Name()
	cleanup := func() { _ = os.Remove(tmpPath) }

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		cleanup()
		return fmt.Errorf("instance: writing temporary descriptor file: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		cleanup()
		return fmt.Errorf("instance: syncing temporary descriptor file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		cleanup()
		return fmt.Errorf("instance: closing temporary descriptor file: %w", err)
	}
	if err := os.Chmod(tmpPath, 0o600); err != nil {
		cleanup()
		return fmt.Errorf("instance: setting descriptor file permissions: %w", err)
	}
	if err := os.Rename(tmpPath, filepath.Join(stateDir, DescriptorFileName)); err != nil {
		cleanup()
		return fmt.Errorf("instance: publishing descriptor: %w", err)
	}
	return nil
}

// ReadDescriptor reads and parses stateDir/runner.json, if present.
func ReadDescriptor(stateDir string) (*Descriptor, error) {
	data, err := os.ReadFile(filepath.Join(stateDir, DescriptorFileName))
	if err != nil {
		return nil, err
	}
	var d Descriptor
	if err := json.Unmarshal(data, &d); err != nil {
		return nil, fmt.Errorf("instance: parsing descriptor: %w", err)
	}
	return &d, nil
}

// RemoveDescriptorIfOwned removes stateDir/runner.json only if its
// recorded runner_instance_id matches instanceID. A missing descriptor is
// not an error. A descriptor owned by a different (necessarily newer,
// since ownership requires holding the lock) instance is left untouched
// -- brief §6.2's "a stale process must never delete a newer process's
// descriptor."
func RemoveDescriptorIfOwned(stateDir string, instanceID string) error {
	d, err := ReadDescriptor(stateDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("instance: reading descriptor before removal: %w", err)
	}
	if d.RunnerInstanceID != instanceID {
		return nil
	}
	if err := os.Remove(filepath.Join(stateDir, DescriptorFileName)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("instance: removing descriptor: %w", err)
	}
	return nil
}
