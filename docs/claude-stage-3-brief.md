# Claude implementation brief: Overview and Focus

**Status:** Active implementation contract for draft PR #5  
**Target repository:** `globulario/sensei-dashboard`  
**Target branch:** `feat/dashboard-stage-3-overview-focus`  
**Base branch:** `main`  
**Base SHA:** `62b4770330beaa41be2919f1a41b7368b86e85e8`  
**Architect role:** GPT defines and reviews the contract.  
**Implementer role:** Claude implements, tests, pushes, waits for CI, and stops for review.

This is the canonical Dashboard V1 **Stage 3: Overview and Focus** work described in `docs/architecture-dashboard-v1.md`. It follows the merged application-shell work in PR #4. The earlier PR used “Stage 1” as its local implementation label; this brief uses the canonical stage number from the V1 contract.

## Mission

Turn the accepted shell into a useful, calm architectural observatory for two bounded surfaces:

1. **Overview:** orient a repository-unfamiliar architect using only owner-produced projection truth.
2. **Focus:** explain one selected architectural element precisely and create a bounded agent-handoff envelope from explicit projection fields and explicit user choices.

This stage must make the dashboard substantially useful without starting the Architecture Map, live transport, revision comparison, or mutation work.

## Read first

Treat these as requirements, not inspiration:

- `docs/architecture-dashboard-v1.md`, especially §§3, 5, 6.1, 6.3, 6.5, 8, 9, 10, 12–14, 18, and 19
- `docs/dashboard-projection-v1.schema.json`
- `docs/agent-handoff-v1.schema.json`
- `contract/generated/dashboard-projection-v1.ts`
- `contract/generated/agent-handoff-v1.ts`
- `docs/fixtures/dashboard-projection/v1/**`
- the merged PR #4 implementation and review discussion

The producer-consumer pin remains authoritative. Do not modify generated contract types manually and do not change either schema in this PR.

## Architectural laws

### A. Sensei owns truth; the dashboard owns communication

The frontend must not:

- calculate architecture health, integrity, completeness, availability, confidence, importance, centrality, or priority
- infer ownership, authority, contracts, flows, risks, or architectural meaning from raw artifacts or collection counts
- repair missing authoritative fields
- manufacture fallback descriptions
- reinterpret unknown, unobserved, contested, unavailable, or not-applicable states as healthy or absent
- query RDF, issue SPARQL, or consume raw triples

Every architectural statement displayed in Overview or Focus must be copied from a validated projection field or be neutral interface language that does not assert repository truth.

### B. The four assessment semantics remain independent

The UI must visibly distinguish:

1. graph-authority state
2. architecture health
3. projection integrity
4. observation completeness
5. projection availability

Availability is listed separately because it answers whether this view was constructible; it must not be collapsed into any assessment. Observation completeness is not health. Integrity failure is not merely another risk badge.

### C. Stable identifiers are the navigation identity

Display names are labels only. All links and selections use stable identifiers. Existing query preservation, percent-encoding safety, and stale-render protections from PR #4 must remain intact.

### D. Projection order is authoritative presentation order

Do not rank or reorder briefing statements, facts, attention items, changes, or reference collections by local severity heuristics. Preserve producer order unless the contract explicitly supplies a separate order field.

### E. No hidden expansion of handoff context

Agent-handoff references must be copied from explicit fields. Do not perform transitive graph expansion, similarity search, inferred neighborhood construction, or “helpful” repository-wide enrichment.

## Deliverables

## 1. Overview information hierarchy

Replace the Stage 1 placeholder with the bounded Overview defined here.

The desktop reading order must remain:

1. repository, authority, revision, and assessment strip
2. architectural briefing
3. compact facts
4. current attention
5. recent architectural changes
6. restrained Architecture Map placeholder or preview boundary

Responsive layout may change columns, but not semantic order.

### 1.1 Identity and assessment strip

Render, without recomputation:

- repository display name and repository key
- authoritative revision display when present, otherwise revision id
- revision ref and committed timestamp when present
- graph authority `observed`, `current`, identity, and owner summary
- architecture health state, label, severity, and summary
- projection integrity state, label, severity, and summary
- observation completeness state, label, severity, summary, and coverage exactly as supplied
- projection availability state, summary, and limitations
- active task or pull-request context when present

