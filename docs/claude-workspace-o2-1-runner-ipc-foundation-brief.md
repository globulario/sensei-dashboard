# Claude implementation brief: Workspace O2.1 runner boundary and authenticated IPC foundation

**Status:** Implementation authorized on this PR branch.  
**Target repository:** `globulario/sensei-dashboard`  
**Implementation branch:** `docs/workspace-o2-1-runner-ipc-brief`  
**Base branch:** `main`  
**Base SHA:** `0c5bbd85be4cf9134d253712ffcfb44851e5bced`  
**O1 closure:** Dashboard PR #12, merged from exact approved head `d492e29de6de7590e177b2208f0dffeb74b45bf1`  
**Tracking issue:** #7  
**Architect role:** GPT defines and reviews the contract.  
**Implementer role:** Claude implements, tests, pushes, waits for exact-head CI, posts the required handoff, and stops.

This is **Workspace Phase O2.1**, the first implementation slice after O1 governing-contract closure. It establishes the local runner's process boundary, authenticated transport, versioned wire protocol, and minimal sequenced event foundation. It does not yet run an architect, a worker, Git, Sensei, GitHub, or any arbitrary command.

## 1. Mission

Build the smallest honest foundation on which later O2 slices can place worktree, job, cancellation, recovery, and Sensei-admission behavior:

1. add a separately buildable `sensei-runner` executable;
2. keep it in this repository initially while preserving a clean process and module boundary that permits later extraction;
3. define a closed, versioned local IPC protocol owned by the runner;
4. expose only authenticated loopback endpoints for handshake, status, and a minimal normalized event stream;
5. establish single-instance ownership, deterministic startup/shutdown, and stale descriptor cleanup;
6. generate Dashboard TypeScript consumer types from the protocol schema without connecting the web application to the runner;
7. add exact tests and CI proving the security and lifecycle laws below;
8. stop before O2.2 or any provider, worktree, Sensei, GitHub, Tauri, or UI behavior.

The result is a secure empty engine room: the hull, doors, gauges, and emergency stop exist, but no agent engine has been installed.

## 2. Read first

Treat these as requirements, not inspiration:

- `docs/architecture-workspace-v1.md`, especially §§2, 4, 7, 9, 12, 13, 15, 16, and 20;
- issue #7;
- `docs/claude-workspace-o1-brief.md`;
- `docs/claude-workspace-o1-sensei-pin-parity-brief.md`;
- `contract/workspace/contracts.json`;
- `src/workspace/interfaces/runner-client.ts`;
- `src/workspace/interfaces/shared.ts`;
- `src/workspace/interfaces/provider-event-stream.ts`;
- `docs/workspace-provider-event-v1.schema.json`;
- `.github/workflows/dashboard-app.yml`;
- `.github/workflows/contract-parity.yml`;
- merged PR #11 and PR #12 review history.

Before architecture-sensitive mutation, use the repository's current Sensei workflow. If the repository remains outside the locally available Sensei domain set, record that degraded-awareness limitation in the pre-mutation file envelope and proceed through direct inspection. Empty protection is never evidence of safety.

## 3. Architectural decisions

These decisions are part of the accepted O2.1 contract. Do not silently replace them with a different architecture.

### A. Repository and executable placement

The first runner lives in this repository under a top-level `runner/` directory as a separate Go module and executable:

```text
runner/
  go.mod
  cmd/sensei-runner/
  internal/...
```

The Go module path should be:

```text
github.com/globulario/sensei-dashboard/runner
```

The executable name is:

```text
sensei-runner
```

The Dashboard package must not import runner implementation code. Communication occurs only through the versioned IPC contract.

Keeping the executable in this repository is a delivery decision, not an authority collapse. The code must remain extractable into a separate repository later without changing the wire contract or Dashboard interface.

### B. Language and baseline

Implement the runner in Go using the same Go language baseline as the accepted Sensei source used by O1:

```text
go 1.25.0
```

Why Go is fixed here:

- the runner will later own operating-system process lifecycle, worktrees, leases, cancellation, and filesystem evidence;
- Sensei core and its typed clients are Go;
- a static sidecar executable is a cleaner future Tauri/headless distribution boundary than placing shell authority in browser JavaScript;
- the existing Dashboard remains TypeScript and consumes only generated protocol types.

O2.1 must not import `globulario/sensei` yet. Sensei integration belongs to O2.5.

### C. Transport

Use authenticated HTTP/1.1 over an IPv4 loopback listener only:

```text
127.0.0.1:<ephemeral-or-explicit-port>
```

The default listener is `127.0.0.1:0`, allowing the operating system to choose a free port.

