package ipc

import (
	"encoding/json"
	"net/http"

	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

func statusForCode(code protocol.RefusalCode) int {
	switch code {
	case protocol.RefusalUnauthorized:
		return http.StatusUnauthorized
	case protocol.RefusalBrowserOriginForbidden:
		return http.StatusForbidden
	case protocol.RefusalProtocolUnsupported:
		return http.StatusBadRequest
	case protocol.RefusalInvalidRequest:
		return http.StatusBadRequest
	case protocol.RefusalUnknownRoute:
		return http.StatusNotFound
	case protocol.RefusalEventGap:
		return http.StatusConflict
	case protocol.RefusalStopping:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeRefusal(w http.ResponseWriter, r *protocol.Refusal) {
	writeJSON(w, statusForCode(r.Code), r)
}

// unauthorizedRefusal is a single shared constructor so missing and
// incorrect credentials produce a byte-identical response body (brief
// §D: "the same externally visible typed refusal so the server does not
// disclose token validity details").
func unauthorizedRefusal() *protocol.Refusal {
	return protocol.NewRefusal(protocol.RefusalUnauthorized, "missing or invalid bearer credentials", false)
}