Requirements:

- machine state and human label must both remain available to assistive technology
- severity and state must not rely on color alone
- `unknown` and `not_applicable` must have distinct text and visual treatment
- null coverage values render as unknown, not zero
- `generated_at` is metadata, not authority; label it accordingly if shown
- active context must be copied verbatim from the validated projection and never reconstructed from browser or Git state

### 1.2 Architectural briefing

Render briefing statements verbatim, preserving order.

For each statement expose:

- kind
- text
- severity
- explicit element references when present
- provenance/evidence access through progressive disclosure

Do not concatenate briefing rows into a new synthesized paragraph. Do not generate prose from counts.

### 1.3 Compact facts

Render `projection.facts` as the canonical compact facts surface.

- preserve producer order
- display label, value, optional unit, and state
- null value means unknown/unavailable and must not render as zero or an empty fact
- explicit `element_refs` may deep-link to Focus

Collection lengths may appear only in a clearly secondary **projection inventory** label if retained from Stage 1. They must not be presented as architectural health, importance, completeness, or owner-produced facts. Prefer removing the prose count sentence if it competes with canonical facts.

### 1.4 Attention summary

Render `projection.attention` without local ranking.

Each item may show:

- title
- summary
- kind
- severity
- state
- explicit element references
- provenance/evidence disclosure

Selection behavior:

- an attention item is itself selectable only when `selectable === true`
- when selectable, its stable id must resolve to exactly one matching `focus_records` entry of kind `attention`
- non-selectable attention items may link only to explicit `element_refs`
- no inferred “highest risk” or “top concern” label may be created from severity sorting

When the array is empty, render a neutral “No current attention items were supplied by this projection” state. Do not say the architecture has no risks.

### 1.5 Recent architectural changes

Render the current projection’s `evolution` summary and bounded `changes` list.

- preserve producer order
- show change title, summary, kind, impact, and explicit element refs
- when evolution is partial or unavailable, show its limitations and do not imply a complete comparison
- when `base_revision` is null, identify this as a first authoritative projection rather than “no changes”
- do not calculate change magnitude from file or collection counts

Full comparison controls and Change lens remain later-stage work.

## 2. Focus surface

Replace the current raw-reference placeholder with a precise selected-element explanation.

For a found `FocusRecord`, render:

- name
- stable id
- element kind
- state
- responsibility
- owners
- owned responsibilities or children
- contracts
- flows
- attention items
- decisions
- recent architectural changes
- source links when supplied
- provenance, evidence references, observation timestamp, and limitations
- agent-handoff action when capability permits

### 2.1 Explicit reference resolution

Create one deterministic projection index or equivalent bounded resolver over the already validated projection.

It may resolve an explicit stable reference to its explicit object label and kind. It must not infer new relationships.

Reference presentation rules:

- show the human label plus stable id where useful
- link selectable architectural objects to `/element/:id` using the existing centralized route/href logic
- preserve current query state such as `fixture`, lens, or revision context
- source links are external links exactly as supplied; apply safe link attributes and do not rewrite targets
- unresolved explicit refs produce an integrity diagnostic; never fabricate a name

### 2.2 Focus integrity

Add consumer-side defensive validation for the producer’s focus referential-integrity rule:

- every selectable region, component, boundary, contract, flow, and selectable attention item has exactly one Focus record
- the Focus record stable id and kind match the selectable object
- duplicate Focus records are rejected

The accepted schema-valid/producer-invalid fixtures under `docs/fixtures/dashboard-projection/v1/invalid/` must be rejected at the adapter boundary as an invalid projection outcome. This is validation, not frontend repair.

Do not broaden this into a new semantic validator for architectural meaning. Keep it to explicit referential integrity required by the contract.

### 2.3 Honest missing states

- unknown route element: retain the existing honest unknown-element state
- missing or duplicate Focus record discovered during projection validation: reject the projection as invalid; do not wait until selection to synthesize a fallback
- selected element absent from the current revision: say exactly that; do not reuse a similarly named record
- partial observation limitations remain visible in Focus