The runner must refuse startup when configured to bind to:

- `0.0.0.0`;
- a non-loopback address;
- a hostname whose resolution is ambiguous;
- a Unix wildcard or external interface;
- an empty host that could imply all interfaces.

Do not add WebSocket, gRPC, Unix-socket, named-pipe, TLS, or browser-direct transport in this slice. The protocol remains transport-versioned so a future native transport can be added without weakening this one.

### D. Authentication ownership

The native launcher is the future owner of secret creation and secure delivery. O2.1 has no Tauri launcher yet, so the runner accepts a required path:

```text
--auth-token-file <path>
```

The file contains a high-entropy bearer token created outside the runner. The runner:

- reads it once at startup;
- requires at least 32 bytes of effective token material;
- rejects a missing, empty, weak, directory, non-regular, or symlink token path;
- on Unix, rejects group- or world-readable token files;
- never copies the token into its descriptor, event payloads, logs, errors, process title, or response body;
- compares supplied credentials in constant time;
- never accepts the token through a query parameter or JSON body.

Every HTTP endpoint requires:

```text
Authorization: Bearer <token>
```

Missing and incorrect credentials must receive the same externally visible typed refusal so the server does not disclose token validity details.

### E. The webview is not an IPC client

The local Dashboard webview must not connect directly to the runner in O2.1.

The server must:

- emit no `Access-Control-Allow-Origin` header;
- reject every request carrying an `Origin` header;
- reject `OPTIONS` requests;
- never provide JSONP, URL-token, cookie, or anonymous-health fallbacks.

A future native/Tauri layer may implement the generated Dashboard-side client. This PR does not.

### F. Foreground lifecycle

The runner stays in the foreground. It does not daemonize itself, install a service, fork into the background, or create a shell launcher.

It must respond to normal process cancellation and `SIGINT`/`SIGTERM` by:

1. entering `stopping` state;
2. publishing the final bounded runner-stopping event;
3. stopping acceptance of new requests;
4. allowing a short bounded graceful-drain interval;
5. closing active event streams;
6. removing its descriptor;
7. releasing its instance lock;
8. exiting without leaving a poisoned state directory.

## 4. Versioned protocol contract

Add one locally authoritative closed JSON Schema:

```text
docs/runner-protocol-v1.schema.json
```

Canonical schema version:

```text
sensei.runner.protocol.v1
```

Add positive and adversarial fixtures under:

```text
docs/fixtures/runner/v1/
```

Add a runner contract inventory:

```text
contract/runner/contracts.json
```

It must record at least:

- protocol id and version;
- owner repository `globulario/sensei-dashboard`;
- producer authority `sensei-runner`;
- consumer `sensei-dashboard-native-client`;
- schema path;
- generated TypeScript target;
- fixture directory;
- transport profile `loopback_http_bearer_v1`;
- state `implemented` after this PR;
- explicit note that browser/webview direct access is prohibited.

Generate:

```text
contract/generated/runner-protocol-v1.ts
```

through the existing deterministic `npm run generate:types` pipeline. The protocol schema is local runner-owned truth, not a Sensei-core pin. Generated output must be fresh, deterministic, and closed. Do not hand-edit it.

### 4.1 Message families

The schema must use a required discriminator such as `message_kind` and closed variants for at least:

- handshake request;
- handshake response;
- runner status;
- runner event;
- typed refusal.

All objects, including nested payload objects, must use `additionalProperties: false`.

All timestamps use UTC RFC3339 with nanosecond-capable formatting. All identifiers are non-empty bounded strings. `runner_instance_id` must be newly generated for each successful process start and must not be reused after restart.

### 4.2 Handshake request

The handshake request must carry at least:

```text
message_kind: handshake_request
schema_version: sensei.runner.protocol.v1
client_id
client_kind
supported_protocol_versions
```

Allowed initial client kinds:

```text
dashboard_native
test_client
```

Unknown client kinds are refused. Browser/web clients are not accepted.

### 4.3 Handshake response

The response must carry at least:

```text
message_kind: handshake_response
schema_version: sensei.runner.protocol.v1
selected_protocol_version
runner_instance_id
started_at
capabilities
latest_event_sequence
```

O2.1 capabilities are exactly bounded to the surfaces that exist:

```text
runner.status
runner.events
```

Do not advertise worktrees, jobs, providers, execution, Sensei, GitHub, authentication flows, cancellation, receipts, or restart recovery.

### 4.4 Runner status

The authenticated status response must carry at least:

```text
message_kind: runner_status
schema_version: sensei.runner.protocol.v1
runner_instance_id
state: ready | stopping
started_at
pid
listen_address
latest_event_sequence
retained_event_start_sequence
```

