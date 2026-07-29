//go:build !unix

package instance

import (
	"errors"
	"os"
)

// ErrLockUnsupported is returned on platforms where this package cannot
// back the single-instance lock with a real OS-backed primitive. The
// runner must fail closed (refuse to start) rather than silently running
// without the protection brief §6.1 requires -- a bounded, honestly
// reported platform limitation, never a false safety claim (brief §13).
var ErrLockUnsupported = errors.New("instance: OS-backed single-instance locking is not implemented on this platform")

func flock(f *os.File) error {
	return ErrLockUnsupported
}

func unflock(f *os.File) error {
	return nil
}
