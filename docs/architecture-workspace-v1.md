# Sensei Dashboard AI Architecture Workspace V1

**Status:** Design extension contract  
**Tracking issue:** #7  
**Audience:** Sensei core maintainers, dashboard implementers, runner implementers, provider-adapter authors, agent reviewers

## 1. Purpose

Sensei Dashboard begins as a human-scale architectural observatory. This extension adds a local AI-assisted architecture workspace without replacing or weakening that observatory.

The goal is to let a human and a primary AI architect think together inside the Dashboard, create and review governed GitHub work, and delegate bounded implementation to locally authenticated agent providers.

The product is not merely a visualization with an agent button. It is a workspace for architectural reasoning with AI tooling:

1. The human discusses architecture with a persistent primary architect.
2. The architect reads the selected repository through Sensei, inspects GitHub, writes plans and contracts, creates draft PRs, and reviews exact implementation SHAs.
3. The human selects Claude Code, Codex, or Antigravity as a bounded worker.
4. A local runner prepares an exact-SHA worktree, proves that it is Sensei-initialized, attaches the correct checkout-bound Sensei MCP service, runs required preflight and admission, and only then starts the worker.
5. GitHub records contracts, commits, CI, review findings, approvals, and merge history.
6. The human retains final merge authority.

This should replace the current manual relay among ChatGPT, GitHub, terminals, Claude, Codex, and Antigravity without collapsing their separate responsibilities.

## 2. Relationship to the existing Dashboard contract

This document extends `architecture-dashboard-v1.md`; it does not invalidate it.

The existing projection path remains:

```text
Sensei projection
    -> ProjectionAdapter
        -> Overview / Map / Focus / Evolution
```

The architecture workspace is added beside that path:

```text
Sensei Dashboard UI
    |- ProjectionAdapter
    |    |- static snapshot
    |    `- live Sensei adapter
    |
    `- RunnerClient
         `- sensei-runner
              |- primary architect runtime
              |- worker-provider adapters
              |- GitHub gateway
              |- worktree manager
              |- Sensei initialization and admission
              |- Sensei MCP session manager
              `- execution and evidence receipts
```

Static GitHub Pages mode remains read-only and free of local-runner dependencies. Local execution is available only through the local/Tauri application and its authenticated runner.

The immutable projection contract must not acquire mutable conversation, authentication, process, or execution state.

### 2.1 Relationship to existing manual Sensei sessions

Before `sensei-runner` exists, architecture-sensitive work already happens through manually configured local sessions: an editor or CLI agent (for example Claude Code) connected to a bare `awareness-mcp` bridge via a project-local `.mcp.json`, following the informal discipline in `CLAUDE.md`/`AGENTS.md` (briefing before high-risk edits, `sensei propose` for durable feedback, no enforced admission gate). PR #6 of this repository was implemented and PR #8 itself was reviewed through exactly that path.

This extension does not retroactively invalidate that mode, and Phase O1 does not remove it. Manual sessions remain a supported, lower-assurance path: useful for exploration, review, and low-risk changes, but without the workspace-identity proof, admission gate, or exact-SHA worktree isolation this contract requires for a **governed** run. A future phase may tighten this — for example by teaching `sensei-runner` to also supervise manually launched sessions, or by deprecating the bare bridge for architecture-sensitive mutation once the runner is proven — but that transition is itself a future architectural decision, not an implicit consequence of this document. Until an explicit decision says otherwise, "governed" (admission-gated, receipt-producing) and "manual" (CLI/editor-direct) remain two distinct, coexisting ways to work in a Sensei-initialized repository, and the Dashboard/runner UI must never present a manual session's output as if it had passed admission.

## 3. Product thesis

Traditional AI coding tools center the code-editing session. Sensei Dashboard should center the architectural conversation.

The primary experience is:

```text
human + AI architect
    -> understand architectural state
    -> identify a bounded problem
    -> commit a governing contract
    -> delegate implementation
    -> observe evidence and CI
    -> review the exact result
    -> human merge decision
```

The architecture map, Focus view, decisions, contracts, risks, and evidence are not decoration around the chat. They are the shared visual and semantic reference used during the architectural discussion.

