package llm

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackt/pset/internal/errs"
)

// A failed call carries the entry its status means, so whatever wraps it is
// explained by the cause: the id at the bottom of the chain.
func TestCallErrorUnwrapsToItsCatalogEntry(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  *CallError
		id   string
	}{
		{"credit", &CallError{Status: 402}, "key.out_of_credit"},
		{"credit in words", &CallError{Status: 429, Body: "insufficient credits"}, "key.out_of_credit"},
		{"refused", &CallError{Status: 401}, "key.refused"},
		{"forbidden", &CallError{Status: 403}, "key.refused"},
		{"unknown model", &CallError{Status: 400, Body: `{"error":"Model not found"}`}, "model.unknown"},
		{"not found", &CallError{Status: 404}, "model.unknown"},
		{"busy", &CallError{Status: 503}, "model.busy"},
		{"rate limited", &CallError{Status: 429}, "model.busy"},
		{"rejected", &CallError{Status: 400, Body: "bad request"}, "model.rejected"},
	} {
		v := errs.Resolve(tc.err)
		if v.ID != tc.id {
			t.Errorf("%s: %s, want %s", tc.name, v.ID, tc.id)
		}
	}
}

func TestStreamCutAndNetworkFailureAreInTheCatalog(t *testing.T) {
	cutErr := cut("%w: eof", ErrStreamCut)
	if !errors.Is(cutErr, ErrStreamCut) || errs.Resolve(cutErr).ID != "model.cut" {
		t.Errorf("cut: %v", errs.Resolve(cutErr))
	}
	c := Open(Config{ChatEndpoint: "http://127.0.0.1:1", APIKey: "k", ChatModel: "m"})
	_, err := c.ChatOnce(context.Background(), ChatRequest{Model: "m", Messages: []Message{TextMessage("user", "hi")}})
	if err == nil || errs.Resolve(err).ID != "model.unreachable" {
		t.Errorf("unreachable: %v", err)
	}
}

// The cost sink is told the cause's id with a failed call.
func TestAFailedCallIsLoggedWithItsCauseID(t *testing.T) {
	var got Call
	OnCall(func(c Call) { got = c })
	t.Cleanup(func() { OnCall(nil) })
	logCall(ChatRequest{Model: "m"}, time.Now(), Reply{}, &CallError{Status: 402})
	if got.ErrorID != "key.out_of_credit" || got.Error == "" {
		t.Errorf("call %+v", got)
	}
	logCall(ChatRequest{Model: "m"}, time.Now(), Reply{}, nil)
	if got.ErrorID != "" {
		t.Errorf("a call that worked has cause %q", got.ErrorID)
	}
}
