# Claude implementation brief: Workspace O1 governing contracts

**Status:** Contract review only. No implementation authority until this brief receives an exact-head architectural acceptance.  
**Target repository:** `globulario/sensei-dashboard`  
**Target branch:** `feat/workspace-o1-governing-contracts`  
**Brief branch:** `docs/workspace-o1-brief`  
**Stacked base branch:** `docs/ai-architecture-workspace-plan`  
**Accepted architecture-contract SHA:** `2a019dc517f12a0984a1d2699408ce97f529a267`  
**Architect role:** GPT defines and reviews the contract.  
**Implementer role:** Claude implements only after an explicit exact-head handoff, proves the result, pushes, waits for CI, and stops for review.

This is Phase **O1: governing contracts** from `docs/architecture-workspace-v1.md`. It establishes versioned data contracts and pure interfaces for the future local AI architecture workspace. It does not create the runner, start provider processes, authenticate accounts, execute commands, mutate GitHub, or launch agents.

## Mission

Create the smallest authoritative contract layer needed for later orchestration phases without pretending that Dashboard-owned schemas can define Sensei admission truth.

O1 must establish:

1. an explicit contract inventory and ownership registry;
2. strict versioned schemas for Dashboard/runner-owned orchestration records;
3. canonical Sensei-owned workspace identity and admission contracts, adopted in `globulario/sensei` before being pinned here;
4. pure TypeScript interfaces for runner, architect-runtime, provider, event, receipt, and governed-GitHub boundaries;
5. deterministic fixtures, generated types, validation, and drift checks;
6. an honest mapping from the current Sensei MCP surface to the canonical workspace receipt;
7. no executable orchestration behavior.

## Read first

Treat these as requirements, not inspiration:

- `docs/architecture-workspace-v1.md`, especially §§2.1, 4, 6-7, 9-13, 15-20
- `docs/architecture-dashboard-v1.md`, especially §§3, 10, 15, and 18
- `docs/dashboard-projection-v1.schema.json`
- `docs/agent-handoff-v1.schema.json`
- `contract/pin.json`
- `scripts/generate-contract-types.mjs`
- `scripts/verify-contract-pin.mjs`
- `src/adapter/reference-index.ts` only as an example of keeping pure contracts separate from browser state
- the accepted review on PR #8 at exact head `2a019dc517f12a0984a1d2699408ce97f529a267`
- the current canonical MCP/tool contracts in `globulario/sensei`, not remembered or illustrative field names

Before architecture-sensitive editing, load `.sensei/skills/sensei-architect/SKILL.md` and use the repository's current Sensei workflow with explicit domain `github.com/globulario/sensei-dashboard` where required.

For any change in `globulario/sensei`, use that repository's own Sensei workflow and canonical domain. Empty or degraded protection is a limitation, never evidence of safety.

## Architectural laws

### A. Contract ownership follows authority

The Dashboard repository may define and own contracts for mutable local orchestration state:

- architect session;
- agent run;
- execution receipt;
- provider status and capabilities;
- normalized provider events;
- governed GitHub action request and result envelopes.

The Dashboard repository must not unilaterally define the semantic truth of:

- workspace identity;
- graph freshness;
- protection coverage;
- preflight;
- mutation admission;
- completion verification.

Those are Sensei-core authority. Their canonical schemas must first exist in `globulario/sensei`, then be pinned byte-for-byte into this repository.

### B. O1 defines records, not behavior

Interfaces may describe future capabilities and request/response shapes, but O1 must not include:

- process spawning;
- PTY lifecycle;
- shell command construction;
- provider detection;
- authentication flows;
- token or credential storage;
- local IPC servers or clients;
- worktree creation;
- MCP process management;
- GitHub API execution;
- agent invocation;
- retry, lease, queue, or recovery engines.

A fake implementation returning fixtures is also out of scope. Fixtures test contracts; they are not a mock runner product.

### C. Current Sensei reality must be reconciled, not renamed

The illustrative fields in `architecture-workspace-v1.md` are not implementation authority.

O1 must inspect the exact current Sensei MCP/API outputs and publish a field-by-field mapping table for the canonical workspace identity/admission receipt. For each canonical field, record exactly one of:

- existing authoritative field with identical semantics;
- authoritative composition from explicitly named existing fields;
- new Sensei-core field required;
- intentionally absent from V1.

Do not create a Dashboard-side synonym layer that merely sounds equivalent. If semantics are ambiguous, contradictory, or require a new Sensei concept, post `ARCHITECT QUESTION` and stop that portion of the work.

### D. Strict versioning and validation

Every JSON Schema must:

- have a stable canonical `$id`;
- use an explicit V1 schema identifier inside the document;
- use `additionalProperties: false` at every object boundary unless a specific extension map is deliberately authorized and documented;
- distinguish required, optional, nullable, unknown, unavailable, and refused states;
- avoid free-form status strings where a bounded enum is intended;
- preserve exact repository, domain, revision, base SHA, head SHA, task, role, provider, job, and generation bindings where applicable;
- never encode secrets or unrestricted transcripts;
- have positive and adversarial fixtures;
- generate TypeScript types deterministically;
- fail CI on schema/type/fixture drift.

### E. Receipts report evidence, not trust claims

An execution receipt may report:

- what provider and role ran;
- what exact worktree and SHAs were bound;
- which admission receipt was supplied;
- which commands were requested, approved, started, and finished;
- which files changed;
- which tests and CI observations were recorded;
- which governed GitHub actions occurred;
- the final bounded status.

It must not claim that code is safe, correct, architecturally complete, or mergeable merely because a run completed.

### F. Manual and governed modes remain distinct

O1 contracts must make assurance mode explicit. A record produced by a manual editor/CLI session must never be structurally indistinguishable from an admission-gated governed run.

At minimum, run/session records require a bounded mode such as:

- `manual`
- `governed`

A governed record must bind the authoritative workspace-admission receipt. A manual record must not fabricate one.

### G. Self-referential governance is prohibited

Admission and later verification references must bind the governing snapshot accepted at admission time. The job's own edits to `.sensei/config.yaml` or `docs/awareness/**` cannot change the policy identity used by that same job.

O1 must include the governing snapshot identity in the relevant admission/run/receipt contracts. It does not implement the enforcement engine.

## Required contract inventory

Create a committed registry, suggested path:

```text
contract/workspace/contracts.json
```

The exact filename may follow repository convention, but the registry must record for every contract:

- canonical id;
- version;
- owner repository;
- producer authority;
- consumer repositories;
- mutability class;
- pinning rule;
- generated-type target;
- fixture directory;
- current implementation/adoption state.

The inventory must include at least:

### Sensei-core-owned and pinned here

- `sensei.workspace.identity.v1`
- `sensei.workspace.admission.v1`

Names may change only through an explicit architect decision grounded in current Sensei naming conventions. Do not retain the `sensei.dashboard.*` prefix for a core-owned contract if that would falsely imply Dashboard ownership.

### Dashboard/runner-owned

- `sensei.dashboard.architect-session.v1`
- `sensei.dashboard.agent-run.v1`
- `sensei.dashboard.execution-receipt.v1`
- `sensei.dashboard.provider-capabilities.v1`
- `sensei.dashboard.provider-status.v1`
- `sensei.dashboard.provider-event.v1`
- `sensei.dashboard.github-action.v1`

A combined request/result schema is permitted only when the discriminated union remains strict and readable.

## Deliverables

## 1. Sensei workspace identity and admission contracts

This is a cross-repository authority sequence.

### 1.1 Inspect the existing canonical surface

In `globulario/sensei`, identify the exact current owners and fields for:

- canonical repository domain;
- repository-root identity;
- revision/base/head identity;
- graph freshness and certified graph generation;
- protection/coverage state;
- seed state where relevant;
- MCP server/session identity;
- task/job binding if it exists;
- preflight and mutation-admission decision identity;
- refusal codes and reasons.

Commit a mapping document in the authoritative repository or in this repository with exact source references and Sensei commit SHA. Do not base the mapping solely on screenshots or prose.

### 1.2 Resolve genuine gaps through Sensei authority

When a required canonical field has no authoritative equivalent, one of these must happen:

1. omit it from Workspace V1 with an explicit limitation; or
2. add it through a separately reviewed Sensei-core contract change.

Do not silently derive security-sensitive identity from paths, process arguments, branch names, or Dashboard-local configuration.

### 1.3 Canonical production and pinning

Once adopted in `globulario/sensei`:

- generate canonical JSON Schemas and positive/adversarial fixtures there;
- validate them in Sensei CI;
- pin exact source repository, commit, artifact path, and digest here;
- generate Dashboard TypeScript consumer types from pinned artifacts;
- extend the existing pin verification so source schema and fixtures cannot drift together unnoticed.

If the canonical Sensei contracts cannot be completed within the bounded O1 work without introducing new admission semantics, stop with `ARCHITECT QUESTION`. Dashboard-owned contracts may proceed independently, but O1 cannot be declared complete.

## 2. Architect-session contract

Define a strict session record that binds:

- session id and schema version;
- repository/domain context;
- architect runtime/provider identity;
- project/thread identity as exposed by the runtime;
- manual or governed assurance mode;
- creation/update timestamps as recorded evidence, not ordering authority;
- bounded lifecycle state;
- optional active issue/PR/task references;
- optional workspace-admission receipt reference for governed mode;
- bounded continuity summary references;
- no raw credentials;
- no claim that this is an ordinary ChatGPT web thread.

