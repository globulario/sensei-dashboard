# Claude implementation brief: Workspace O1 Sensei pin and parity closure

**Status:** Implementation authorized on this PR branch.  
**Target repository:** `globulario/sensei-dashboard`  
**Implementation branch:** `docs/workspace-o1-sensei-pin-parity-brief`  
**Dashboard base:** current `main` at the moment this branch was created  
**Canonical producer repository:** `globulario/sensei`  
**Canonical producer PR:** `globulario/sensei#121`  
**Architect-reviewed producer head:** `f7c22b613fd3fde9f9513aa1151096d75b968ab4`  
**Authoritative merged producer commit:** `14381d5760099df5a99b9ecd3a565998a494b392`  
**Scope:** Close Workspace O1 by pinning and consuming the two now-canonical Sensei-owned workspace contracts. Do not begin Workspace O2.

## 1. Mission

Complete the cross-repository authority sequence left open by the Dashboard O1 foundation:

1. pin the exact canonical Sensei schemas and positive fixtures from merged commit `14381d5760099df5a99b9ecd3a565998a494b392`;
2. prove local digest integrity and live byte parity against that exact commit;
3. generate Dashboard TypeScript consumer types from the pinned schemas;
4. update the O1 contract inventory and documentation from `pending_sensei_adoption` to canonical pinned consumption;
5. make the pure `WorkspaceAdmissionClient` boundary consume the canonical generated contracts rather than handwritten approximations;
6. preserve the seven Dashboard-owned contracts and every O1 authority boundary;
7. stop after posting exact-head evidence. No runner or provider behavior enters this PR.

The canonical producer surfaces now exist in Sensei:

- `sensei.workspace.identity.v1`;
- `sensei.workspace.admission.v1`;
- `sensei_workspace_status`;
- `sensei_workspace_admit_change`;
- `sensei_workspace_verify_admission`.

The Dashboard is a consumer only. It must not redefine, weaken, rename, or partially reinterpret those contracts.

## 2. Canonical source artifacts

Pin from `globulario/sensei@14381d5760099df5a99b9ecd3a565998a494b392`.

### Schemas

| Schema | Source path | Required SHA-256 |
|---|---|---|
| `sensei.workspace.identity.v1` | `docs/schemas/workspace/v1/workspace-identity-v1.schema.json` | `72201049c35f934ec93b7b3db1a56e61768449841ab4931d225826212a9fad14` |
| `sensei.workspace.admission.v1` | `docs/schemas/workspace/v1/workspace-admission-v1.schema.json` | `ba11e9797e7663f54bf84bde57fbe9bf287d44fec2c2fd14e5cc0ddc79e6622f` |

### Positive fixtures

| Source path | Required SHA-256 |
|---|---|
| `docs/fixtures/workspace/v1/identity/complete.json` | `d2fa992652824c1ef91e1ee1b5ea28ecd6e1a882211fbd46f88f88516c4c7313` |
| `docs/fixtures/workspace/v1/identity/partial.json` | `360737eed2cadd1506112db3fa6d5ae28e1198bbf9e52e5093feffaeef4671b0` |
| `docs/fixtures/workspace/v1/identity/unavailable.json` | `c14c08602b23e9e86f0d880d2bb7277a605d47faab063dad7fa6939129bdcb92` |
| `docs/fixtures/workspace/v1/admission/admitted.json` | `b76b663eca61a53650b767d32ca3c6063146243baebed770ce2678232bead657` |
| `docs/fixtures/workspace/v1/admission/admitted-with-conditions.json` | `dd3b1927e1613283a7c4f4106f4fc1e0fc673d23619da0873dd441018dfadb94` |
| `docs/fixtures/workspace/v1/admission/refused.json` | `05d5d9b886a7b012ab10cc98d67981e683a48861f60ba1f19de4b9aae04acd9a` |
| `docs/fixtures/workspace/v1/admission/verification-compliant.json` | `7c8e17b6c48e08efbbd692d06e0b4e764e6c1f8aff05af90b2a32e9bc213d988` |
| `docs/fixtures/workspace/v1/admission/verification-stale.json` | `0d9847c66b4c0cc16408199d875131e411e5c21475f0ddc48aea31b73d01723c` |
| `docs/fixtures/workspace/v1/admission/verification-violated.json` | `362e2c42b5c7bda11304a44d3246966ecdc7bbbc528f0cdf06779b15325cdf55` |

The implementation must recompute every digest from fetched bytes. The table is an expected-result oracle, not permission to skip hashing or live parity.

## 3. Architectural laws

### A. Sensei remains the only authority

The pinned schemas and fixtures must be copied byte-for-byte. Do not edit descriptions, comments, enums, required fields, paths, nullability, or object closedness to suit Dashboard code.