The AI architect is primary for planning and review. Worker providers are replaceable execution engines. Sensei remains the authority that determines whether the repository context is current and whether a proposed action is admitted.

## 4. Authority boundaries

### 4.1 Sensei core owns architectural truth

Sensei owns:

- repository and canonical domain identity
- revision and graph-generation identity
- architectural projections
- graph authority and freshness
- protection coverage
- briefing, impact, preflight, admission, audit, and completion verification
- typed workspace identity exposed through MCP
- refusal when state is stale, malformed, degraded, mismatched, or unavailable

Sensei must not infer that an authenticated model is authorized to operate. Authentication and admission are separate facts.

### 4.2 Sensei Dashboard owns communication and operator control

The Dashboard owns:

- architecture visualization and progressive disclosure
- persistent architect-conversation UX
- provider connection and readiness UX
- run queue, approvals, progress, evidence, and handoff presentation
- explicit selection of architect and worker roles
- clear presentation of unauthenticated, authenticating, ready, expired, blocked, stale, partial, degraded, unavailable, and cancelled states

The Dashboard must not:

- infer architectural truth
- query raw RDF or issue SPARQL
- silently repair malformed Sensei state
- treat absent evidence as safety
- execute unrestricted shell commands from the webview
- become the credential owner for provider accounts

### 4.3 `sensei-runner` owns local orchestration

The runner owns:

- local process and PTY lifecycle
- provider detection and authentication initiation
- exact-SHA worktree creation and cleanup
- job leases, cancellation, and restart recovery
- provider-specific configuration and invocation
- local GitHub operations under explicit policy
- Sensei initialization, MCP verification, and admission gating
- normalized run events
- execution, evidence, and publication receipts

The runner is a separate local service or daemon connected through authenticated local IPC. The Tauri webview must not receive arbitrary shell authority.

### 4.4 Primary AI architect owns architectural procedure

The architect owns:

- architectural discussion
- investigation grounded in Sensei and GitHub
- plan and contract authoring
- issue and draft-PR preparation
- exact-SHA review
- bounded correction requests
- architectural approval

The architect may not:

- silently merge
- bypass Sensei admission
- fabricate evidence
- rewrite the governing contract during implementation without an explicit architectural amendment
- treat model memory as repository authority

### 4.5 Worker agent owns bounded execution

A worker owns:

- investigation or implementation within an admitted job envelope
- required tests and evidence collection
- exact-SHA implementation handoff

A worker is never the owner of the architectural contract it implements. It must stop and return an architectural question when the contract is contradictory, incomplete, or requires new semantics.

### 4.6 Human maintainer owns final authority

The human owns:

- provider selection and permissions
- genuinely open architectural decisions
- acceptance of proposed plans and contracts
- authorization of high-impact GitHub actions
- final merge authority

## 5. Primary architect runtime

The first embedded primary architect uses `codex app-server`.

It is selected because it offers a programmatic local interface for:

- authentication with a regular ChatGPT account
- persistent thread creation, resume, list, and fork
- streamed assistant, command, approval, and tool events
- local workspace execution
- MCP integration and server status
- provider/account readiness
- a protocol suitable for integration behind Tauri

The Dashboard presents an explicit connection flow:

```text
OpenAI Architect
Status: Not connected
[ Sign in with ChatGPT ]
```

The runner starts the app-server authentication flow, opens the returned browser URL, waits for the native runtime to complete authentication, and then verifies readiness. Sensei Dashboard records readiness metadata only; it never reads or stores OpenAI tokens.

An embedded architect thread is not the same storage surface as an ordinary ChatGPT web conversation. The product must not claim otherwise.

Continuity is reconstructed from durable project state:

- Sensei graph, claims, decisions, contracts, and accepted architectural laws
- GitHub issues, PRs, comments, reviews, CI, and exact SHAs
- project-specific architect profile and bounded summaries
- current repository and task state

This is preferable to making one private chat transcript the sole carrier of architectural history.

## 6. Provider model

Initial providers:

1. **OpenAI architect** through Codex app-server and normal ChatGPT sign-in.
2. **Claude Code worker** through Claude Code's own authentication and local runtime.
3. **Codex worker** through its own authenticated local runtime.
4. **Antigravity worker** through its own Google authentication and local runtime.