## 3. Agent-handoff envelope generation

Implement **envelope generation and export only**. Do not call Claude, Codex, ChatGPT, Sensei MCP, or any remote agent in this stage.

Create a pure, testable builder for `sensei.dashboard.agent-handoff.v1`, followed by validation against the pinned handoff schema before export.

### 3.1 Capability behavior

Use `projection.capabilities?.agent_handoff` exactly:

- `none` or absent: no handoff action
- `export`: allow local preview, copy, and/or JSON download
- `live`: the envelope may still be generated, but do not invent a live transport; clearly state that live delivery is not implemented in this build

Neither `export` nor `live` implies mutation authority.

### 3.2 Explicit user controls

The user must explicitly select:

- requested intent: `explain`, `review`, `compare`, or `propose`
- lens: one of the six contract lens ids, default visibly to `structure` while no lens UI exists
- optional visible-concern text; default is `null`, not generated prose

Capability in the envelope is:

- `propose` only when the user explicitly selects requested intent `propose`
- `read_only` for all other intents

`propose` means the agent may prepare a governed-change proposal. It does not grant mutation, application, or merge authority.

### 3.3 Deterministic field population

Copy these fields directly from the validated projection:

- repository identity
- revision identity
- graph-authority object
- selected element id and kind, or null
- active context, or null

Populate `visible_concern.route` from the current canonical route including route-owned query context. Populate `visible_concern.summary` only from explicit user input; otherwise null.

Populate `observation_limitations` deterministically, preserving first occurrence order, from explicit limitation strings in:

1. `projection.availability.limitations`
2. `projection.assessments.observation_completeness.provenance.limitations`
3. each `projection.availability.sources[*].limitations`

Do not generate explanatory limitation text.

Populate `referenced_ids` only from explicit fields associated with the current selection:

- selected Focus record: `attention_refs`, `contract_refs`, `flow_refs`, `decision_refs`, provenance `evidence_refs`
- selected boundary: include its own id as a boundary ref
- selected contract: include its own id as a contract ref and its explicit `boundary_refs`
- selected flow: include its own id as a flow ref
- selected attention item: include its own id as an attention ref

Deduplicate while preserving first occurrence order. Do not perform transitive expansion.

### 3.4 Export behavior

Provide at least one reliable local export path:

- copy validated JSON to clipboard, or
- download validated JSON

A preview must show the exact envelope that will be exported. Export must be disabled when envelope validation fails, and the diagnostic must be visible.

The accepted `handoff/read-only.json` and `handoff/propose.json` fixtures define representative valid shapes. Do not force every generated envelope to byte-match those fixture values; test equivalent semantics for the current projection and explicit user choices.

## 4. Component and state boundaries

Keep the Stage 1 adapter boundary intact:

- raw fetch, JSON parsing, schema validation, and semantic Focus validation remain inside the adapter/validation boundary
- views receive validated projection objects or typed outcomes
- no view performs network access
- Shell remains the owner of asynchronous loading and stale-render cancellation
- presentational rendering should remain synchronous where practical

A small projection-index/view-model module is acceptable. Do not migrate to a UI framework or add a design-system dependency in this PR without an explicit architect-approved amendment in the PR conversation.

## 5. Accessibility and interaction

At minimum:

- semantic headings and landmarks
- keyboard-operable links, disclosure controls, intent/lens controls, and export actions
- visible focus treatment
- status meaning available without color
- screen-reader-readable selected-element details
- no essential information only on hover
- reduced-motion preference remains respected
- focus movement on route changes is deliberate and tested where practical

## 6. Tests and required proof

Add or extend tests proving at least:

### Overview

- all independent assessment/availability semantics render without collapsing into one score
- null observation coverage is unknown, not zero
- briefing order/text is unchanged
- facts come from `projection.facts`
- empty attention does not claim “no risk”
- attention and evolution preserve producer order
- partial/unavailable evolution limitations are visible

### Focus

- explicit refs resolve to labels and stable deep links
- current query state survives Focus navigation
- unresolved refs produce an integrity diagnostic, not invented labels
- missing-Focus and duplicate-Focus producer-invalid fixtures are rejected at the adapter boundary
- selected element missing from the revision remains honest
- source links are rendered safely

