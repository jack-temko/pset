// Package testx is what tests use to check the errors of calls that are only
// setup: seeding a table, writing a fixture, serving a canned reply.
package testx

import "testing"

// Check fails the test, and lets it go on, when err is not nil. It is safe in
// a handler or goroutine a test started, where Fatal is not.
func Check(t testing.TB, err error) {
	t.Helper()
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

// Err keeps the error of a call that also returns a value, so that
// Check(t, Err(d.Exec(...))) reads as one line.
func Err[T any](_ T, err error) error { return err }
