# Workspace O1 contract guide

**Status:** Implementation artifact for Phase O1 (docs/claude-workspace-o1-brief.md), accepted brief head `968fdc02b4f13f3b83ffbdd99ec1186d8466cf09`.
**Scope:** Records ownership, relationships, assurance-mode semantics, and the Sensei-core field mapping for the nine contracts in `contract/workspace/contracts.json`. This is documentation of what O1 built and why — it is not itself a governing contract and grants no implementation authority beyond what the accepted brief already grants.

## 1. What O1 shipped, and what it didn't

Seven Dashboard/runner-owned contracts are fully implemented: schemas, generated types, positive and adversarial fixtures, and pure TypeScript interfaces. Two Sensei-core-owned contracts are **documented but not canonical** — see §5 below and the required `ARCHITECT QUESTION` in this PR's evidence. Per the brief's own explicit allowance ("Dashboard-owned contracts may proceed independently, but O1 cannot be declared complete"), this PR does not claim O1 is fully complete.

## 2. Ownership and pinning

Two ownership classes, following the exact rule `architecture-dashboard-v1.md` §10 already established for `dashboard-projection-v1`/`agent-handoff-v1`:

| Contract | Owner | Pinning rule |
|---|---|---|
| `sensei.workspace.identity.v1` | `globulario/sensei` | Pending Sensei-core adoption — not yet canonical, nothing pinned |
| `sensei.workspace.admission.v1` | `globulario/sensei` | Pending Sensei-core adoption — not yet canonical, nothing pinned |
| `sensei.dashboard.architect-session.v1` | `globulario/sensei-dashboard` | Local — authored and versioned here, no external source |
| `sensei.dashboard.agent-run.v1` | `globulario/sensei-dashboard` | Local |
| `sensei.dashboard.execution-receipt.v1` | `globulario/sensei-dashboard` | Local |
| `sensei.dashboard.provider-capabilities.v1` | `globulario/sensei-dashboard` | Local |
| `sensei.dashboard.provider-status.v1` | `globulario/sensei-dashboard` | Local |
| `sensei.dashboard.provider-event.v1` | `globulario/sensei-dashboard` | Local |
| `sensei.dashboard.github-action.v1` | `globulario/sensei-dashboard` | Local |

The Dashboard repository must never unilaterally define the semantic truth of workspace identity, graph freshness, protection coverage, preflight, mutation admission, or completion verification (Law A) — those two contracts stay Sensei-core authority even while undocumented in canonical form.

**A deliberate deviation from the original plan, discovered during implementation:** `contract/pin.json`'s existing structure (`source_repository`/`source_commit`/live `raw.githubusercontent.com` fetch) exists specifically to prove byte-identity against an external producer. It has nothing to prove for a genuinely local schema, and `test/pin.test.mjs` hardcodes `allPinEntries(pin).length === 12` for the existing Sensei-sourced pair. Rather than overload `pin.json` with a `source: "pinned" | "local"` discriminator (the original plan), the seven local contracts are governed entirely by mechanisms that already exist and needed no reinterpretation: `scripts/lib/generate.mjs`'s `targets` array (generation-drift + determinism, via the existing `generated-types.test.mjs` pattern) and dedicated fixture-validation tests (`test/workspace-fixtures.test.mjs`). `contract/pin.json` and `scripts/lib/pin.mjs`/`scripts/verify-schema-pin.mjs` are completely untouched by this PR — the Sensei-parity mechanism stays focused on exactly what it already proves.

## 3. Contract relationships

```text
architect-session ──┐
                     ├── admission_reference.admission_id (must agree, when both governed)
agent-run ───────────┘
     │
     ├── governing_snapshot, expected_head_sha, repository_domain, job_id (must agree)
     ▼
execution-receipt
     │
     └── github_write_refs → github-action.v1 result envelopes (by id, not embedded)

agent-run ──runEvents()──> provider-event.v1 (stream, keyed by run_id)
```