Status reports runner-local process truth only. It must not claim that a provider, repository, Sensei service, worktree, or job is ready.

### 4.5 Runner event

Each event must carry:

```text
message_kind: runner_event
schema_version: sensei.runner.protocol.v1
runner_instance_id
sequence
emitted_at
kind
payload
```

Initial event kinds are exactly:

```text
runner_started
client_authenticated
runner_stopping
```

Each kind has a closed, kind-specific payload. Do not use an arbitrary string map or provider event payload.

The sequence:

- starts at `1` for each runner instance;
- is strictly monotonic;
- has no duplicate sequence within one instance;
- is assigned by one owner;
- is never based on wall-clock time;
- may reset only when `runner_instance_id` changes.

### 4.6 Typed refusal

Every expected client or protocol failure returns a closed refusal containing at least:

```text
message_kind: refusal
schema_version: sensei.runner.protocol.v1
code
detail
retryable
```

Use stable codes. Required initial cases include:

```text
runner.unauthorized
runner.browser_origin_forbidden
runner.protocol_unsupported
runner.invalid_request
runner.unknown_route
runner.event_gap
runner.stopping
```

Do not serialize raw Go errors, stack traces, filesystem secrets, token data, or internal request objects.

## 5. HTTP surface

Implement exactly these authenticated endpoints:

```text
POST /v1/handshake
GET  /v1/status
GET  /v1/events?after=<uint64>
```

No remote shutdown endpoint is authorized. Process ownership and operating-system signals control shutdown.

### 5.1 Request handling laws

- Require `application/json` for request bodies.
- Bound request bodies to a centralized maximum of at most 64 KiB.
- Reject unknown JSON fields.
- Reject trailing JSON values.
- Reject unsupported protocol versions before returning capabilities.
- Return a typed refusal for every expected error path.
- Set conservative header and idle timeouts.
- Never log the `Authorization` header.
- Never reflect arbitrary client input into logs without bounded escaping.

### 5.2 Event stream

`GET /v1/events` uses newline-delimited JSON with content type:

```text
application/x-ndjson
```

The query parameter `after=N` means: emit only events whose sequence is greater than `N`, then remain connected for new events until the client disconnects or the runner stops.

Maintain a bounded in-memory event ring. A centralized constant of 256 events is acceptable for O2.1.

When `after` is older than the retained window, return HTTP 409 with `runner.event_gap`. Never silently skip missing events and pretend continuity.

The event buffer is intentionally non-durable in O2.1. Durable jobs, leases, receipt reconstruction, and restart recovery belong to later O2 slices. Documentation and status must not imply otherwise.

## 6. Instance ownership and descriptor

Use a runner state directory supplied by:

```text
--state-dir <path>
```

A platform-appropriate default may be added only if it is deterministic and user-private; tests must always use an explicit temporary directory.

The state directory owns:

```text
runner.lock
runner.json
```

### 6.1 Single-instance law

Only one runner may own a state directory at a time.

Use an operating-system-backed file lock, not only a PID file. A second runner using the same state directory must fail before publishing a descriptor or listening as an authoritative instance.

A stale lock file without an active lock is not authority. A valid restart may replace stale descriptor bytes after acquiring the lock.

### 6.2 Descriptor law

After successfully acquiring the lock and binding the listener, atomically publish `runner.json` with at least:

```text
schema_version
protocol_version
runner_instance_id
pid
listen_address
started_at
```

The descriptor must never contain the bearer token or token-file contents.

Publish by write-to-temporary-file, fsync where supported, and atomic rename. Do not expose a partially written descriptor.

On graceful shutdown, remove only the descriptor owned by the current `runner_instance_id`. A stale process must never delete a newer process's descriptor.

## 7. Suggested implementation ownership

Exact filenames may follow Go conventions, but the following owners must remain distinct:

```text
runner/cmd/sensei-runner          CLI composition only
runner/internal/config            validated startup configuration
runner/internal/auth              token loading and constant-time verification
runner/internal/protocol          wire structs and strict codecs
runner/internal/eventlog          sequence owner and bounded ring
runner/internal/ipc               HTTP handlers and stream transport
runner/internal/instance          lock, descriptor, instance identity
runner/internal/app               lifecycle composition and graceful shutdown
```

Do not create one giant `main.go` containing authentication, HTTP routing, event storage, locking, and lifecycle logic.

Production runner code must not import or invoke:

- `os/exec`;
- shell interpreters;
- Git commands;
- provider CLIs or SDKs;
- Sensei packages or binaries;
- GitHub clients;
- Tauri packages;
- browser APIs.

