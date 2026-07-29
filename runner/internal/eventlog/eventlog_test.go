package eventlog

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

func TestPublish_FirstSequenceIsOne(t *testing.T) {
	l := New("instance-1", DefaultCapacity)
	ev, err := l.Publish(protocol.EventKindRunnerStarted, protocol.RunnerStartedPayload{})
	if err != nil {
		t.Fatal(err)
	}
	if ev.Sequence != 1 {
		t.Fatalf("expected first sequence to be 1, got %d", ev.Sequence)
	}
}

func TestPublish_MonotonicAndUniqueUnderConcurrentPublishers(t *testing.T) {
	l := New("instance-1", DefaultCapacity)
	const publishers = 50
	const perPublisher = 40

	var wg sync.WaitGroup
	seqs := make(chan uint64, publishers*perPublisher)
	for i := 0; i < publishers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < perPublisher; j++ {
				ev, err := l.Publish(protocol.EventKindClientAuthenticated, protocol.ClientAuthenticatedPayload{ClientID: "c"})
				if err != nil {
					t.Error(err)
					return
				}
				seqs <- ev.Sequence
			}
		}()
	}
	wg.Wait()
	close(seqs)

	seen := make(map[uint64]bool, publishers*perPublisher)
	for s := range seqs {
		if seen[s] {
			t.Fatalf("duplicate sequence %d observed under concurrent publishers", s)
		}
		seen[s] = true
	}
	if len(seen) != publishers*perPublisher {
		t.Fatalf("expected %d unique sequences, got %d", publishers*perPublisher, len(seen))
	}
	if l.LatestSequence() != uint64(publishers*perPublisher) {
		t.Fatalf("expected latest sequence %d, got %d", publishers*perPublisher, l.LatestSequence())
	}
}

func TestSince_EmitsOnlyLaterEvents(t *testing.T) {
	l := New("instance-1", DefaultCapacity)
	for i := 0; i < 5; i++ {
		if _, err := l.Publish(protocol.EventKindRunnerStarted, protocol.RunnerStartedPayload{}); err != nil {
			t.Fatal(err)
		}
	}
	events, gap := l.Since(3)
	if gap {
		t.Fatal("unexpected gap")
	}
	if len(events) != 2 {
		t.Fatalf("expected 2 events after sequence 3, got %d", len(events))
	}
	if events[0].Sequence != 4 || events[1].Sequence != 5 {
		t.Fatalf("unexpected sequences: %+v", events)
	}
}

func TestSince_ReturnsGapWhenRequestedSequenceIsOlderThanRetainedWindow(t *testing.T) {
	l := New("instance-1", 4)
	for i := 0; i < 10; i++ {
		if _, err := l.Publish(protocol.EventKindRunnerStarted, protocol.RunnerStartedPayload{}); err != nil {
			t.Fatal(err)
		}
	}
	// capacity 4, 10 events published: ring retains sequences [7,8,9,10], retainedStart=7.
	if got := l.RetainedStart(); got != 7 {
		t.Fatalf("expected retained start 7, got %d", got)
	}
	if _, gap := l.Since(0); !gap {
		t.Fatal("expected a gap when requesting from before the retained window")
	}
	if _, gap := l.Since(5); !gap {
		t.Fatal("expected a gap: sequence 6 was evicted, so after=5 cannot be honestly served")
	}
	if _, gap := l.Since(6); gap {
		t.Fatal("after=6 (next expected is 7, the oldest retained) must not be a gap")
	}
}

func TestSince_NoGapBeforeAnyEviction(t *testing.T) {
	l := New("instance-1", 4)
	if _, err := l.Publish(protocol.EventKindRunnerStarted, protocol.RunnerStartedPayload{}); err != nil {
		t.Fatal(err)
	}
	if _, gap := l.Since(0); gap {
		t.Fatal("after=0 must never be a gap before any eviction has happened")
	}
}

func TestNotifyChannel_WakesWaiterWithoutBusyPolling(t *testing.T) {
	l := New("instance-1", DefaultCapacity)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	woke := make(chan struct{})
	go func() {
		notify := l.NotifyChannel()
		select {
		case <-notify:
			close(woke)
		case <-ctx.Done():
		}
	}()

	// Give the waiter goroutine a moment to actually be blocked in select
	// before publishing, so this test proves wake-on-publish rather than
	// a lucky race.
	time.Sleep(20 * time.Millisecond)
	if _, err := l.Publish(protocol.EventKindRunnerStarted, protocol.RunnerStartedPayload{}); err != nil {
		t.Fatal(err)
	}

	select {
	case <-woke:
	case <-time.After(1 * time.Second):
		t.Fatal("waiter was not woken by Publish within the timeout — busy-polling substitute or missed broadcast")
	}
}

func TestNotifyChannel_ContextCancellationUnblocksWaiterWithoutAnEvent(t *testing.T) {
	l := New("instance-1", DefaultCapacity)
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		notify := l.NotifyChannel()
		select {
		case <-notify:
			t.Error("notify channel must not fire when no event was published")
		case <-ctx.Done():
		}
		close(done)
	}()

	time.Sleep(20 * time.Millisecond)
	cancel()

	select {
	case <-done:
	case <-time.After(1 * time.Second):
		t.Fatal("cancelling the context did not unblock the waiter (potential goroutine leak on client disconnect)")
	}
}

func TestPublish_InvalidKindPayloadPairsNeverConsumeASequenceOrEnterTheRing(t *testing.T) {
	l := New("instance-1", DefaultCapacity)
	cases := []struct {
		name    string
		kind    protocol.EventKind
		payload interface{}
	}{
		{"wrong payload type for runner_started", protocol.EventKindRunnerStarted, protocol.ClientAuthenticatedPayload{ClientID: "c"}},
		{"wrong payload type for client_authenticated", protocol.EventKindClientAuthenticated, protocol.RunnerStartedPayload{}},
		{"empty client_id", protocol.EventKindClientAuthenticated, protocol.ClientAuthenticatedPayload{ClientID: ""}},
		{"wrong payload type for runner_stopping", protocol.EventKindRunnerStopping, protocol.RunnerStartedPayload{}},
		{"empty stopping reason", protocol.EventKindRunnerStopping, protocol.RunnerStoppingPayload{Reason: ""}},
		{"unknown kind", protocol.EventKind("not_a_real_kind"), protocol.RunnerStartedPayload{}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := l.Publish(c.kind, c.payload); err == nil {
				t.Fatal("expected an error for an invalid kind/payload pair")
			}
		})
	}
	if l.LatestSequence() != 0 {
		t.Fatalf("no invalid publish should ever consume a sequence, got latest sequence %d", l.LatestSequence())
	}
	if l.RetainedStart() != 0 {
		t.Fatalf("no invalid publish should ever enter the ring, got retained start %d", l.RetainedStart())
	}
}

func TestRetainedStart_ZeroWhenEmpty(t *testing.T) {
	l := New("instance-1", DefaultCapacity)
	if got := l.RetainedStart(); got != 0 {
		t.Fatalf("expected 0 for an empty log, got %d", got)
	}
	if got := l.LatestSequence(); got != 0 {
		t.Fatalf("expected latest sequence 0 for an empty log, got %d", got)
	}
}
