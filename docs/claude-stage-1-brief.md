# Claude implementation brief: Stage 1 foundation

**Status:** Do not implement until the Dashboard V1 contract PR is merged and a representative projection fixture has been accepted.  
**Target repository:** `globulario/sensei-dashboard`  
**Expected branch:** `feat/vite-application-foundation`

## Mission

Create the smallest durable foundation for the standalone Sensei Dashboard web application.

This stage establishes application structure, projection validation, data adapters, routing, honest failure states, and tests. It does not attempt to complete the visual concept or architecture map.

The implementation must make later UI work straightforward without allowing the frontend to become a second architecture-reasoning engine.

## Read first

- `docs/architecture-dashboard-v1.md`
- `docs/dashboard-projection-v1.schema.json`
- Issue #1 and the merged design-contract PR

Treat those documents as requirements, not mood boards.

## Prerequisite

Before implementation, obtain at least one accepted `sensei.dashboard.projection.v1` fixture produced or approved by the Sensei core contract.

`globulario/sensei` is the canonical producer authority for `dashboard-projection-v1.schema.json` once it adopts this contract. Until that adoption lands, the schema in this repository is the proposed handshake, not an independent competing authority — do not treat a locally invented fixture shape as settling ambiguity the schema itself leaves open.

Do not invent production architectural data merely to fill the screen. A deliberately labeled synthetic test fixture is acceptable for isolated component tests, but the development application must default to an accepted repository projection fixture.

## Deliverables

### 1. Vite TypeScript application

Create a standalone application using Vite and TypeScript.

Select a UI framework only after evaluating whether it materially reduces complexity. Document the choice in the PR. Do not add a large dependency stack for a mostly static shell.

The application must build to static assets that can later be:

- served by `sensei serve`
- published through GitHub Pages
- wrapped by a desktop shell without changing the application architecture

### 2. Projection model and validation

- Generate or maintain TypeScript types corresponding to `dashboard-projection-v1.schema.json`.
- Validate every loaded projection at the adapter boundary.
- Invalid projection data must produce an explicit unavailable state and a useful diagnostic.
- Internal UI components receive validated domain objects, not arbitrary JSON.
- The UI must not repair, reinterpret, or silently default missing authoritative fields.

If using generated types, pin the generator and make regeneration deterministic. If maintaining types manually, add tests that detect divergence from representative schema fixtures.

### 3. Data adapter contract

Define one application-facing interface supporting at least:

- load current projection
- load focus record by stable element identifier from the current projection
- expose adapter capabilities
- report typed loading, unavailable, invalid, and disconnected outcomes

Implement:

- **Static fixture adapter:** loads immutable projection JSON.
- **Live adapter boundary:** interface and configuration only, unless an accepted Sensei endpoint already exists. Do not invent a backend protocol in this repository.

Application views must not know whether data came from a local server or static snapshot.

### 4. Routes and deep-link model

Provide stable routes for:

- `/` or `/overview`
- `/map`
- `/element/:elementId`
- `/evolution`

Preserve optional lens and revision context through explicit route/query state.

Do not use display names as identifiers. Encode and decode stable identifiers safely.

### 5. Application shell

Build only the structural shell required to prove the architecture:

- product header
- repository/revision identity area
- primary navigation
- main content region
- optional Focus region
- application-level loading and unavailable states

Use restrained placeholder components for future Overview, Map, Focus, and Evolution content. Placeholders must identify the missing stage and must not show invented health scores, importance rankings, or fake architecture.

### 6. Honest states

Demonstrate and test:

- valid available projection
- valid partial projection with visible limitations
- valid unavailable projection with no architecture claimed
- invalid JSON/schema
- missing static snapshot
- unknown deep-linked element

A stale cached snapshot may not be presented as current unless it carries explicit historical identity and UI labeling. Caching is not required in this stage.

### 7. Tests and quality gates

At minimum:

- schema/fixture validation tests
- adapter outcome tests
- route and stable-ID tests
- application unavailable-state test
- partial-projection limitations test
- production build test
- lint and TypeScript checks

Add CI that runs the deterministic install, checks, tests, and production build.

Pin the package manager through repository metadata and commit its lockfile.

### 8. Documentation

Update the README with:

- project purpose
- repository boundary
- prerequisites
- local development commands
- test/build commands
- explicit statement that live Sensei integration is not yet implemented if that remains true

Add a short architecture note describing:

- validated adapter boundary
- route model
- component/view boundaries
- where future live and static implementations attach

## Explicit non-goals

Do not implement in this stage:

- architecture map layout or graph library
- health, integrity, completeness, or availability calculations
- raw RDF, SPARQL, or artifact interpretation
- agent execution
- agent handoff envelope generation (see `agent-handoff-v1.schema.json`; this is Stage 3 scope)
- mutation controls
- Tauri packaging
- VS Code webview embedding
- full visual reproduction of the concept image
- runtime polling or invented live endpoints
- authentication
- large design-system dependency

## Required review evidence

The PR description must include:

- chosen frontend stack and why
- exact package-manager and runtime versions
- file/directory overview
- adapter boundary explanation
- commands executed and results
- screenshots of available, partial, and unavailable states
- known limitations
- confirmation that no frontend-authored architectural semantics were introduced

## Acceptance criteria

The stage is complete when:

1. A clean checkout can install, test, type-check, lint, and build deterministically.
2. The same application renders a validated fixture without caring whether a future adapter is live or static.
3. Partial and unavailable projections remain honest and visually distinct.
4. Deep links use stable identifiers.
5. No component consumes raw triples or calculates architectural truth.
6. The shell is clean enough to receive Overview and Focus work without structural rewrites.

## Stop condition

Stop and ask through the PR if the projection schema is insufficient, contradictory, or forces the frontend to infer missing architectural meaning. Do not patch semantic gaps with local heuristics.
