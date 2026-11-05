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