Tests may spawn the compiled runner process to prove process-boundary behavior.

## 8. Dashboard-side boundary

O2.1 may add only protocol-generation and pure interface adjustments required to describe the real foundation.

Allowed:

- generated `SenseiRunnerProtocolV1` types;
- a pure transport-neutral interface for handshake, status, and events if needed;
- documentation that `RunnerClient` remains the future semantic client above the transport layer.

Not allowed:

- a browser fetch client to `127.0.0.1`;
- UI controls;
- Tauri commands;
- automatic runner discovery in the web application;
- provider or job methods that the runner does not implement;
- weakening the existing O1 `RunnerClient` contract to fit the minimal transport.

The static GitHub Pages build must remain fully functional and must not require the runner binary, descriptor, token, port, or Node-only transport code.

## 9. Required tests

Add unit, protocol, integration, and process-boundary tests proving at least the following.

### 9.1 Protocol and generation

- every positive protocol fixture validates;
- adversarial fixtures reject unknown root and nested fields;
- unknown `message_kind` is rejected;
- unsupported schema version is rejected;
- generated TypeScript is fresh and deterministic across two runs;
- generated root and nested types contain no open `any` or `unknown` index signature;
- Go-serialized representative messages validate against the same JSON Schema;
- fixture field names and enum values match Go wire output exactly.

### 9.2 Authentication

- startup refuses a missing token file;
- startup refuses a symlink or non-regular token path;
- startup refuses a token shorter than 32 effective bytes;
- Unix startup refuses a group/world-readable token file;
- every endpoint rejects missing credentials;
- every endpoint rejects incorrect credentials;
- missing and incorrect credentials have the same externally visible refusal;
- the correct credential succeeds;
- token bytes never appear in descriptor, events, responses, or captured logs.

### 9.3 Network boundary

- default bind is loopback-only;
- explicit non-loopback binds are refused before serving;
- requests carrying `Origin` are refused;
- `OPTIONS` is refused;
- responses contain no permissive CORS header;
- unknown routes return `runner.unknown_route`;
- oversized, malformed, trailing, and unknown-field JSON is refused.

### 9.4 Lifecycle and ownership

- descriptor is published only after listener readiness;
- descriptor is complete JSON and never partially observable;
- a second instance cannot own the same state directory;
- a stale descriptor is replaced only after the real lock is acquired;
- graceful shutdown removes the current descriptor and releases the lock;
- restart after clean or simulated stale state succeeds;
- an old instance cannot delete a descriptor belonging to a newer instance;
- `runner_instance_id` changes across restart.

### 9.5 Events

- first sequence is `1`;
- sequences are monotonic and unique under concurrent publishers;
- event kinds and payloads are schema-valid;
- `after=N` emits only later events;
- clients can wait for a later event without busy polling;
- disconnect cancels the waiting stream without leaking a goroutine;
- a request older than the retained ring returns `runner.event_gap`;
- shutdown emits `runner_stopping` before streams close.

### 9.6 Scope proof

- no production runner file imports `os/exec`;
- no runner code invokes Git, Sensei, GitHub, Claude, Codex, Antigravity, shell, PTY, Tauri, or provider SDKs;
- no worktree, job queue, lease, retry engine, receipt store, credential store, or UI entered the diff;
- the existing Dashboard tests and static production build still pass without starting the runner.

## 10. CI and developer commands

Add a separate workflow, suggested path:

```text
.github/workflows/runner.yml
```

It must trigger for runner, runner-protocol, generated-type, and relevant workflow changes without coupling the static Dashboard job to a running sidecar.

Required exact-head commands include at minimum:

```bash
npm ci
npm run verify:pin
npm run generate:types
npm test
npm run typecheck
npm run test:app
npm run build

cd runner
gofmt -w .
go vet ./...
go test ./...
go test -race ./...
go build ./cmd/sensei-runner
```

The implementation must run generation twice and prove no diff. After `gofmt`, no uncommitted formatting change may remain.

CI should use the Go version declared by `runner/go.mod`. Do not weaken or remove the existing `dashboard-app` or `contract-parity` workflows.

## 11. Documentation

Update only what is required to describe the implemented foundation honestly:

- `README.md` with build/test instructions and a warning that the runner currently exposes only authenticated status/events foundation;
- `docs/architecture-workspace-v1.md` with an implementation-status note for O2.1, without rewriting the accepted architecture;
- a concise `runner/README.md` covering startup flags, token ownership, descriptor format, endpoints, and explicit non-capabilities;
- the runner contract inventory and protocol provenance.

Documentation must say:

- O1 is complete;
- O2.1 is only the runner/IPC foundation;
- the event ring is in-memory and non-durable;
- no agent or provider can run yet;
- no repository or Sensei admission is performed yet;
- no webview connection is implemented;
- static GitHub Pages mode remains independent;
- O2.2+ remains locked.

## 12. Explicit non-goals and locked work

Do not implement any of the following in this PR:

- provider detection or authentication;
- Codex app-server;
- Claude Code, Codex, or Antigravity adapters;
- process or PTY execution;
- shell-command construction;
- repository selection or initialization;
- Git status, checkout, commit, push, or worktree operations;
- jobs, queues, leases, retries, durable event storage, or restart reconstruction;
- cancellation of jobs or commands;
- Sensei MCP startup or attachment;
- workspace identity, preflight, admission, completion, or audit calls;
- GitHub API or `gh` execution;
- Tauri commands, packaging, tray behavior, autostart, or service installation;
- Dashboard workspace UI;
- remote access, LAN binding, TLS, cloud relay, Globular placement, or distributed workers;
- automatic merge.

These remain gated:

- **O2.2:** durable job and lease state, cancellation model, restart reconstruction;
- **O2.3:** exact-SHA worktree manager and cleanup;
- **O2.4:** normalized job events and execution-receipt assembly;
- **O2.5:** Sensei workspace identity, MCP verification, and admission gate;
- **O3:** embedded OpenAI architect;
- **O4:** governed GitHub architect actions;
- **O5:** worker providers;
- **O6:** unified workspace UI;
- **O7:** packaging, sandboxing, headless/distributed hardening.

## 13. Stop conditions

Post `ARCHITECT QUESTION` and stop the affected portion rather than inventing an answer when:

- secure token delivery would require putting token bytes in the descriptor, URL, browser storage, or webview;
- loopback-only binding cannot be proved fail-closed;
- a platform cannot enforce the claimed token-file safety and the implementation would otherwise claim equivalent protection;
- the chosen lock cannot distinguish a stale file from an active owner;
- protocol generation requires editing output by hand;
- Go wire output cannot be reconciled exactly with the JSON Schema;
- event continuity would require pretending the in-memory ring is durable;
- fulfilling a requirement would require worktree, provider, Sensei, GitHub, Tauri, UI, or arbitrary process behavior;
- the existing static Dashboard build would acquire a runtime dependency on the runner;
- the repository's current O1 contracts or pinned Sensei artifacts would need semantic changes.

A bounded platform limitation is reportable. A false security claim is not acceptable.

## 14. Claude protocol

Claude should:

1. read this brief and all required sources;
2. inspect exact `main` at `0c5bbd85be4cf9134d253712ffcfb44851e5bced`;
3. post an `INTENDED FILE ENVELOPE (pre-mutation)` comment on this PR;
4. identify any degraded Sensei coverage honestly;
5. implement directly on this same PR branch;
6. keep the diff inside O2.1;
7. run all required commands from a clean exact head;
8. push the exact final head;
9. wait for every required CI check on that exact head;
10. post `IMPLEMENTATION READY FOR ARCHITECT REVIEW` using the evidence template below;
11. stop without merging and without beginning O2.2.

Do not replace this brief with a different architecture. Human merge authority remains final.

## 15. Required handoff template

```text
IMPLEMENTATION READY FOR ARCHITECT REVIEW

Workspace O2.1 runner/IPC foundation:
- accepted brief path + commit:
- Dashboard base SHA:
- final Dashboard head SHA:
- runner module path:
- Go version:
- executable path:
- protocol schema path + digest:
- generated TypeScript path + digest:
- runner contract inventory path:
- protocol fixtures and validation summary:
- transport and loopback proof:
- token-file validation and secrecy proof:
- Origin/CORS refusal proof:
- instance lock and descriptor proof:
- lifecycle and stale-state proof:
- event sequence/ring/gap proof:
- Go unit/integration/race/build results:
- npm generation/test/typecheck/build results:
- exact-head CI results:
- Sensei admission/completion evidence or degraded-awareness limitation:
- platform limitations:
- deviations or open questions:
- explicit proof that no O2.2+, provider, worktree, Sensei, GitHub, Tauri, UI, or arbitrary execution behavior entered the diff:
```

## 16. Completion rule

O2.1 is complete only after:

1. Claude posts the exact-head implementation handoff;
2. the architect reviews that same exact head;
3. all required CI is green on that exact head;
4. the architect explicitly approves it;
5. the human merges the approved head;
6. O2.1 is explicitly declared closed.

Merging O2.1 does not authorize O2.2 automatically. The next slice begins only through its own bounded architect-approved brief.
