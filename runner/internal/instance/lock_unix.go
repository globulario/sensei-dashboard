//go:build unix

package instance

import (
	"os"
	"syscall"
)

// flock acquires a non-blocking exclusive OS-backed advisory lock via
// flock(2). This is the "not only a PID file" lock brief §6.1 requires: a
// stale lock file whose owning process has exited cannot hold this lock,
// so a new process reliably distinguishes a live owner from a leftover
// file.
func flock(f *os.File) error {
	return syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
}

func unflock(f *os.File) error {
	return syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
}
