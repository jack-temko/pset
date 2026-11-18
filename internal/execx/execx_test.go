package execx

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestRun(t *testing.T) {
	ctx := context.Background()
	if out, err := Run(ctx, "sh", "-c", "echo hi"); err != nil || out != "hi\n" {
		t.Fatalf("out %q err %v", out, err)
	}
	_, err := Run(ctx, "sh", "-c", "echo broken >&2; exit 3")
	if err == nil || !strings.Contains(err.Error(), "broken") || !strings.Contains(err.Error(), "run sh") {
		t.Fatalf("a failing program's error says what it said: %v", err)
	}
	_, err = Run(ctx, "pset-no-such-program")
	if !errors.Is(err, ErrNotInstalled) || !strings.Contains(err.Error(), "pset-no-such-program") {
		t.Fatalf("a missing program: %v", err)
	}
	cctx, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := Run(cctx, "sleep", "5"); err == nil {
		t.Fatal("a cancelled run finished")
	}
}

// RunEnv adds its variables to the program's environment, on top of PSet's.
func TestRunEnvAddsToTheEnvironment(t *testing.T) {
	t.Setenv("PSET_EXECX_BASE", "kept")
	out, err := RunEnv(context.Background(), []string{"PSET_EXECX_EXTRA=added"}, "sh", "-c", `echo "$PSET_EXECX_BASE $PSET_EXECX_EXTRA"`)
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.TrimSpace(out); got != "kept added" {
		t.Fatalf("the program saw %q", got)
	}
}
