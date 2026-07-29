// Package ipc implements the authenticated loopback HTTP surface: POST
// /v1/handshake, GET /v1/status, GET /v1/events (docs/claude-workspace-
// o2-1-runner-ipc-foundation-brief.md §5). It owns request handling,
// authentication enforcement, and the Origin/CORS/OPTIONS refusal that
// keeps the webview from being an IPC client in O2.1 (brief §E).
package ipc

import (
	"net/http"
	"strings"

	"github.com/globulario/sensei-dashboard/runner/internal/auth"
	"github.com/globulario/sensei-dashboard/runner/internal/eventlog"
	"github.com/globulario/sensei-dashboard/runner/internal/protocol"
)

// Deps is everything the HTTP surface needs from the rest of the runner.
// ipc never constructs any of these itself -- they are owned by auth,
// eventlog, and app respectively.
type Deps struct {
	Token         *auth.Token
	Events        *eventlog.Log
	InstanceID    string
	StartedAt     string
	PID           int
	ListenAddress func() string
	State         func() protocol.RunnerState
}

type server struct {
	Deps
}

// NewHandler builds the complete authenticated HTTP handler: Origin/OPTIONS
// guards, then bearer-auth, then routing to exactly the three endpoints
// brief §5 authorizes. No other route or method is served.
func NewHandler(d Deps) http.Handler {
	s := &server{Deps: d}

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/handshake", s.withAuth(s.handleHandshake))
	mux.HandleFunc("/v1/status", s.withAuth(s.handleStatus))
	mux.HandleFunc("/v1/events", s.withAuth(s.handleEvents))
	mux.HandleFunc("/", s.withAuth(s.handleUnknownRoute))

	return withBrowserGuards(mux)
}

// withBrowserGuards refuses every request carrying an Origin header and
// every OPTIONS request, before any routing or authentication happens
// (brief §E). It never emits Access-Control-Allow-Origin or any other
// CORS header.
func withBrowserGuards(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") != "" {
			writeRefusal(w, protocol.NewRefusal(protocol.RefusalBrowserOriginForbidden, "requests carrying an Origin header are refused", false))
			return
		}
		if r.Method == http.MethodOptions {
			writeRefusal(w, protocol.NewRefusal(protocol.RefusalBrowserOriginForbidden, "OPTIONS requests are refused", false))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// withAuth requires a valid `Authorization: Bearer <token>` header before
// calling h. Missing and incorrect credentials both produce
// unauthorizedRefusal()'s byte-identical body.
func (s *server) withAuth(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const prefix = "Bearer "
		authHeader := r.Header.Get("Authorization")
		supplied, ok := strings.CutPrefix(authHeader, prefix)
		if !ok || !s.Token.Verify(supplied) {
			writeRefusal(w, unauthorizedRefusal())
			return
		}
		h(w, r)
	}
}

func (s *server) handleUnknownRoute(w http.ResponseWriter, r *http.Request) {
	writeRefusal(w, protocol.NewRefusal(protocol.RefusalUnknownRoute, "no such endpoint: "+r.Method+" "+r.URL.Path, false))
}
