# sensei-runner (Workspace O2.1: runner/IPC foundation)

`sensei-runner` is the local process boundary for the future AI Architecture
Workspace (`docs/architecture-workspace-v1.md`). This module implements
**Phase O2.1 only**: the runner's process lifecycle, authenticated local
transport, and a minimal wire protocol. It does not yet run an architect, a
worker, Git, Sensei, or GitHub -- see [Non-capabilities](#non-capabilities-o21)
below.

## Building and running

```bash
cd runner
go build ./cmd/sensei-runner
```

`sensei-runner` requires an externally created bearer token file and a
writable state directory:

```bash
# The native launcher (not yet implemented) is the future owner of secure
# token creation and delivery. For now, create one yourself:
head -c 32 /dev/urandom | base64 > /tmp/sensei-runner-token

./sensei-runner \
  --auth-token-file /tmp/sensei-runner-token \
  --state-dir /tmp/sensei-runner-state \
  --listen 127.0.0.1:0
```

Flags:

| Flag | Required | Default | Meaning |
|---|---|---|---|
| `--auth-token-file` | yes | -- | Path to a file containing the bearer token. Must be a regular file, not a symlink or directory, at least 32 effective bytes, and (on Unix) not group- or world-readable. |
| `--state-dir` | yes | -- | Directory the runner owns exclusively for `runner.lock` and `runner.json`. |
| `--listen` | no | `127.0.0.1:0` | IPv4 loopback address to bind. Any non-loopback, IPv6, wildcard, or ambiguous-hostname value is refused at startup. |

The runner stays in the foreground. Stop it with `SIGINT`/`SIGTERM` (`Ctrl-C`).

## Token ownership and secrecy

- The token file is read exactly once, at startup.
- Token bytes never appear in the descriptor, event payloads, logs, error
  messages, the process title, or any HTTP response body.
- Every request must carry `Authorization: Bearer <token>`; missing and
  incorrect credentials receive the exact same typed refusal, so the server
  never discloses whether a supplied credential was merely wrong or entirely
  absent.
- Credential comparison is constant-time.

## Descriptor (`runner.json`)

Published atomically (write-temp-file, fsync, rename) only after the
listener is bound and the single-instance lock is held:

```json
{
  "schema_version": "sensei.runner.descriptor.v1",
  "protocol_version": "1",
  "runner_instance_id": "runner-instance-...",
  "pid": 12345,
  "listen_address": "127.0.0.1:54321",
  "started_at": "2026-07-29T13:00:00Z"
}
```

It never contains the bearer token. On graceful shutdown, the runner
removes only the descriptor it itself owns (matched by
`runner_instance_id`) -- a stale or crashed instance can never delete a
newer instance's descriptor.

## Single-instance ownership

`runner.lock` is an OS-backed advisory lock (`flock(2)` on Unix), not a
plain PID file: a leftover lock *file* from a crashed process holds no
authority, but a live process's actual lock cannot be bypassed by starting
a second instance against the same `--state-dir`.

**Platform limitation, honestly reported:** the OS-backed lock is
implemented for Unix-family platforms only. On any other platform the
runner refuses to start (fails closed) rather than silently running
without real single-instance protection. The Unix-specific
group/world-readable token-file check has the same honest scope.

## Wire protocol

`docs/runner-protocol-v1.schema.json` (`schema_version:
"sensei.runner.protocol.v1"`) is the closed, versioned contract. Generated
consumer types live at `contract/generated/runner-protocol-v1.ts`.

Endpoints -- authenticated HTTP/1.1 over IPv4 loopback only, exactly these
three, nothing else:

```text
POST /v1/handshake     negotiate protocol version, learn capabilities
GET  /v1/status        runner-local process state (never provider/repo/Sensei readiness)
GET  /v1/events        application/x-ndjson, ?after=<uint64>, bounded 256-event ring
```

No CORS is ever offered: the server refuses any request carrying an
`Origin` header and refuses every `OPTIONS` request. **The webview is not
an IPC client in O2.1** -- only a future native/Tauri layer may implement
the generated Dashboard-side client against this transport.

The event ring is a bounded (256-entry), **in-memory, non-durable** log.
Requesting `after=N` for a sequence older than the retained window returns
`409` with `runner.event_gap` rather than silently skipping events and
pretending continuity. Restarting the runner starts a fresh sequence space
under a new `runner_instance_id` -- nothing here survives a restart.

## Non-capabilities (O2.1)

This foundation deliberately does **not**:

- detect, authenticate, or launch any provider (Claude Code, Codex,
  Antigravity);
- execute any process, shell command, or PTY;
- perform any Git or worktree operation;
- start, verify, or call Sensei MCP, workspace identity, preflight, or
  admission;
- call the GitHub API or `gh`;
- persist jobs, leases, queues, retries, or execution receipts;
- offer any Tauri, packaging, tray, or autostart behavior;
- accept a connection from a browser/webview.

Every one of the above is explicitly out of scope for this phase and
gated behind its own future architect-approved brief
(`docs/architecture-workspace-v1.md` §16).