The schema must make it impossible for a `governed` session to validate without an admission reference.

## 3. Agent-run contract

Define a run envelope that binds:

- run and job ids;
- repository, canonical domain, base SHA, expected head SHA, and worktree identity;
- task/issue/PR binding;
- role;
- provider;
- manual or governed assurance mode;
- required capabilities;
- requested operation class;
- governing contract/brief identity and accepted SHA;
- governing awareness/config snapshot identity;
- workspace-admission reference for governed mode;
- bounded lifecycle and terminal states;
- cancellation identity and reason;
- no command text as implicit authority.

The schema must support read-only architect/reviewer runs without forcing mutation-only fields.

## 4. Provider contracts

### 4.1 Provider capabilities

Represent capabilities explicitly, including at least:

- interactive authentication;
- browser authentication;
- headless execution;
- streaming output;
- session resume;
- MCP;
- skills;
- sandboxing;
- command approvals;
- file approvals;
- structured output.

Use bounded support states such as `supported`, `unsupported`, `unknown`, and `conditional` where appropriate. A boolean is insufficient when capability availability depends on runtime mode.

### 4.2 Provider status

Distinguish at least:

- absent;
- installed;
- unauthenticated;
- authenticating;
- ready;
- expired;
- blocked;
- unavailable;
- unknown.

Configured MCP is not verified MCP. Provider readiness is not workspace admission.

### 4.3 Normalized provider events

Define a strict discriminated union for the event vocabulary in `architecture-workspace-v1.md` §13.

Each event must bind:

- event id;
- run id;
- monotonically ordered sequence supplied by the event owner;
- event kind;
- bounded payload;
- recorded timestamp;
- optional native provider event reference;
- redaction state.

Do not create one giant event object with dozens of optional fields.

## 5. Execution-receipt contract

Define a receipt that summarizes immutable run evidence after a bounded attempt.

It must bind:

- run/job/provider/role;
- exact repository/domain/worktree/base/head identities;
- accepted governing brief/contract SHA;
- governing snapshot identity;
- workspace-admission receipt reference when governed;
- command and approval summaries;
- changed-file identities and digests where available;
- tests and outcomes;
- CI observations tied to exact SHA;
- governed GitHub write results;
- final run status;
- explicit limitations and missing evidence;
- cancellation/failure/refusal information;
- redaction declaration.

The receipt must distinguish:

- worker process completed;
- tests passed;
- CI observed green;
- Sensei completion verification passed;
- architect exact-SHA approval exists;
- human merge occurred.

None implies another.

## 6. Governed GitHub action contract

Define request/result envelopes for the future runner gateway without implementing GitHub writes.

Initial action kinds may include:

- inspect repository/issue/PR/commit/check state;
- create or update issue;
- create draft PR;
- post top-level comment;
- post exact-SHA review;
- mark ready for review;
- request human merge authorization.

Automatic merge is not an action available to an architect or worker contract.

Every mutation request must carry:

- repository allowlist identity;
- job and role;
- operation capability;
- issue/PR binding;
- expected current head SHA where applicable;
- human-confirmation requirement and state;
- idempotency key;
- bounded payload.

Every result must report observed GitHub identity after the action and must never claim success from a locally predicted state.

## 7. Pure TypeScript interfaces

Create pure interfaces, suggested under:

```text
src/workspace/contracts/
src/workspace/interfaces/
```

The exact layout may follow repository conventions.

Interfaces must cover:

- `ArchitectRuntime`
- `AgentProvider`
- `RunnerClient`
- `WorkspaceAdmissionClient`
- `GovernedGitHubGateway`
- provider event stream
- contract validator boundary

Requirements:

- no DOM access;
- no Node process imports in the contract/interface layer;
- no provider-specific SDK imports;
- no implementation classes;
- explicit capability negotiation;
- typed refusal/error unions;
- abort/cancellation signal represented without implementing lifecycle;
- generated record types used rather than duplicated handwritten shapes.

## 8. Fixtures and adversarial proof

For every schema, add:

- smallest valid example;
- representative complete example;
- invalid unknown property;
- invalid enum/status;
- missing required identity;
- malformed SHA/domain/id;
- secret-bearing field rejected where relevant;
- governed mode without admission rejected;
- manual mode pretending to have admission semantics rejected or explicitly normalized according to the accepted contract;
- cross-SHA mismatch rejected when expressible structurally;
- event payload for the wrong discriminator rejected.

Add cross-contract tests proving at least:

