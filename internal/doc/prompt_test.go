package doc

import (
	"os"
	"strings"
	"testing"
)

// The guide prompt was evaluated against the real model as one piece of
// text; the doc package holds the part after "How to work". Its tested
// text is kept in testdata, and this fails if the two drift.
func TestGuideWritingIsTheTestedPrompt(t *testing.T) {
	tested, err := os.ReadFile("testdata/guide-prompt-v4.txt")
	if err != nil {
		t.Fatal(err)
	}
	i := strings.Index(string(tested), "What to write:")
	if i < 0 {
		t.Fatal("no writing part in the tested prompt")
	}
	if got, want := GuideWriting, string(tested)[i:]; got != want {
		t.Fatalf("GuideWriting differs from the tested V4 prompt:\n got %q\nwant %q", got, want)
	}
}