Provider credentials remain owned by native provider runtimes. The Dashboard and runner may know only:

- installed or absent
- authentication state
- account/provider mode when explicitly exposed
- readiness
- expiration or reauthentication requirement
- supported capabilities

Shared contracts include:

```text
ArchitectRuntime
AgentProvider
AuthSession
ProviderStatus
ProviderCapabilities
AgentRun
AgentEvent
```

Capabilities are explicit. The common abstraction must not pretend providers have identical authentication, MCP, streaming, resume, sandboxing, approval, or structured-output support.

A provider capability record should include at least:

```text
interactive_auth
browser_auth
headless_execution
streaming_output
session_resume
mcp
skills
sandboxing
command_approvals
file_approvals
structured_output
```

## 7. Mandatory Sensei workspace admission

No architect or worker may operate on a repository until the runner proves all required workspace facts for the exact worktree.

Required checks:

1. The repository is Sensei-initialized.
2. `.sensei/config.yaml` exists and is readable.
3. `repository.domain` is valid and canonical.
4. Repository root, domain, revision, base SHA, and head SHA are known.
5. Graph/projection state is current enough for the requested operation.
6. Protection coverage satisfies the operation policy.
7. A checkout-bound Sensei MCP service is running or attached.
8. Required MCP tools are discovered.
9. A typed workspace identity call succeeds.
10. Returned MCP identity matches the expected repository, root, domain, revision, generation, and job.
11. Required preflight and mutation admission have succeeded.

Configured is not connected. A server entry in a provider configuration is not proof that tools were injected or that the correct server answered.

A workspace identity tool such as `sensei_workspace_status` should return a typed receipt:

```json
{
  "status": "READY",
  "repository_domain": "github.com/owner/repository",
  "repository_root_identity": "sha256:...",
  "base_sha": "...",
  "head_sha": "...",
  "graph_state": "CURRENT",
  "protection_state": "COMPLETE",
  "generation_identity": "sha256:...",
  "server_session": "job-..."
}
```

Any mismatch produces a typed refusal such as `AGENT_START_REFUSED`.

The architect skill and worker instruction also perform a first-action self-check through MCP. The runner gate prevents launch; the agent gate prevents an already-running session from proceeding under mismatched context.

`graph_state`, `protection_state`, and `generation_identity` above are illustrative, not a claim that Sensei core's MCP surface already exposes them under these exact names. The MCP tools available today (`awareness_metadata`, `awareness_preflight`, `awareness_briefing`) return related but differently named fields — `graph_freshness_state`, `certified_awareness_graph_commit`, `live_store_graph_triple_count`, `seed_state`, `coverage_state`. Phase O1 must reconcile this receipt's exact field set with Sensei core's real, current MCP contract — either by mapping each field to an existing one 1:1, or by getting each new field explicitly adopted on the Sensei side — before Phase O2 builds a runner against it. Inventing a parallel vocabulary that merely resembles the real one is worse than an obvious gap: a runner built against imagined field names would pass its own tests while failing silently against the real server.

## 8. Repository initialization

When a selected repository is not Sensei-initialized, the local Dashboard offers two explicit paths.

### Mechanical initialization

The default path performs deterministic initialization:

```text
sensei init / bootstrap
    -> canonical repository-domain binding
    -> protection derivation
    -> project graph generation
    -> verification
```

### Full architectural extraction

After the mechanical foundation is valid, the user may request a deeper LLM-assisted extraction to enrich candidates and architectural knowledge.

Initialization artifacts should normally land in a dedicated setup commit or PR. They must not be silently mixed into an unrelated feature change.

Malformed existing Sensei configuration is a hard stop. The runner may explain the condition but must not guess a replacement identity or silently reinitialize the repository.

## 9. Sensei MCP session model

The runner creates or attaches to a Sensei MCP session bound to:

```text
job id
repository root
repository domain
base SHA
head SHA
Sensei generation
agent role
```

All providers selected for the same job receive the same verified repository context, but each provider connection has its own session and readiness state.

