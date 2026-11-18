// Package execx runs the programs PSet reads books with: poppler's tools
// and tesseract. One way to run them and one way to say one is missing.
package execx

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// ErrNotInstalled is wrapped by the error of a program that isn't on PATH
// (check with errors.Is); the message names the program.
var ErrNotInstalled = errors.New("program not on PATH")

// NotInstalledError is a program that isn't on PATH, by name, for a caller
// that needs to know which (errors.As).
type NotInstalledError struct {
	Name string
}

func (e *NotInstalledError) Error() string { return ErrNotInstalled.Error() + ": " + e.Name }

// Is makes errors.Is(err, ErrNotInstalled) hold.
func (e *NotInstalledError) Is(target error) bool { return target == ErrNotInstalled }

// Look reports the program missing before anything is asked of it.
func Look(name string) error {
	if _, err := exec.LookPath(name); err != nil {
		return &NotInstalledError{Name: name}
	}
	return nil
}

// Run runs a program and returns what it wrote to stdout. A failure carries
// the command line and what the program said on stderr. Cancelling ctx
// kills the program.
func Run(ctx context.Context, name string, args ...string) (string, error) {
	return RunEnv(ctx, nil, name, args...)
}

// RunEnv is Run with extra environment variables ("KEY=value") on top of
// PSet's own.
func RunEnv(ctx context.Context, env []string, name string, args ...string) (string, error) {
	if err := Look(name); err != nil {
		return "", err
	}
	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, name, args...)
	if len(env) > 0 {
		cmd.Env = append(os.Environ(), env...)
	}
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			return "", fmt.Errorf("run %s %s: %w", name, strings.Join(args, " "), err)
		}
		return "", fmt.Errorf("run %s %s: %w: %s", name, strings.Join(args, " "), err, msg)
	}
	return stdout.String(), nil
}
