package instance

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestAcquireLock_SecondInstanceFailsOnSameStateDir(t *testing.T) {
	dir := t.TempDir()

	first, err := AcquireLock(dir)
	if err != nil {
		t.Fatalf("first AcquireLock failed: %v", err)
	}
	defer first.Release()

	if _, err := AcquireLock(dir); err == nil {
		t.Fatal("a second instance must not be able to acquire the same state directory's lock")
	}
}

func TestAcquireLock_RestartAfterCleanReleaseSucceeds(t *testing.T) {
	dir := t.TempDir()

	first, err := AcquireLock(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := first.Release(); err != nil {
		t.Fatalf("release failed: %v", err)
	}

	second, err := AcquireLock(dir)
	if err != nil {
		t.Fatalf("restart after clean release must succeed: %v", err)
	}
	defer second.Release()
}

func TestAcquireLock_StaleLockFileWithoutActiveLockIsNotAuthority(t *testing.T) {
	dir := t.TempDir()

	// Simulate a crashed prior instance: the lock file exists on disk but
	// no process actually holds an OS-level lock on it (brief §6.1: "a
	// stale lock file without an active lock is not authority").
	if err := os.WriteFile(filepath.Join(dir, LockFileName), []byte("stale"), 0o600); err != nil {
		t.Fatal(err)
	}

	lock, err := AcquireLock(dir)
	if err != nil {
		t.Fatalf("a stale lock file with no active holder must not block acquisition: %v", err)
	}
	defer lock.Release()
}

func TestWriteDescriptor_ReadBackIsCompleteAndValid(t *testing.T) {
	dir := t.TempDir()
	d := Descriptor{
		SchemaVersion:    DescriptorSchemaVersion,
		ProtocolVersion:  DescriptorProtocolVersion,
		RunnerInstanceID: "runner-instance-aaaa",
		PID:              1234,
		ListenAddress:    "127.0.0.1:9999",
		StartedAt:        "2026-07-29T13:00:00Z",
	}
	if err := WriteDescriptor(dir, d); err != nil {
		t.Fatal(err)
	}

	got, err := ReadDescriptor(dir)
	if err != nil {
		t.Fatal(err)
	}
	if *got != d {
		t.Fatalf("read-back descriptor does not match: got %+v, want %+v", *got, d)
	}

	// No stray temporary file left behind.
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if e.Name() != DescriptorFileName {
			t.Fatalf("unexpected leftover file in state dir: %s", e.Name())
		}
	}
}

func TestWriteDescriptor_StaleDescriptorReplacedOnlyAfterRealLockAcquired(t *testing.T) {
	dir := t.TempDir()
	stale := Descriptor{
		SchemaVersion:    DescriptorSchemaVersion,
		ProtocolVersion:  DescriptorProtocolVersion,
		RunnerInstanceID: "runner-instance-old",
		PID:              1,
		ListenAddress:    "127.0.0.1:1",
		StartedAt:        "2026-01-01T00:00:00Z",
	}
	if err := WriteDescriptor(dir, stale); err != nil {
		t.Fatal(err)
	}

	lock, err := AcquireLock(dir)
	if err != nil {
		t.Fatalf("acquiring the real lock over a stale descriptor must succeed: %v", err)
	}
	defer lock.Release()

	fresh := stale
	fresh.RunnerInstanceID = "runner-instance-new"
	if err := WriteDescriptor(dir, fresh); err != nil {
		t.Fatal(err)
	}

	got, err := ReadDescriptor(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got.RunnerInstanceID != "runner-instance-new" {
		t.Fatalf("expected the stale descriptor to be replaced, got instance id %q", got.RunnerInstanceID)
	}
}

func TestRemoveDescriptorIfOwned_RemovesOwnDescriptor(t *testing.T) {
	dir := t.TempDir()
	d := Descriptor{SchemaVersion: DescriptorSchemaVersion, RunnerInstanceID: "runner-instance-mine"}
	if err := WriteDescriptor(dir, d); err != nil {
		t.Fatal(err)
	}
	if err := RemoveDescriptorIfOwned(dir, "runner-instance-mine"); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadDescriptor(dir); !os.IsNotExist(err) {
		t.Fatalf("expected the descriptor to be removed, got err=%v", err)
	}
}

func TestRemoveDescriptorIfOwned_LeavesNewerInstancesDescriptorUntouched(t *testing.T) {
	dir := t.TempDir()
	d := Descriptor{SchemaVersion: DescriptorSchemaVersion, RunnerInstanceID: "runner-instance-newer"}
	if err := WriteDescriptor(dir, d); err != nil {
		t.Fatal(err)
	}

	// An old (e.g. crashed-then-somehow-still-cleaning-up) instance must
	// never delete a descriptor belonging to a different, newer instance
	// (brief §6.2).
	if err := RemoveDescriptorIfOwned(dir, "runner-instance-old"); err != nil {
		t.Fatal(err)
	}

	got, err := ReadDescriptor(dir)
	if err != nil {
		t.Fatalf("expected the newer descriptor to remain: %v", err)
	}
	if got.RunnerInstanceID != "runner-instance-newer" {
		t.Fatalf("descriptor was unexpectedly altered: %+v", got)
	}
}

func TestRemoveDescriptorIfOwned_MissingDescriptorIsNotAnError(t *testing.T) {
	dir := t.TempDir()
	if err := RemoveDescriptorIfOwned(dir, "runner-instance-anything"); err != nil {
		t.Fatalf("removing a nonexistent descriptor must not error: %v", err)
	}
}

func TestNewInstanceID_ChangesAcrossCalls(t *testing.T) {
	a, err := NewInstanceID()
	if err != nil {
		t.Fatal(err)
	}
	b, err := NewInstanceID()
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("two consecutive instance ids must not collide")
	}
}

// TestWriteDescriptor_NeverObservablyPartial stresses the write-temp-then-
// rename path: a concurrent reader loop must, at every point, either see
// the previous complete descriptor or the next complete one -- never a
// truncated or unparsable read (brief §6.2: "the descriptor must never
// contain the bearer token... Do not expose a partially written
// descriptor").
func TestWriteDescriptor_NeverObservablyPartial(t *testing.T) {
	dir := t.TempDir()
	initial := Descriptor{SchemaVersion: DescriptorSchemaVersion, RunnerInstanceID: "runner-instance-0"}
	if err := WriteDescriptor(dir, initial); err != nil {
		t.Fatal(err)
	}

	stop := make(chan struct{})
	var readErrs int
	var mu sync.Mutex
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
			}
			data, err := os.ReadFile(filepath.Join(dir, DescriptorFileName))
			if err != nil {
				continue // a rename-in-flight ENOENT window is acceptable; a parse failure of existing bytes is not.
			}
			var d Descriptor
			if err := json.Unmarshal(data, &d); err != nil {
				mu.Lock()
				readErrs++
				mu.Unlock()
			}
		}
	}()

	for i := 1; i <= 200; i++ {
		d := initial
		d.RunnerInstanceID = "runner-instance-stress"
		d.PID = i
		if err := WriteDescriptor(dir, d); err != nil {
			t.Fatal(err)
		}
	}
	close(stop)
	wg.Wait()

	if readErrs > 0 {
		t.Fatalf("observed %d partially-written (unparsable) descriptor reads", readErrs)
	}
}