### Handoff

- read-only intent produces `capability: read_only`
- propose intent produces `capability: propose`
- no other intent produces propose capability
- route and selected stable id/kind are bound exactly
- limitation collection is deterministic and deduplicated
- referenced ids are copied only from explicit fields and are not transitively expanded
- active context is copied exactly or remains null
- generated envelope validates against the pinned schema
- export is unavailable when capability is none or validation fails

### Regression

- all PR #4 routing, malformed-URL, async-staleness, adapter, schema, fixture-parity, and honest-state tests remain green
- a slower prior Focus load still cannot overwrite a newer route

## 7. Required commands

From a clean checkout, run and report:

```bash
npm ci
npm run verify:pin
npm test
npm run typecheck
npm run test:app
npm run build
```

GitHub Actions must pass on the exact reviewed head SHA.

## 8. Required PR evidence

Before handing back for review, update the PR description or add one structured comment containing:

- exact base SHA and exact head SHA
- concise file/directory overview
- Overview behavior implemented
- Focus behavior implemented
- Focus referential-integrity validation behavior
- agent-handoff builder and export behavior
- commands and results
- GitHub Actions status
- screenshots of Overview and Focus using the accepted default fixture
- screenshots or test evidence for partial/unavailable/contested states
- one exported read-only envelope and one exported propose envelope, with repository-specific data safe for the public PR
- known limitations
- explicit confirmation that no frontend-authored architectural semantics or live-agent transport were introduced
- deviations from this brief, or `None`

## Explicit non-goals

Do not implement in this PR:

- deterministic Architecture Map layout
- SVG/canvas graph rendering
- Structure or Authority map lenses beyond carrying the selected lens id in a handoff
- full revision comparison UI or Change lens
- GitHub Pages deployment
- Sensei live serving or a live adapter implementation
- polling, WebSockets, MCP, Claude/OpenAI API calls, or any agent transport
- mutation controls or governed-change application
- source-code browsing or file-tree UI
- frontend-authored scoring, ranking, health, risk, confidence, or importance
- new projection or handoff schema fields
- schema-version changes
- Tauri or VS Code embedding
- authentication
- broad visual redesign unrelated to Overview and Focus

## Stop conditions

Stop and post an `ARCHITECT QUESTION` comment before coding around any of these:

- a required display meaning is absent from the projection
- proposal capability cannot be expressed without inventing authority
- an explicit reference cannot be resolved under the current contract
- satisfying the brief appears to require a schema change
- a live-agent transport seems necessary
- the existing shell architecture would require a framework migration
- this brief conflicts with the pinned schemas or accepted fixtures

Do not patch a semantic gap with local heuristics.

## Handoff protocol

When implementation and CI are ready, post:

```text
IMPLEMENTATION READY FOR ARCHITECT REVIEW

Architect brief: docs/claude-stage-3-brief.md
Base SHA: <exact>
Head SHA: <exact>

Implemented:
- ...

Evidence:
- npm run verify:pin: PASS
- npm test: PASS
- npm run typecheck: PASS
- npm run test:app: PASS
- npm run build: PASS
- GitHub Actions: PASS

Deviations:
- None | ...

HANDOFF: GPT ARCHITECT REVIEW
```

Then stop. Do not merge, mark the architecture complete, or continue into Stage 4.

## Acceptance criteria

This stage is architecturally complete only when:

1. Overview communicates identity, authority, independent assessments, availability, owner briefing, canonical facts, attention, and recent change without frontend inference.
2. Focus gives a precise, reference-resolved explanation for every selectable architectural element and never fabricates missing records.
3. Schema-valid but producer-invalid Focus fixtures are rejected before rendering.
4. A user can generate and locally export a schema-valid, bounded read-only or propose handoff from explicit projection fields and explicit choices.
5. No live agent is called and no mutation authority is implied.
6. Accessibility and prior routing/state-integrity guarantees remain intact.
7. Clean-checkout verification and GitHub Actions pass on the exact reviewed head SHA.
8. GPT architect review reports no blocking findings.