- an execution receipt references an existing compatible run fixture;
- a governed run and session bind the same admission identity;
- run/receipt repository, domain, job, and exact SHA identities agree;
- architect approval, CI status, completion verification, and merge state remain separate fields;
- serialized generated output is deterministic.

Do not invent a runtime database or global registry to perform these tests. Fixture-set validation is sufficient for O1.

## 9. Documentation

Add a concise contract guide covering:

- ownership and pinning;
- contract relationships;
- assurance modes;
- state distinctions;
- canonical Sensei field mapping;
- what remains intentionally unimplemented until O2+;
- how a later provider adapter consumes the interfaces without becoming contract authority.

Update README contract links only as needed. Do not present the architecture workspace as executable or available.

## Non-goals

O1 must not include:

- `sensei-runner` executable or daemon;
- Tauri code;
- local IPC implementation;
- Codex app-server integration;
- Claude Code, Codex, or Antigravity adapters;
- authentication UI;
- credential discovery or storage;
- worktree manager;
- process/PTY abstraction implementation;
- MCP server lifecycle;
- GitHub API writes;
- dashboard workspace UI;
- run queue;
- background service;
- distributed workers;
- Globular integration;
- changes to Dashboard projection or map semantics;
- Stage 5 Evolution work;
- automatic merge;
- a mock runner marketed as a vertical slice.

## Required stop conditions

Post `ARCHITECT QUESTION` and stop the affected work when:

- current Sensei MCP fields cannot be mapped to a canonical identity/admission field without semantic guessing;
- a required admission concept does not exist and adding it would change Sensei architecture;
- contract ownership is ambiguous;
- a proposed schema would make Dashboard authoritative for Sensei truth;
- provider capability semantics cannot be represented without provider-specific assumptions in the shared contract;
- a schema needs unrestricted extension maps or free-form command authority;
- existing contract tooling cannot pin cross-repository fixtures and schemas safely;
- generated types would require editing canonical pinned artifacts;
- O1 would need process execution, credentials, GitHub writes, or UI behavior to prove itself;
- Sensei protection is stale, malformed, or degraded for an architecture-sensitive mutation.

A stop on the Sensei-owned lane does not automatically block work on independent Dashboard-owned schemas, but the final O1 handoff must list the lane as incomplete and must not claim O1 completion.

## Verification

Run from a clean checkout after all changes are committed.

At minimum:

```bash
npm ci
npm run verify:pin
npm run generate:contracts
npm run check:generated
npm run typecheck
npm test
npm run build
```

Use the repository's actual script names if they differ; document every substitution.

For `globulario/sensei` canonical additions, run that repository's complete required formatting, schema, fixture, generated-artifact, unit, and integration checks. Include exact commands and results.

Required deterministic proof:

1. regenerate types twice and prove no diff;
2. validate every positive fixture;
3. prove every adversarial fixture fails for the intended reason;
4. verify every pinned Sensei artifact against the exact canonical commit;
5. prove changing a local pinned schema and its local digest together still fails the live cross-repository check;
6. prove no process, network listener, provider SDK, credential, Tauri, worktree, or GitHub-write implementation entered the diff;
7. prove the complete diff is bounded to O1 contracts, pure interfaces, fixtures, generation/validation tooling, and documentation.

## Implementation handoff protocol

After this brief receives exact-head architectural acceptance, the implementer must:

1. create `feat/workspace-o1-governing-contracts` from the exact authorized base;
2. post the planned file envelope before mutation;
3. establish fresh Sensei preflight and mutation admission for each repository touched;
4. implement only this brief;
5. push the exact implementation head;
6. wait for all required CI in both repositories when applicable;
7. post `IMPLEMENTATION READY FOR ARCHITECT REVIEW` with:
   - accepted brief SHA;
   - exact dashboard base/head SHAs;
   - exact Sensei base/head SHAs if touched;
   - contract inventory;
   - ownership table;
   - canonical field mapping;
   - schema and fixture list;
   - generated-type digests;
   - pin verification proof;
   - test/build results;
   - Sensei admission and completion evidence;
   - limitations, open questions, and deviations;
8. stop without beginning O2, runner code, provider integration, workspace UI, or Stage 5 work.

## Acceptance bar for O1 implementation

O1 may be accepted only when:

- every contract has one explicit owner;
- every Sensei-owned contract is canonical in Sensei and pinned here;
- every Dashboard-owned contract is strict, versioned, generated, and adversarially tested;
- current Sensei MCP semantics are mapped without invented equivalence;
- governed and manual assurance modes cannot be confused;
- admission, execution, CI, completion verification, architect approval, and merge remain distinct facts;
- pure interfaces contain no orchestration implementation;
- deterministic generation and cross-repository drift checks pass;
- no O2+ behavior entered the change;
- exact-head CI and architectural review are green.

Human merge authority remains final.