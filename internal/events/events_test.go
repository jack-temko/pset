package events

import (
	"testing"
)

func drain(ch <-chan Event) []Event {
	var out []Event
	for {
		select {
		case e := <-ch:
			out = append(out, e)
		default:
			return out
		}
	}
}

func TestSubscribeReplaysAfterLastID(t *testing.T) {
	b := NewBus()
	for range 3 {
		b.Publish("x", nil)
	}
	ch, cancel := b.Subscribe(1)
	defer cancel()
	got := drain(ch)
	if len(got) != 2 || got[0].ID != 2 || got[1].ID != 3 {
		t.Fatalf("replay = %+v", got)
	}
}

func TestSubscribeFromNowReplaysNothing(t *testing.T) {
	b := NewBus()
	b.Publish("x", nil)
	ch, cancel := b.Subscribe(0)
	defer cancel()
	if got := drain(ch); len(got) != 0 {
		t.Fatalf("got %+v", got)
	}
	b.Publish("y", map[string]int{"n": 1})
	got := drain(ch)
	if len(got) != 1 || got[0].Type != "y" || string(got[0].Data) != `{"n":1}` {
		t.Fatalf("live = %+v", got)
	}
}

func TestGapOlderThanRingSendsReset(t *testing.T) {
	b := NewBus()
	for range ringSize + 10 {
		b.Publish("x", nil)
	}
	ch, cancel := b.Subscribe(3)
	defer cancel()
	got := drain(ch)
	if got[0].Type != Reset {
		t.Fatalf("first = %+v", got[0])
	}
	if len(got) != ringSize+1 {
		t.Fatalf("len = %d", len(got))
	}
}

func TestUpToDateClientGetsNoReset(t *testing.T) {
	b := NewBus()
	for range ringSize + 10 {
		b.Publish("x", nil)
	}
	ch, cancel := b.Subscribe(ringSize + 10)
	defer cancel()
	if got := drain(ch); len(got) != 0 {
		t.Fatalf("got %d events", len(got))
	}
}
