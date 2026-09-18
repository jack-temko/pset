//go:build llm

// Prompt conformance against the real model, behind the `llm` build tag like
// the other live tests: the ask prompt must make the model emit schema-valid
// envelopes for all five kinds, and one repair round must fix a deliberately
// broken payload. Run with: go test -tags llm ./...
package pset

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/engine"
	"github.com/jackt/pset/internal/llm"
)

// envelopeFromReply extracts the first fenced envelope of the kind from a
// model reply.
func envelopeFromReply(t *testing.T, kind, reply string) string {
	t.Helper()
	re := regexp.MustCompile("(?s)```" + kind + "\\s*\n(.*?)\n```")
	m := re.FindStringSubmatch(reply)
	if m == nil {
		t.Fatalf("reply carries no %q envelope:\n%s", kind, reply)
	}
	return strings.TrimSpace(m[1])
}

func TestPromptEmitsValidEnvelopes(t *testing.T) {
	client, _ := liveClient(t)
	probes := map[string]string{
		"equation":   "State the quadratic formula. Reply with exactly one equation envelope and nothing else.",
		"steps":      "Solve 2x + 3 = 11. Reply with exactly one steps envelope and nothing else.",
		"theorem":    "State the Pythagorean theorem with a citation. Reply with exactly one theorem envelope and nothing else.",
		"definition": "Define the derivative with a citation. Reply with exactly one definition envelope and nothing else.",
		"note":       "Warn me not to cancel sin out of sin(x)/x. Reply with exactly one note envelope and nothing else.",
	}
	for kind, question := range probes {
		t.Run(kind, func(t *testing.T) {
			reply, err := client.ChatOnce(context.Background(), llm.ChatRequest{
				Model: llm.ChatModel,
				Messages: []llm.Message{
					llm.TextMessage("system", engine.SystemPrompt()),
					llm.TextMessage("user", question),
				},
			})
			if err != nil {
				skipRateLimit(t, err)
				t.Fatalf("chat: %v", err)
			}
			payload := envelopeFromReply(t, kind, reply)
			if err := engine.ValidateEnvelope(kind, payload); err != nil {
				t.Errorf("envelope payload does not validate:\n%s\n%v", payload, err)
			}
		})
	}
}

// TestRepairRoundFixesBrokenPayload mirrors the engine's repair prompt: kind,
// invalid payload, validation errors, and the schema verbatim.
func TestRepairRoundFixesBrokenPayload(t *testing.T) {
	client, _ := liveClient(t)
	kind, broken := "equation", `{"title":"Bayes","equations":[]}`
	verr := engine.ValidateEnvelope(kind, broken)
	if verr == nil {
		t.Fatalf("%s must not validate", broken)
	}
	schema, err := os.ReadFile(filepath.Join("internal", "engine", "schemas", kind+".schema.json"))
	if err != nil {
		t.Fatal(err)
	}
	prompt := fmt.Sprintf(`Repair this %q envelope.

The invalid payload:

%s

The validation errors:

%s

The schema it must satisfy:

%s

Return only the corrected JSON object.`, kind, broken, "- "+verr.Error(), schema)
	fixed, err := client.ChatOnce(context.Background(), llm.ChatRequest{
		Model: llm.ChatModel,
		Messages: []llm.Message{
			llm.TextMessage("system", "You repair malformed JSON envelopes. Reply with only the corrected JSON object: no prose, no code fences, no comments."),
			llm.TextMessage("user", prompt),
		},
	})
	if err != nil {
		skipRateLimit(t, err)
		t.Fatalf("repair call: %v", err)
	}
	fixed = strings.TrimSpace(fixed)
	if strings.HasPrefix(fixed, "```") {
		if i := strings.IndexByte(fixed, '\n'); i >= 0 {
			fixed = fixed[i+1:]
		}
		if i := strings.LastIndexByte(fixed, '\n'); i >= 0 {
			fixed = fixed[:i]
		}
		fixed = strings.TrimSpace(fixed)
	}
	if err := engine.ValidateEnvelope(kind, fixed); err != nil {
		t.Errorf("repaired payload still invalid:\n%s\n%v", fixed, err)
	}
}