Dashboard-local `GoverningSnapshot` and `AdmissionReference` encodings may remain lightweight local orchestration references, but they may not replace the canonical records or weaken distinctions carried by them.

### B. Pinning proves an external producer

A local digest stored beside a locally edited file is not parity. CI must fetch every pinned artifact from the exact Sensei commit and byte-compare it with the local mirror.

### C. Preserve the existing projection/handoff pin

`contract/pin.json` currently governs `sensei.dashboard.projection.v1` and `sensei.dashboard.agent-handoff.v1` from their own accepted producer commit. Do not silently repoint that historical adoption merely because a newer Sensei commit exists.

Add a dedicated workspace pin manifest at:

```text
contract/workspace/sensei-pin.json
```

It must record:

- source repository;
- exact 40-character source commit;
- source PR;
- every schema version, source path, mirror path, and SHA-256;
- every fixture source path, mirror path, SHA-256, schema version, and expected validity.

Extend the existing `npm run verify:pin` entry point so one command verifies both the established projection/handoff manifest and the new workspace manifest. Shared generic helpers are preferred over copied verification logic.

### D. Generated types are transcription, not authority

Generate:

```text
contract/generated/workspace-identity-v1.ts
contract/generated/workspace-admission-v1.ts
```

from the pinned schema bytes. Use canonical root names:

```text
SenseiWorkspaceIdentityV1
SenseiWorkspaceAdmissionV1
```

The generator banner must identify the correct workspace pin manifest. Do not hand-edit generated output.

### E. Existing Dashboard-owned contracts remain distinct

Do not merge the canonical Sensei records into the seven Dashboard-owned schemas. Those schemas describe local orchestration records. The canonical records describe Sensei truth.

Add cross-contract proof showing how governed Dashboard records reference or project canonical evidence without claiming that the lightweight reference is the complete canonical record.

One known edge requires explicit care: the existing local `governingSnapshot.graph_digest_status` vocabulary permits `unknown`, while the canonical Sensei binding distinguishes `not_requested`. Never translate canonical `not_requested` into local `unknown` and call it exact. A governed mapping must preserve the canonical distinction or refuse the mapping. If closure requires changing an already-versioned Dashboard-owned schema rather than adding a lossless adapter or validation rule, post `ARCHITECT QUESTION` and stop that portion.

### F. O1 records only, no O2 behavior

This PR must not add:

- `sensei-runner` implementation;
- process or PTY execution;
- local IPC;
- provider SDKs or adapters;
- authentication or credential handling;
- worktree creation;
- MCP lifecycle management;
- GitHub API execution;
- workspace UI;
- queues, retries, leases, background services, or distributed workers;
- automatic merge;
- Tauri code.

## 4. Required implementation envelope

### 4.1 Mirrored artifacts

Copy the canonical schemas byte-for-byte to:

```text
docs/workspace-identity-v1.schema.json
docs/workspace-admission-v1.schema.json
```

Copy the nine fixtures byte-for-byte under:

```text
docs/fixtures/workspace/v1/identity/
docs/fixtures/workspace/v1/admission/
```

Do not rename fixture files.

### 4.2 Pin and parity tooling

Add `contract/workspace/sensei-pin.json` and extend the shared verifier so:

1. every local mirror matches its recorded digest;
2. every remote artifact at the exact pinned commit matches the same digest;
3. every positive fixture validates against its canonical pinned schema;
4. changing a local mirror and its local digest together still fails live parity;
5. no pin entry can be silently omitted from the live check;
6. offline skipping, if retained, remains explicit and is never used in CI.

Do not hard-code a total such as the existing historical `12` in generic logic. Each manifest must prove that all entries it declares participated in parity.

### 4.3 Type generation

Extend `scripts/lib/generate.mjs` and its tests with the two canonical pinned targets. Preserve deterministic output and the existing local-vs-pinned provenance distinction.

The existing `npm run generate:types` command must regenerate all established and new generated files.

### 4.4 Contract inventory

Update the first two entries in `contract/workspace/contracts.json`:

- `pinning_rule`: canonical Sensei pin, using the repository's clearest existing vocabulary;
- `generated_type_target`: the corresponding new generated file;
- `fixture_directory`: the corresponding new fixture directory;
- `state`: implemented and pinned;
- notes: exact Sensei PR and merged source commit, with Dashboard explicitly classified as consumer.

Do not alter ownership of the other seven contracts.

### 4.5 Pure interface boundary

Update `src/workspace/interfaces/workspace-admission-client.ts` so its authoritative return values use the generated canonical types.

The interface must represent the three real Sensei workspace operations without implementing transport:

- workspace status;
- admit change;
- verify admission.

Request types may mirror the existing MCP tool inputs, but may not invent a new verdict, collapse decision and verification records, or infer correctness.

