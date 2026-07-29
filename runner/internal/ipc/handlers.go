package ipc

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

func (s *server) handleHandshake(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeRefusal(w, protocol.NewRefusal(protocol.RefusalUnknownRoute, "POST /v1/handshake only", false))
		return
	}
	if ct := r.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		writeRefusal(w, protocol.NewRefusal(protocol.RefusalInvalidRequest, "Content-Type must be application/json", false))
		return
	}

	var req protocol.HandshakeRequest
	if err := protocol.DecodeStrict(r.Body, &req); err != nil {
		writeRefusal(w, protocol.NewRefusal(protocol.RefusalInvalidRequest, "malformed handshake request body", false))
		return
	}
	if refusal := req.Validate(); refusal != nil {
		writeRefusal(w, refusal)
		return
	}

	resp := protocol.HandshakeResponse{
		MessageKind:             protocol.MessageKindHandshakeResponse,
		SchemaVersion:           protocol.SchemaVersion,
		SelectedProtocolVersion: protocol.CurrentProtocolVersion,
		RunnerInstanceID:        s.InstanceID,
		StartedAt:               s.StartedAt,
		Capabilities:            []protocol.Capability{protocol.CapabilityRunnerStatus, protocol.CapabilityRunnerEvents},
		LatestEventSequence:     s.Events.LatestSequence(),
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeRefusal(w, protocol.NewRefusal(protocol.RefusalUnknownRoute, "GET /v1/status only", false))
		return
	}

	resp := protocol.RunnerStatus{
		MessageKind:                protocol.MessageKindRunnerStatus,
		SchemaVersion:              protocol.SchemaVersion,
		RunnerInstanceID:           s.InstanceID,
		State:                      s.State(),
		StartedAt:                  s.StartedAt,
		PID:                        s.PID,
		ListenAddress:              s.ListenAddress(),
		LatestEventSequence:        s.Events.LatestSequence(),
		RetainedEventStartSequence: s.Events.RetainedStart(),
	}
	writeJSON(w, http.StatusOK, resp)
}

// handleEvents serves GET /v1/events?after=N as newline-delimited JSON
// (brief §5.2). It emits every retained event with sequence > after, then
// stays connected -- waking via the eventlog's broadcast channel, never by
// busy-polling -- until the client disconnects or the request context is
// cancelled (runner shutdown).
func (s *server) handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeRefusal(w, protocol.NewRefusal(protocol.RefusalUnknownRoute, "GET /v1/events only", false))
		return
	}

	var after uint64
	if raw := r.URL.Query().Get("after"); raw != "" {
		v, err := strconv.ParseUint(raw, 10, 64)
		if err != nil {
			writeRefusal(w, protocol.NewRefusal(protocol.RefusalInvalidRequest, "after must be a non-negative integer", false))
			return
		}
		after = v
	}

	events, gap := s.Events.Since(after)
	if gap {
		writeRefusal(w, protocol.NewRefusal(protocol.RefusalEventGap, "requested sequence is older than the retained event window", false))
		return
	}

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.WriteHeader(http.StatusOK)
	flusher, canFlush := w.(http.Flusher)
	enc := json.NewEncoder(w)

	write := func(evs []protocol.RunnerEvent) bool {
		for _, ev := range evs {
			if err := enc.Encode(ev); err != nil {
				return false
			}
		}
		if canFlush {
			flusher.Flush()
		}
		return true
	}

	if !write(events) {
		return
	}
	if len(events) > 0 {
		after = events[len(events)-1].Sequence
	}

	ctx := r.Context()
	for {
		notify := s.Events.NotifyChannel()
		select {
		case <-ctx.Done():
			return
		case <-notify:
			more, gap := s.Events.Since(after)
			if gap {
				// Streaming has already started with a 200 response, so a
				// mid-stream gap (unreachable in practice, since `after`
				// only ever advances to sequences we have already
				// observed) cannot be reported as a fresh 409. Close the
				// stream rather than silently claim continuity.
				return
			}
			if !write(more) {
				return
			}
			if len(more) > 0 {
				after = more[len(more)-1].Sequence
			}
		}
	}
}