Required tools are role-specific and versioned.

An implementer may require:

```text
workspace status
briefing
preflight
prepare change
protection check
task status and advancement
mutation admission
completion verification
```

An architect/reviewer may require:

```text
workspace status
briefing
impact
query
resolve
audit
diff admission
completion evidence
```

Missing required tools block the run.

## 10. GitHub as durable workflow ledger

GitHub stores the durable collaboration record:

- architectural plans and contracts
- issue and PR identity
- base and head SHAs
- implementation commits
- CI and check results
- review findings and bounded corrections
- architect approval
- human merge decision
- summarized execution receipts

The runner exposes governed GitHub actions to the architect. It should not simply place an unrestricted GitHub token inside model context.

Every write is checked against:

- repository allowlist
- requested role
- job capability
- current PR/task binding
- expected head SHA where applicable
- human-confirmation policy

Expected workflow states:

```text
PLANNING
CONTRACT_PROPOSED
WAITING_FOR_HUMAN_APPROVAL
IMPLEMENTATION_REQUIRED
IMPLEMENTATION_RUNNING
WAITING_FOR_CI
ARCHITECT_REVIEW_REQUIRED
ARCHITECT_REVIEW_RUNNING
CHANGES_REQUIRED
ARCHITECT_APPROVED
WAITING_FOR_HUMAN_MERGE
MERGED
BLOCKED
CANCELLED
```

The Dashboard reconstructs state from GitHub and local receipts after restart. Provider chat memory may accelerate a run but must not be required to understand or authorize it.

## 11. Contract separation

`sensei.dashboard.agent-handoff.v1` remains a bounded projection-derived context envelope. It is not the orchestration protocol.

New versioned contracts are required for:

- `sensei.dashboard.architect-session.v1`
- `sensei.dashboard.agent-run.v1`
- `sensei.dashboard.workspace-admission.v1`
- `sensei.dashboard.execution-receipt.v1`
- provider status and capabilities
- normalized provider events
- governed GitHub action requests and results

The projection document remains immutable architectural state. Conversation, provider, and execution state remain mutable and independently versioned.

### 11.1 Ownership per contract

`dashboard-projection-v1` and `agent-handoff-v1` follow one existing rule (`architecture-dashboard-v1.md` §10): `globulario/sensei` is the producer authority once it adopts a contract, and this repository keeps a generated/pinned consumer mirror verified byte-for-byte by `npm run verify:pin`. The new contracts split across that same line rather than forming one new undifferentiated group:

- **Sensei-core-owned, pinned like the existing two:** `sensei.dashboard.workspace-admission.v1` and the workspace-identity receipt shape in §7. Admission, preflight, and workspace identity are Sensei-core authority per §4.1 — the Dashboard/runner must not define what a valid admission response looks like on its own behalf, the same way it must not define what a valid projection looks like.
- **Dashboard/runner-owned, locally authoritative:** `sensei.dashboard.architect-session.v1`, `sensei.dashboard.agent-run.v1`, `sensei.dashboard.execution-receipt.v1`, provider status/capabilities, and normalized provider events. These describe conversation, orchestration, and execution state that Sensei core has no opinion about and never validates.
- **Governed GitHub action requests/results** are runner-owned but must be validated against the target repository's actual GitHub state at write time (§10) — they are not free-standing local state the way a provider-event log is.

Phase O1 must record this split explicitly when each schema is drafted, not leave it implicit. A schema in the first group ships only after the corresponding Sensei-core surface exists and is pinned; a schema in the second group may ship as soon as this repository defines it, the same way `agent-handoff-v1` did.

## 12. Worktree and execution isolation

Every mutation-capable run receives a separate exact-SHA worktree.

A worktree lease binds:

```text
repository
domain
job id
provider
role
base SHA
head SHA
task or PR
Sensei generation
```

Providers must not share a mutable checkout. Review and implementation runs may use separate read-only or mutable worktrees according to policy.

Initial execution may use native local processes for trusted repositories. Before unattended execution of untrusted code, the runner must add rootless containers or a stronger sandbox.

Untrusted fork PR code must never execute automatically on a credentialed local worker.

## 13. Normalized events and receipts

