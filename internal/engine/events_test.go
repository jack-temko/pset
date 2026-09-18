package engine

import (
	"testing"
	"time"
)

// The broker's resume contract: every event is numbered without gaps, a
// subscriber naming its last event is replayed exactly what it missed, a
// resume point that cannot be honoured is refused rather than half-filled,
// and a subscriber that cannot keep up is dropped loudly instead of left
// silently missing events.

func publishTasks(b *eventBroker, ids ...string) {
	for _, id := range ids {
		b.publishTask(&TaskView{ID: id})
	}
}

func seqs(evs []StreamEvent) []uint64 {
	out := make([]uint64, len(evs))
	for i, ev := range evs {
		out[i] = ev.Seq
	}
	return out
}

func seqsEqual(got []uint64, want ...uint64) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

func TestBrokerNumbersEventsWithoutGaps(t *testing.T) {
	b := newEventBroker()
	publishTasks(b, "a", "b")
	b.publishRemoved("a")
	publishTasks(b, "c")

	sub := b.subscribe(0)
	if sub.Resumed {
		t.Fatal("a fresh subscription is not a resume")
	}
	if sub.Seq != 4 {
		t.Fatalf("subscription seq = %d, want the broker's position 4", sub.Seq)
	}

	publishTasks(b, "d")
	select {
	case ev := <-sub.Events:
		if ev.Seq != 5 {
			t.Fatalf("live event seq = %d, want 5", ev.Seq)
		}
	case <-time.After(time.Second):
		t.Fatal("no live event after subscribing")
	}
}

func TestBrokerReplaysFromLastSeen(t *testing.T) {
	b := newEventBroker()
	publishTasks(b, "a", "b", "c")

	mid := b.subscribe(1)
	if !mid.Resumed {
		t.Fatal("resume point 1 is in the history, want resumed")
	}
	if got := seqs(mid.Backlog); !seqsEqual(got, 2, 3) {
		t.Fatalf("backlog = %v, want [2 3]", got)
	}

	caught := b.subscribe(3)
	if !caught.Resumed || len(caught.Backlog) != 0 {
		t.Fatalf("resumed = %v, backlog = %d events, want caught up with nothing to replay",
			caught.Resumed, len(caught.Backlog))
	}

	// Live delivery carries on from the replay without a gap or a duplicate.
	publishTasks(b, "d")
	for _, sub := range []*Subscription{mid, caught} {
		select {
		case ev := <-sub.Events:
			if ev.Seq != 4 {
				t.Fatalf("live event seq = %d, want 4", ev.Seq)
			}
		case <-time.After(time.Second):
			t.Fatalf("no live event after subscribing at %d", sub.Seq)
		}
	}
}

func TestBrokerRefusesUnhonourableResumePoints(t *testing.T) {
	b := newEventBroker()
	publishTasks(b, "a", "b")

	// Zero is a fresh start, and one past the end is a client of a previous
	// process — a restarted broker counts from zero again. Neither can be
	// replayed, so both ask for a snapshot.
	for _, after := range []uint64{0, 5} {
		sub := b.subscribe(after)
		if sub.Resumed {
			t.Errorf("resume from %d: resumed = true, want a snapshot request", after)
		}
		if len(sub.Backlog) != 0 {
			t.Errorf("resume from %d: backlog = %d events, want none", after, len(sub.Backlog))
		}
	}
}

func TestBrokerHistoryIsBounded(t *testing.T) {
	b := newEventBroker()
	for i := 0; i < historyLimit+5; i++ {
		b.publishTask(&TaskView{ID: "x"})
	}

	// Events 1 through 5 were evicted; a client whose last seen event was 4
	// is missing evicted event 5 and gets a snapshot, never a replay that
	// quietly starts mid-gap. A client at 5 needs only what is retained.
	if sub := b.subscribe(4); sub.Resumed {
		t.Error("resume point older than the retained history: resumed = true")
	}

	sub := b.subscribe(5)
	if !sub.Resumed {
		t.Fatal("resume point 5 needs only retained events, want resumed")
	}
	if first := sub.Backlog[0].Seq; first != 6 {
		t.Fatalf("first replayed seq = %d, want 6", first)
	}
	if last := sub.Backlog[len(sub.Backlog)-1].Seq; last != historyLimit+5 {
		t.Fatalf("last replayed seq = %d, want %d", last, historyLimit+5)
	}
}

func TestBrokerDropsABlockedSubscriber(t *testing.T) {
	b := newEventBroker()
	blocked := b.subscribe(0)
	keepingUp := b.subscribe(0)

	for i := 0; i < streamBuffer+1; i++ {
		b.publishTask(&TaskView{ID: "x"})
		// One consumer reads as events arrive; the other never does.
		select {
		case <-keepingUp.Events:
		default:
		}
	}

	select {
	case <-blocked.Lost:
	case <-time.After(time.Second):
		t.Fatal("a subscriber whose buffer overflowed was never told")
	}
	select {
	case <-keepingUp.Lost:
		t.Fatal("a keeping-up subscriber was dropped")
	default:
	}
}

func TestBrokerCancelStopsDelivery(t *testing.T) {
	b := newEventBroker()
	sub := b.subscribe(0)
	sub.Cancel()

	publishTasks(b, "a")
	select {
	case ev := <-sub.Events:
		t.Fatalf("cancelled subscriber got event %d", ev.Seq)
	default:
	}
}
