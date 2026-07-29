//go:build !unix

package auth

import "io/fs"

// checkUnixPermissions is a documented no-op on non-Unix platforms: Windows
// ACLs do not map onto POSIX group/world-readable bits, and this package
// must not claim a protection it cannot actually enforce (docs/claude-
// workspace-o2-1-runner-ipc-foundation-brief.md §13's stop condition on
// false security claims). This is a reported, bounded platform limitation,
// not a silent gap -- see runner/README.md.
func checkUnixPermissions(info fs.FileInfo) error {
	return nil
}