The runner translates provider-native output into shared events such as:

```text
Started
AuthenticationRequired
WorkspaceAdmissionStarted
WorkspaceAdmitted
PlanProduced
ToolRequested
ApprovalRequested
CommandStarted
CommandFinished
FileChanged
TestStarted
TestFinished
SenseiRefused
GitHubUpdated
WaitingForHuman
Completed
Failed
Cancelled
```

An execution receipt binds:

- provider and role
- repository and worktree identity
- exact SHAs
- Sensei workspace receipt
- commands and approvals
- changed files
- tests and outcomes
- CI observations
- GitHub writes
- final status

Raw secrets and unrestricted model transcripts are not receipts.

## 14. User experience

The local application presents architecture and workflow together:

```text
Architecture                     AI Architect
Map / Focus / Evolution          Discussion / plan / review

Workspace admission              Active work
Sensei initialized               PR and exact SHA
MCP verified                     Selected provider
Graph current                    Run progress
Protection acceptable            Tests and CI

[ Run with Claude ] [ Run with Codex ] [ Run with Antigravity ]
```

The Dashboard must show the difference between:

- provider installed
- provider authenticated
- MCP configured
- MCP verified
- workspace admitted
- run authorized

A configured but unreachable MCP service is displayed as `CONFIGURED, NOT VERIFIED`, never as connected.

## 15. Security requirements

- local runner executes outside the webview
- authenticated local IPC between Dashboard and runner
- provider secrets remain in native credential stores
- exact worktree and SHA binding
- stale-head review and merge refusal
- no automatic execution of untrusted fork code
- human confirmation for high-impact GitHub writes and merge
- command and file approvals surfaced in the Dashboard
- audit receipts for commands, files, tests, Sensei decisions, and GitHub writes
- no arbitrary shell construction from untrusted UI text
- explicit cleanup and cancellation
- sandboxing before unattended untrusted execution
- an admitted job's own edits to `docs/awareness/**` or `.sensei/config.yaml` must not take effect for that same job's remaining admission checks — a job cannot loosen the governance it is currently running under by editing the files that define it. The runner snapshots the governing awareness/config state at admission time and re-checks against that snapshot, not against whatever the worktree currently contains, for every gate after the first.

## 16. Delivery plan

This extension proceeds beside the existing observatory roadmap. The deterministic Architecture Map (Stage 4) merged in PR #6 while this contract was under review; this extension must not interrupt whichever observatory stage is active when a given orchestration phase starts, and must not modify projection semantics or map geometry to make room for itself.

Each phase below lands through its own bounded implementer brief, following this repository's existing stage-brief discipline (see `docs/claude-stage-4-map-brief.md` for the established shape: read-first list, explicit deliverables, non-goals, stop conditions requiring an `ARCHITECT QUESTION` instead of an invented answer, required verification commands, and an exact-SHA handoff protocol). This contract defines what each phase must achieve; it does not itself grant implementation authority for any phase; a phase begins only once its own brief exists and is handed off the same way `claude-stage-4-map-brief.md` was.

### Phase O1: governing contracts

**Status: complete.** Dashboard PR #12, merged at exact head `d492e29de6de7590e177b2208f0dffeb74b45bf1`.

- this architecture-workspace contract
- architect/session/run/admission/receipt schemas
- runner and provider-capability interfaces
- authority and security model
- no process execution

### Phase O2: local runner foundation

**Status: O2.1 implemented (docs/claude-workspace-o2-1-runner-ipc-foundation-brief.md, `runner/`); O2.2+ remains locked.** O2.1 delivered only the runner's process boundary and authenticated transport: a separate `sensei-runner` Go executable and module, authenticated loopback HTTP/1.1 IPC (bearer token, no CORS/Origin, no webview client), the closed `sensei.runner.protocol.v1` wire protocol with generated Dashboard consumer types, single-instance ownership with an OS-backed lock and atomic descriptor, foreground graceful lifecycle, and a bounded (256-entry) **non-durable, in-memory** sequenced event ring with explicit gap refusal. It does not yet include:

