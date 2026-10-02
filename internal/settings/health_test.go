package settings

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/platform"
)

func TestAMacSaysWhereItsOlderDataIs(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	old := filepath.Join(home, ".local", "share", "pset")
	if err := os.MkdirAll(old, 0o700); err != nil {
		t.Fatal(err)
	}
	was := platform.Current
	t.Cleanup(func() { platform.Current = was })

	platform.Current = platform.Mac
	if got := oldMacData(filepath.Join(home, "Library", "Application Support", "pset")); got != "" {
		t.Fatalf("no database in the old folder, yet %q", got)
	}
	if err := os.WriteFile(filepath.Join(old, "pset.db"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := oldMacData(filepath.Join(home, "Library", "Application Support", "pset")); got != old {
		t.Fatalf("got %q, want %q", got, old)
	}
	if got := oldMacData(old); got != "" {
		t.Fatalf("it is the folder in use, yet %q", got)
	}
	platform.Current = platform.Linux
	if got := oldMacData(filepath.Join(home, "x")); got != "" {
		t.Fatalf("not a Mac, yet %q", got)
	}
}