The interface remains pure TypeScript:

- type imports only;
- no DOM access;
- no Node process import;
- no provider SDK;
- no concrete client class;
- no network or process call.

### 4.6 Validation and cross-contract proof

Extend workspace schema validation so the two pinned schemas and nine pinned fixtures participate alongside the seven local contract families without becoming locally owned.

Add tests proving at least:

- all canonical workspace fixtures validate;
- unknown root and nested fields remain rejected by the canonical schemas;
- canonical schema versions are exact constants;
- generated types are fresh and deterministic;
- decision records carry `verification: null`;
- verification records carry a non-null verification object;
- canonical decision and verification identity remain bound by admission id and decision digest in accepted fixtures;
- `scope_compliant` never manufactures `correctness_certified: true`;
- local governed references are lossless subsets or explicit references, never replacements for the canonical record;
- `not_requested`, `unavailable`, and any Dashboard-local `unknown` state are not silently conflated.

### 4.7 Documentation

Update:

- `contract/PARITY.md` or add a workspace-specific parity section linked from it;
- `docs/architecture-workspace-contracts-v1.md`;
- `README.md` contract tooling text;
- any comments that still state the two Sensei contracts are not canonical.

The documentation must state:

- Sensei owns workspace identity and admission truth;
- Dashboard pins and consumes exact bytes;
- workspace identity is evidence, not permission;
- admission is permission to attempt, not correctness;
- scope compliance is not correctness certification;
- runner-owned process, worktree, job, and provider identity remains outside Sensei's receipt;
- O1 is complete only after this PR is merged and explicitly accepted;
- O2 remains locked during this PR.

## 5. Required verification

Run from a clean exact head after committing all implementation changes:

```bash
npm ci
npm run verify:pin
npm run generate:types
npm run typecheck
npm test
npm run build
```

Also prove:

1. running type generation twice produces no diff;
2. every declared workspace pin entry was locally hashed and live-compared;
3. the two local schema mirrors are byte-identical to Sensei at `14381d5760099df5a99b9ecd3a565998a494b392`;
4. all nine fixtures are byte-identical to the same commit;
5. all generated files are committed and fresh;
6. the complete diff contains no O2 implementation;
7. CI is green on the exact final head.

Use the repository's Sensei workflow before architecture-sensitive mutation. Empty or degraded protection is a limitation, never evidence of safety.

## 6. Stop conditions

Post `ARCHITECT QUESTION` and stop the affected portion when:

- any source byte or digest differs from the table above;
- the merged Sensei commit does not contain an expected artifact;
- pin tooling cannot represent two independent producer adoptions without rewriting historical provenance;
- generated TypeScript requires editing a pinned schema;
- a Dashboard-owned schema must change semantics to pretend it is the canonical Sensei contract;
- `not_requested`, `unknown`, or `unavailable` cannot be mapped without information loss;
- a canonical admission field would be dropped from the authoritative interface result;
- completing proof would require O2 process, transport, provider, worktree, GitHub, or UI behavior;
- repository protection is stale or malformed.

## 7. Claude protocol

The brief is the only initial change on this PR branch. Claude should:

1. read this brief and the accepted O1 architecture documents;
2. inspect the exact current Dashboard main and merged Sensei source commit;
3. use Sensei preflight/admission for the bounded file envelope;
4. implement only the work above on this same PR branch;
5. commit and push intentionally;
6. wait for exact-head CI;
7. post `IMPLEMENTATION READY FOR ARCHITECT REVIEW` with the evidence template below;
8. stop without merging or beginning O2.

Do not replace this brief with a different architecture. Post `ARCHITECT QUESTION` when a stop condition is reached.

## 8. Required handoff template

```text
IMPLEMENTATION READY FOR ARCHITECT REVIEW

Workspace O1 Sensei pin/parity closure:
- accepted brief path + commit:
- Dashboard base SHA:
- final Dashboard head SHA:
- Sensei producer repository:
- Sensei producer PR:
- architect-reviewed producer head:
- authoritative merged producer commit:
- workspace pin manifest path + digest:
- identity schema mirror path + digest:
- admission schema mirror path + digest:
- all nine fixture mirror paths + digests:
- generated TypeScript paths + digests:
- contract inventory changes:
- canonical interface changes:
- local digest proof:
- live cross-repository parity proof:
- fixture/schema validation proof:
- deterministic generation proof:
- typecheck/test/build results:
- exact-head CI results:
- Sensei admission/completion evidence:
- limitations or open questions:
- explicit proof that no O2 behavior entered the diff:
```

## 9. Merge and phase boundary

Human merge authority remains final.

After this PR is implemented, exact-head reviewed, CI-green, and merged, Workspace O1 may be explicitly declared complete. Only then may a separate architect-approved Workspace O2 brief be opened.