- separate `sensei-runner` process — done (O2.1)
- authenticated local IPC — done (O2.1), handshake/status/events only
- exact-SHA worktree manager — not started (O2.3)
- normalized event stream — not started; O2.1's event ring is a minimal internal-lifecycle stream (`runner_started`/`client_authenticated`/`runner_stopping`) only, not the provider-translated normalized run events §13 describes (O2.4)
- cancellation, cleanup, and restart recovery — not started; O2.1 restart always starts a fresh, non-durable state (O2.2)

### Phase O3: embedded OpenAI architect

- Codex app-server lifecycle
- regular ChatGPT browser login
- persistent project architect threads
- Sensei MCP injection and workspace identity proof
- read-only GitHub inspection

### Phase O4: governed GitHub architect actions

- create and update issues
- create draft PRs
- post contracts and handoffs
- inspect exact-SHA diffs and CI
- post architect approval or bounded corrections
- human-only merge gate

### Phase O5: worker providers

- Claude Code adapter
- Codex adapter
- Antigravity adapter
- provider-native authentication UX
- Sensei MCP verification for every worker
- admission-gated execution
- streamed run events and receipts

### Phase O6: unified architecture workspace UX

- architecture and architect conversation side-by-side
- provider choice and run queue
- active PR/task/review state
- approvals, blockers, tests, CI, and evidence
- restart reconstruction from GitHub and receipts

### Phase O7: hardening and distribution

- Tauri packaging
- headless runner mode
- sandboxed execution
- optional notification relay for machines behind NAT
- later Globular-backed distributed worker placement without changing the job envelope

## 17. First vertical slice

Prove one complete governed loop:

- one local repository
- one OpenAI architect thread through Codex app-server
- one worker provider, initially Claude Code
- one checkout-bound Sensei MCP session
- one draft PR and architect contract
- one exact-SHA implementation handoff
- one CI observation
- one exact-SHA architect review
- one human-authorized merge

The vertical slice succeeds only when the full durable workflow can be reconstructed after restarting the Dashboard.

## 18. Acceptance criteria

These describe the extension's full target shape across every phase in §16, not a Phase O1–O5 completion bar. The first vertical slice (§17) satisfies a narrower subset — it proves the loop with exactly one worker provider, not all three; the "select Claude, Codex, or Antigravity" bullet below becomes true incrementally as Phase O5 adds each remaining adapter, not on the first slice's own completion.

- Existing projection views and static GitHub Pages mode remain functional without the runner.
- A user can sign into the OpenAI architect using a regular ChatGPT account through the local Dashboard flow.
- A persistent architect thread can inspect the selected repository through the correct Sensei MCP session.
- The architect can prepare a governed GitHub contract and draft PR.
- The user can select Claude, Codex, or Antigravity for a bounded run, as each provider's own phase in §16 completes.
- No provider starts before Sensei initialization, MCP identity verification, and required admission succeed.
- Every run is bound to repository, canonical domain, worktree, base SHA, head SHA, task, role, provider, and Sensei generation.
- GitHub retains durable contract, review, CI, and merge history.
- The Dashboard distinguishes configured, authenticating, ready, expired, blocked, stale, partial, degraded, unavailable, and cancelled states.
- Architect approval is exact-SHA-bound.
- Merge remains an explicit human action.

## 19. Non-goals for the first vertical slice

- importing an existing ordinary ChatGPT web conversation
- claiming the embedded architect is literally the same stored ChatGPT thread
- automatic merge
- cloud-hosted source-code execution
- simultaneous multi-agent voting as architectural authority
- arbitrary shell access from the webview
- ungoverned repository mutation
- replacing Sensei with model context
- making the Dashboard the source of architectural truth
- distributed worker scheduling before the local job contract is proven

## 20. Final product boundary

```text
Sensei owns architectural truth and admission.
Sensei Dashboard owns understanding and operator interaction.
sensei-runner owns local orchestration.
The OpenAI runtime is the primary architect.
Claude, Codex, and Antigravity are governed workers.
GitHub owns the durable collaboration record.
The human maintainer owns final merge authority.
```

The extension is successful when architectural thinking, implementation delegation, evidence, review, and human approval form one coherent local workflow without making any model, UI, or chat transcript the source of architectural truth.
