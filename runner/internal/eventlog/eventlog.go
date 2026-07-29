// Package eventlog is the single owner of runner event sequencing and the
// bounded in-memory event ring (docs/claude-workspace-o2-1-runner-ipc-
// foundation-brief.md §4.5, §5.2). It deliberately does not persist
// anything: the ring is intentionally non-durable in O2.1, and this
// package must never pretend otherwise (brief §5.2's explicit warning
// against claiming continuity the ring cannot provide).
package eventlog

import (
	"sync"
	"time"

	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

// DefaultCapacity is the centralized bounded-ring size (brief §5.2: "A
// centralized constant of 256 events is acceptable for O2.1").
const DefaultCapacity = 256

// Log is the single sequence owner for one runner instance's events. All
// methods are safe for concurrent use; sequence assignment and ring
// mutation happen under one mutex so sequences stay strictly monotonic and
// unique even when publishers race (proven under `go test -race`).
type Log struct {
	instanceID string
	capacity   int

	mu           sync.Mutex
	ring         []protocol.RunnerEvent
	nextSequence uint64
	notifyCh     chan struct{}
}

// New creates a Log for one runner instance. Sequences for this instance
// start at 1, per brief §4.5 ("starts at 1 for each runner instance"); a
// new Log (and therefore a fresh sequence space) is created only when
// runner_instance_id changes, i.e. on process restart.
func New(instanceID string, capacity int) *Log {
	if capacity <= 0 {
		capacity = DefaultCapacity
	}
	return &Log{
		instanceID:   instanceID,
		capacity:     capacity,
		nextSequence: 1,
		notifyCh:     make(chan struct{}),
	}
}

// Publish assigns the next sequence, appends the event to the bounded
// ring (evicting the oldest entry if at capacity), and wakes every current
// waiter. It is the only way a sequence number is minted -- there is no
// other path to append to the ring.
//
// kind and payload are validated against the protocol's closed
// kind-to-payload pairing BEFORE any sequence is assigned or the lock is
// even taken: an unknown kind, a mismatched payload type, or an
// otherwise-invalid payload (e.g. an empty required field) never
// consumes a sequence or enters the authoritative ring.
func (l *Log) Publish(kind protocol.EventKind, payload interface{}) (protocol.RunnerEvent, error) {
	if err := protocol.ValidateEventPayloadType(kind, payload); err != nil {
		return protocol.RunnerEvent{}, err
	}
	raw, err := protocol.EncodeEventPayload(payload)
	if err != nil {
		return protocol.RunnerEvent{}, err
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	seq := l.nextSequence
	l.nextSequence++

	ev := protocol.RunnerEvent{
		MessageKind:      protocol.MessageKindRunnerEvent,
		SchemaVersion:    protocol.SchemaVersion,
		RunnerInstanceID: l.instanceID,
		Sequence:         seq,
		EmittedAt:        time.Now().UTC().Format(time.RFC3339Nano),
		Kind:             kind,
		Payload:          raw,
	}

	l.ring = append(l.ring, ev)
	if len(l.ring) > l.capacity {
		l.ring = l.ring[1:]
	}

	close(l.notifyCh)
	l.notifyCh = make(chan struct{})

	return ev, nil
}

// Since returns every retained event with sequence strictly greater than
// after, and whether the request is a gap: after refers to an event
// sequence that has already been evicted from the retained window, so
// continuity cannot be honestly guaranteed (brief §5.2: "Never silently
// skip missing events and pretend continuity").
func (l *Log) Since(after uint64) (events []protocol.RunnerEvent, gap bool) {
	l.mu.Lock()
	defer l.mu.Unlock()

	retainedStart := l.retainedStartLocked()
	if retainedStart != 0 && after < retainedStart-1 {
		return nil, true
	}

	result := make([]protocol.RunnerEvent, 0, len(l.ring))
	for _, ev := range l.ring {
		if ev.Sequence > after {
			result = append(result, ev)
		}
	}
	return result, false
}

// NotifyChannel returns the current wake channel. It is closed exactly
// once, the next time Publish is called, then replaced -- callers should
// re-check Since after every receive rather than assuming exactly one new
// event arrived, since Publish may run again before a waiter re-selects.
// This is the broadcast-without-busy-polling primitive every streaming
// caller (the NDJSON handler, tests) builds on.
func (l *Log) NotifyChannel() <-chan struct{} {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.notifyCh
}

// LatestSequence returns the most recently assigned sequence, or 0 if no
// event has been published yet.
func (l *Log) LatestSequence() uint64 {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.nextSequence - 1
}

// RetainedStart returns the sequence of the oldest event still retained in
// the ring, or 0 if the ring is empty.
func (l *Log) RetainedStart() uint64 {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.retainedStartLocked()
}

func (l *Log) retainedStartLocked() uint64 {
	if len(l.ring) == 0 {
		return 0
	}
	return l.ring[0].Sequence
}
