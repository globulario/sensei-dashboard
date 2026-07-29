package protocol

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

// MaxRequestBodyBytes bounds every request body this protocol accepts
// (brief §5.1: "Bound request bodies to a centralized maximum of at most
// 64 KiB"). One constant, not a per-handler magic number.
const MaxRequestBodyBytes = 64 * 1024

// ErrBodyTooLarge is returned by DecodeStrict when the body exceeds
// MaxRequestBodyBytes.
var ErrBodyTooLarge = errors.New("protocol: request body exceeds the maximum allowed size")

// ErrTrailingData is returned by DecodeStrict when the body contains more
// than one JSON value (brief §5.1: "Reject trailing JSON values").
var ErrTrailingData = errors.New("protocol: request body contains trailing data after the JSON value")

// DecodeStrict decodes exactly one JSON value from r into v, rejecting
// unknown fields, oversized bodies, and trailing data. It is the single
// place request-body decoding strictness is enforced, so every handler
// gets the same guarantees without repeating decoder setup.
func DecodeStrict(r io.Reader, v interface{}) error {
	limited := io.LimitReader(r, MaxRequestBodyBytes+1)
	body, err := io.ReadAll(limited)
	if err != nil {
		return fmt.Errorf("protocol: reading request body: %w", err)
	}
	if len(body) > MaxRequestBodyBytes {
		return ErrBodyTooLarge
	}

	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("protocol: decoding request body: %w", err)
	}
	if dec.More() {
		return ErrTrailingData
	}
	return nil
}

// EncodeEventPayload marshals a closed, kind-specific payload struct
// (RunnerStartedPayload, ClientAuthenticatedPayload, RunnerStoppingPayload)
// into the json.RawMessage RunnerEvent.Payload carries on the wire.
func EncodeEventPayload(payload interface{}) (json.RawMessage, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("protocol: encoding event payload: %w", err)
	}
	return raw, nil
}

// DecodeEventPayload strictly decodes a RunnerEvent's payload into the
// closed struct matching its EventKind, rejecting any field the schema
// does not declare for that specific kind. Callers pass EventKind so this
// package remains the single source of truth for the kind-to-shape
// mapping, rather than duplicating a switch at each call site.
func DecodeEventPayload(kind EventKind, payload json.RawMessage) (interface{}, error) {
	var target interface{}
	switch kind {
	case EventKindRunnerStarted:
		target = &RunnerStartedPayload{}
	case EventKindClientAuthenticated:
		target = &ClientAuthenticatedPayload{}
	case EventKindRunnerStopping:
		target = &RunnerStoppingPayload{}
	default:
		return nil, fmt.Errorf("protocol: unknown event kind %q", kind)
	}
	if err := DecodeStrict(bytes.NewReader(payload), target); err != nil {
		return nil, err
	}
	return target, nil
}
