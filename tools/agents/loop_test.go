package main

import "testing"

// TestTail checks the end of a failing `make check`, handed back to the implementer.
func TestTail(t *testing.T) {
	cases := []struct {
		name string
		in   string
		n    int
		want string
	}{
		{"fewer than asked", "a\nb\nc", 5, "a\nb\nc"},
		{"exactly as many", "a\nb\nc", 3, "a\nb\nc"},
		{"more than asked", "a\nb\nc\nd", 2, "c\nd"},
		{"a trailing newline", "a\nb\nc\n", 2, "b\nc"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := tail(c.in, c.n); got != c.want {
				t.Errorf("tail(%q, %d) = %q, want %q", c.in, c.n, got, c.want)
			}
		})
	}
}