`test/workspace-fixtures.test.mjs`'s cross-contract tests assert these agreements directly on the committed `complete.json` fixtures (run↔receipt identity, session↔run admission identity), not just within a single document.

## 4. Assurance modes and state distinctions

Every contract that can be governed (architect-session, agent-run, execution-receipt) enforces **both halves** of Law F structurally, not just documentally:

- `assurance_mode: "governed"` requires a real, non-null `admission_reference` (schema `if`/`then`).
- `assurance_mode: "manual"` requires `admission_reference` to be `null` — a manual record cannot carry a real admission reference even if one happens to exist, closing the gap the brief's Law F calls out ("A record produced by a manual editor/CLI session must never be structurally indistinguishable from an admission-gated governed run").

`execution-receipt.v1`'s `completion_facts` keeps six independent tri/quad-state fields (`worker_completed`, `tests_passed`, `ci_observed_green`, `sensei_completion_verified`, `architect_exact_sha_approval`, `human_merge_occurred`) using the same `yes | no | unknown | not_applicable` vocabulary `dashboard-projection-v1`'s `KnowledgeState`/`Severity` already established for the unknown-vs-not_applicable distinction — none of the six may be inferred from another (brief §5, tested explicitly).

`provider-status.v1` keeps `mcp_configured` and `mcp_verified` as two independent booleans for the same reason: "configured MCP is not verified MCP."

## 5. Sensei-core field mapping (Deliverable 1.1)

Researched directly against `globulario/sensei` at commit `4691b9977469285c234e529189068bd528aebed5`. Two structurally distinct surfaces exist and must not be conflated:

1. The gRPC `AwarenessGraph` service (`proto/awareness_graph.proto`, served by `golang/server/*.go`) — read-heavy graph/architecture queries.
2. The `awareness-mcp` bridge (`cmd/awareness-mcp/main.go`) — forwards 8 tools to the gRPC service, and implements `task_status`, `advance_task`, `task_briefing`, `admit_change`, `verify_admission` **entirely locally against filesystem-persisted task/admission artifacts** (confirmed explicitly in Sensei's own `docs/api-reference.md:439-442`: "The task tools do not call the gRPC service"). None of these five have a gRPC RPC or a canonical JSON Schema today — only Go structs.

| Canonical field | Classification | Citation |
|---|---|---|
| Repository domain identity | Existing, authoritative, caller-supplied (not derived) | `ClaimDocumentBinding.RepositoryDomain`, `golang/architecture/claim_document.go:27` |
| Repository-root identity (checkout hash) | **Intentionally absent from V1** — Sensei's design deliberately delegates filesystem/checkout context to the caller | Explicit proto comment: "filesystem roots come from the startup-owned context," never accepted from a caller (proto:152); `TreeIdentity` doc comment distinguishes this from tree-content digest, `golang/architecture/binding/binding.go:107-111` |
| Revision/base/head identity | Existing, authoritative composition | `ClaimDocumentBinding.Revision`/`.TreeDigestSHA256`, `claim_document.go:28,34`; `architecture.ResolveRevision`, `golang/architecture/fact.go:233-255`; `RepositoryTreeDigestSHA256`, `binding.go:89-100` |
| Graph freshness + certified generation identity | Existing, authoritative | `GraphAuthority.graph_freshness_state`/`.certified_awareness_graph_commit`, proto:651,668; `golang/server/graph_freshness.go:112` |
| Protection/coverage state | Existing, authoritative (graph-wide + per-request) | `MetadataResponse.coverage_state`, proto:787, `golang/server/metadata.go:194-219`; `PreflightResponse.coverage`, proto:1084 |
| Seed state | Existing, authoritative | `GraphAuthority.seed_state`/`MetadataResponse.seed_state`, proto:656/788 |
| MCP server/session identity | **Intentionally absent** — transport is stateless; the only persisting identity is the deterministic, content-derived `TaskID` | grep of `cmd/awareness-mcp/main.go` for session identifiers: zero hits; `StableTaskID`, `golang/architecture/tasksession/session.go:560-575` |
| Task/job binding with id | Existing, authoritative — "task" only, no separate "job" concept | `TaskID`, `session.go:560-575`; bound to `ClaimDocumentBinding` |
| Preflight decision identity | Exists as a response shape; **no persisted decision id** — stateless, re-derived per call | `PreflightResponse`, proto:1058-1095; `.claude/skills/sensei-admission/references/ADMISSION-MODEL.md:28`: "Admission is an execution-control boundary. Preflight is advisory risk and context." |
| Mutation-admission decision identity | Existing, authoritative, fully typed and persisted | `admission.Decision{AdmissionID, DecisionDigestSHA256, Decision(enum)}`, `golang/architecture/admission/admission.go:226-256`; closed outcome vocabulary `Admitted \| AdmittedWithConditions \| Waiting \| Refused \| Uncertifiable` |
| Refusal codes/reasons | Exists, but as several independent per-subsystem string vocabularies (`admission.*`, `task.control.*`, ...), never one cross-cutting enum | `admission.go:59-101` |

**Consequence:** no single Sensei call returns the composed "workspace status" shape `architecture-workspace-v1.md` §7's illustrative JSON sketched. `sensei.workspace.identity.v1` would need to be authored as a **composition** of `GraphAuthority` + `MetadataResponse.coverage_state` + `ClaimDocumentBinding`; `sensei.workspace.admission.v1` would mirror `admission.Decision`/`admission.Verification` directly. Both are semantically well-understood now (this table is precise, not a guess) — but authoring the actual canonical JSON Schema for either is an act of defining a **new external wire-contract surface for Sensei core that does not exist today**, which is Sensei-core's own architectural decision to make, not something this repository originates unilaterally. See the `ARCHITECT QUESTION` in this PR's evidence comment.

`GoverningSnapshot`/`AdmissionReference` as defined in the seven Dashboard-owned schemas (§6-defs in `workspace-architect-session-v1.schema.json` etc.) are the Dashboard's own snake_case JSON encoding of `ClaimDocumentBinding`/`admission.Decision`'s real field semantics — not a byte-pinned Sensei wire format, since none exists yet. Each schema's `$comment` says this explicitly.

## 6. Deferred to O2+

Everything the brief's Non-goals section lists: `sensei-runner` executable/daemon, Tauri code, local IPC implementation, Codex app-server integration, Claude Code/Codex/Antigravity adapters, authentication UI, credential discovery/storage, worktree manager, process/PTY abstraction implementation, MCP server lifecycle, GitHub API writes, dashboard workspace UI, run queue, background service, distributed workers, Globular integration.

## 7. How a future provider adapter consumes this without becoming contract authority

A future O2+ `AgentProvider`/`ArchitectRuntime` implementation (`src/workspace/interfaces/*.ts`) is handed generated record types (`contract/generated/workspace-*.ts`) and returns/consumes them verbatim. It:

- never defines a new field on a generated type (the schema is upstream of the type, not the reverse);
- never invents an admission verdict — `WorkspaceAdmissionClient.verifyAdmission()` only ever returns what Sensei core actually decided, once that surface exists;
- never fabricates `assurance_mode: "governed"` without a real `admission_reference` — the schema itself makes this structurally impossible to submit;
- negotiates capabilities explicitly (`AgentProvider.capabilities()` against `StartRunRequest.requiredCapabilities`) rather than assuming parity across providers (brief §4.1's "a boolean is insufficient when capability availability depends on runtime mode").

The interface layer (`src/workspace/interfaces/`) has zero DOM, zero Node-process, and zero provider-SDK imports — every file in that directory is `import type`-only against generated contract types and sibling interfaces, verified by direct inspection during this PR's verification pass.
