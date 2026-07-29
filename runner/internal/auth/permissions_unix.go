//go:build unix

package auth

import (
	"errors"
	"io/fs"
)

// checkUnixPermissions rejects a token file readable by anyone other than
// its owner (brief §D: "On Unix, rejects group- or world-readable token
// files"). This check only runs on unix-family GOOS builds -- see
// permissions_other.go for the honestly-documented non-Unix gap.
func checkUnixPermissions(info fs.FileInfo) error {
	if info.Mode().Perm()&0o044 != 0 {
		return errors.New("auth: token file must not be group- or world-readable")
	}
	return nil
}
