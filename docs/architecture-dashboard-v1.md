# Sensei Dashboard V1

**Status:** Design contract  
**Issue:** #1  
**Audience:** Sensei core maintainers, dashboard implementers, agent reviewers

## 1. Purpose

Sensei Dashboard is a human-scale architectural observatory.

It converts an authoritative, versioned projection produced by Sensei into a calm visual explanation of a software system: what the system is made of, who owns truth, how important behavior crosses boundaries, where risk or uncertainty is concentrated, and how the architecture changes over time.

It is not the authority that decides those meanings. It communicates them.

The intended experience is progressive:

1. Understand the system in seconds.
2. Locate the area that deserves attention.
3. Select a component, boundary, contract, flow, or concern.
4. Read a precise explanation and supporting evidence status.
5. Hand the grounded context to an agent for investigation or action.

The dashboard must remain simple, clean, and lean without becoming simplistic. Precision comes from semantic discipline and progressive disclosure, not from displaying every available fact.

## 2. Product thesis

Traditional architecture diagrams are manually authored pictures that frequently drift from implementation. Raw graph explorers expose relationships but ask humans to reconstruct architectural meaning themselves.

Sensei can produce something different: a live architectural projection derived from implementation, contracts, invariants, decisions, tests, evidence, failure modes, authority, and revision bindings.

The dashboard therefore presents neither UML nor a generic knowledge graph. It presents a stable architectural model backed by Sensei evidence.

## 3. Responsibility boundary

### 3.1 Sensei core owns architectural truth

`globulario/sensei` is responsible for:

- repository and revision identity
- graph authority and projection provenance
- architecture health assessment
- projection integrity assessment
- observation completeness
- projection availability
- architectural briefing statements
- regions, components, boundaries, contracts, and flows
- risks, questions, contradictions, evidence state, and closure state
- meaningful revision deltas
- static snapshot generation
- live APIs
- stable identifiers and deep-link targets

Sensei core must return explicit unknown, partial, unavailable, or contested states. It must not manufacture certainty to satisfy a visual design.

### 3.2 Sensei Dashboard owns communication

`globulario/sensei-dashboard` is responsible for:

- standalone web application structure
- information hierarchy
- rendering the canonical projection
- visual layout of architectural regions and relationships
- lens-specific emphasis
- selection, focus, navigation, and deep links
- live-local and static-snapshot adapters
- loading, empty, degraded, and unavailable presentation
- responsive behavior and accessibility
- visual regression and interaction tests
- generation of an agent handoff request from projection data already supplied by Sensei

The frontend must not query RDF, issue SPARQL, derive architectural ownership, classify raw artifacts, infer health, or calculate authoritative scores.

### 3.3 Agent owns investigation and action

Claude, Codex, or another connected agent is the conversational control surface.

The dashboard observes and communicates. The agent may:

- explain an assessment
- retrieve deeper evidence
- compare competing interpretations
- prepare a repair plan
- inspect code
- propose or implement a governed change

A dashboard action must not imply that selecting an element itself mutates architectural state.

### 3.4 Editor integrations are contextual bridges

The VS Code extension may:

- display Sensei connection status
- show file-local architectural concerns
- open the standalone dashboard
- deep-link to the active file, component, task, or contract
- send bounded editor context

The extension is not the canonical host for the full dashboard.

## 4. Primary users

### Architect or technical lead

Needs a repository-wide view without reading every function, comment, or raw graph node.

### Maintainer

Needs to understand why a subsystem is under pressure, what changed, and which evidence or contract is missing.

### Agent operator

Needs a shared visual reference before asking an agent to explain, review, or repair an architectural concern.

### External reader

Needs a read-only static snapshot that explains a public repository without requiring a local Sensei installation.

## 5. Core questions V1 must answer

Within the first screen:

1. What repository and authoritative revision am I looking at?
2. What kind of system is this and what are its major architectural regions?
3. Is the architecture coherent, and how trustworthy and complete is this assessment?
4. What changed since the previous authoritative projection?
5. What deserves attention now?
6. What can I select to understand why?

Within one selection:

1. What is this element responsible for?
2. Who owns it, and what does it own?
3. Which contracts and flows connect it to the rest of the system?
4. What risks, contradictions, questions, or missing evidence affect it?
5. How current and complete is the evidence?
6. What grounded context should be handed to an agent?

## 6. V1 application surfaces

### 6.1 Overview

**Goal:** Orientation before exploration.

The Overview contains:

- repository and revision identity
- graph authority state
- architecture health
- projection integrity
- observation completeness
- projection availability
- active task or PR when present
- architectural briefing
- compact architectural facts
- recent meaningful changes
- risk and attention summary
- architecture map preview or primary map, depending on viewport

The briefing is prose-first. It must contain short owner-produced statements, not frontend-generated sentences assembled from counts.

Example shape:

> The repository is organized into six architectural regions with clear ownership across ingestion, graph authority, reasoning, and publication. Publication integrity improved in this revision. Two cross-boundary contracts remain without complete test evidence. Observation of runtime evidence is partial, so the health assessment does not claim complete coverage.

### 6.2 Architecture Map

**Goal:** Structural comprehension at human scale.

The map renders a bounded architectural projection rather than raw graph nodes.

It contains:

- regions or subsystems
- components within regions
- authority and ownership boundaries
- important contracts crossing boundaries
- important behavioral or data flows
- optional risk, confidence, change, and closure overlays

The layout must be stable and deterministic for the same projection identity. Users should be able to develop spatial memory of the system.

A component's visual prominence must not be based only on raw artifact count. Sensei may provide importance, criticality, centrality, or attention metadata with explicit semantics.

The map must avoid:

- force-directed node clouds
- one node per triple or artifact
- uncontrolled edge crossings
- labels that require zooming merely to identify major regions
- color as the sole carrier of status

### 6.3 Focus

**Goal:** Precise explanation without leaving the architectural view.

Selecting an element opens a Focus panel or route containing:

- stable identifier and display name
- element kind
- responsibility statement
- owning region and authority
- owned responsibilities or children
- key inbound and outbound contracts
- important flows
- risks and attention items
- evidence and observation state
- relevant decisions
- recent architectural changes
- provenance summary
- agent handoff action

Focus stops before source-level browsing becomes an IDE task. Source references may be linked, but the dashboard does not become a file tree or symbol explorer.

### 6.4 Evolution

**Goal:** Show what the architecture became, not merely what files changed.

Evolution compares authoritative projections and may show:

- region or component introduced, retired, or moved
- responsibility changed
- authority changed
- boundary added, removed, strengthened, or weakened
- contract added, removed, or changed
- flow introduced or redirected
- evidence improved, degraded, or became stale
- contradiction or open question introduced or resolved
- risk concentration increased or decreased
- observation coverage changed

Raw commit or file churn may be linked as evidence but is not the primary delta vocabulary.

### 6.5 Agent handoff

**Goal:** Give the agent enough grounded context to continue the user's current architectural investigation.

The dashboard creates a bounded request containing only projection data and references already supplied by Sensei:

- repository identity
- revision identity
- graph authority identity
- selected element identifier and kind
- current lens
- current route and visible concern
- attention item identifiers
- contract, boundary, flow, evidence, and decision identifiers
- optional active task or PR binding
- requested intent such as explain, review, compare, or propose

The handoff must not claim that visible evidence is exhaustive when observation is partial.

The generic product label should be **Ask Agent** or **Ask Sensei**. A concrete integration may display **Ask Claude** when Claude is the configured agent.

## 7. Architectural lenses

A lens changes emphasis, not the identity or layout of the architecture.

### Structure

Emphasizes regions, components, containment, and primary dependencies.

### Authority

Emphasizes ownership, truth boundaries, permitted mutation paths, and authority crossings.

### Behavior

Emphasizes important workflows, commands, events, data movement, and contract-mediated interactions.

### Risk

Emphasizes contradictions, missing evidence, stale knowledge, forbidden moves, boundary pressure, and unresolved failure modes.

### Change

Emphasizes architectural deltas between selected authoritative revisions.

### Closure

Emphasizes proven, open, degraded, contested, unknown, and unobserved architectural obligations.

V1 may implement Structure and Authority first, provided the projection and UI contracts preserve all six lens identifiers.

## 8. Assessment semantics

These concepts are intentionally independent.

### 8.1 Architecture health

**Question:** Does the observed architecture appear coherent and governed?

Potential inputs are owned by Sensei and may include boundary violations, contradictions, unowned responsibilities, unresolved high-severity questions, missing contract obligations, forbidden fixes, and failure-mode exposure.

The dashboard renders the supplied assessment and explanation. It does not calculate health from counts.

### 8.2 Projection integrity

**Question:** Can this projection be trusted internally?

Potential concerns include digest mismatches, stale bindings, incomplete publication, mixed generations, invalid authority identity, and inconsistent revision relationships.

Integrity failure may limit or suppress other claims.

### 8.3 Observation completeness

**Question:** How much relevant state was actually observed?

Completeness is not health. A partially observed system may appear healthy within observed scope while remaining unknown outside it.

The projection must include scope, limitations, and unavailable source information rather than only a percentage.

### 8.4 Projection availability

**Question:** Was this specific view constructible?

Canonical states:

- `available`
- `partial`
- `unavailable`

A partial projection must identify limitations. An unavailable projection must not render stale or placeholder architecture as current truth.

### 8.5 Confidence

V1 must not introduce an additional generic confidence score unless Sensei defines its precise meaning, owner, evidence, and relationship to the four concepts above.

## 9. Status representation

Every status-bearing object must support:

- machine token
- short label
- plain-language explanation
- severity or visual emphasis where applicable
- evidence references
- observed-at or revision binding
- unavailable or unknown state

Unknown is never equivalent to healthy, satisfied, or absent.

Color is supportive, not sufficient. Icons, labels, line styles, and text must preserve meaning for color-blind users and monochrome captures.

## 10. Canonical projection characteristics

The dashboard consumes one versioned top-level projection document or equivalent endpoint family.

Required properties:

- deterministic ordering
- stable identifiers
- explicit schema version
- repository, revision, and authority binding
- generated-at timestamp as metadata, not as authority
- declared availability and limitations
- human-scale bounded collections
- explicit references rather than duplicated contradictory facts
- extension points for future fields
- no dependence on raw triples in the frontend

The initial JSON Schema is defined in `dashboard-projection-v1.schema.json`.

## 11. Data modes

### Live local

The standalone application is served by or connects to `sensei serve`.

Capabilities may include:

- current projection retrieval
- bounded refresh
- element focus
- revision listing and comparison
- agent handoff

### Static snapshot

The same application loads immutable generated JSON files, suitable for GitHub Pages.

Static mode is read-only and must not display controls that require a live backend.

### Editor deep link

An editor integration opens the standalone application with stable context parameters or a local handoff token. It does not duplicate the full renderer inside a VS Code webview.

## 12. Information hierarchy

The default desktop hierarchy is:

1. Repository, authority, revision, and assessment strip.
2. Architectural briefing.
3. Architecture map.
4. Focus panel for the selected element.
5. Recent changes and risk/attention summaries.

The exact grid may adapt across viewport sizes. The hierarchy must remain intact.

## 13. Interaction principles

- Selecting an element does not rearrange the entire map.
- Lens changes preserve selection and spatial position where possible.
- Deep links resolve to stable identifiers, not display names.
- Hover supplements; it never contains essential information unavailable by keyboard or touch.
- Every summary can reveal its owner explanation and evidence references.
- Search prioritizes architectural elements and concerns, not raw artifacts.
- The browser back button must preserve navigational meaning.

## 14. Empty, degraded, and failure states

The dashboard must distinguish:

- application loading
- projection not generated
- projection unavailable
- projection partial
- no architectural elements in scope
- no current attention items
- selected element absent from this revision
- live server disconnected with last-known snapshot available
- static snapshot file missing or invalid

A last-known snapshot must be clearly identified as historical and must never masquerade as current state.

## 15. Non-goals for V1

- editing raw RDF or ontology records
- generic SPARQL console
- exhaustive artifact browser as the primary experience
- source-code editor
- replacement for GitHub PR review
- arbitrary user-authored diagram canvas
- automatic layout based on every graph relationship
- runtime operations control panel
- mutation of Sensei architectural state from static mode
- frontend-defined architecture health or risk formulas
- packaging with Tauri before the web application is proven
- maintaining separate full dashboard implementations for web, Pages, and VS Code

## 16. Technology direction

The canonical UI is a standalone TypeScript web application built with Vite.

The contract does not yet mandate a component framework or map-rendering library. Claude's first implementation stage must evaluate the existing ecosystem and propose the smallest dependency set that supports:

- accessible application shell
- deterministic SVG or canvas architecture map
- live and static adapters
- routing and deep links
- unit, interaction, and visual tests

The production build must be usable both as static assets and when served by Sensei.

## 17. Performance boundaries

The frontend operates on a human-scale projection, not 200,000 triples.

V1 targets:

- initial projection bounded enough for interactive desktop rendering
- no unbounded DOM node creation
- map interaction without visible re-layout jitter
- lazy retrieval of deeper focus evidence where the API permits it
- deterministic rendering for visual regression tests

Exact numeric budgets are established after fixture measurement, not invented in this contract.

## 18. Accessibility

V1 must support:

- keyboard navigation of all primary controls
- visible focus indication
- semantic landmarks and headings
- text alternatives for map summaries
- non-color status encoding
- reduced-motion preference
- sufficient contrast in light and dark presentation
- screen-reader-accessible selected-element details

The visual map may have an equivalent structured list for accessibility, but that list must remain secondary to the map in the primary visual experience.

## 19. Implementation stages

### Stage 1: Contract and fixtures

- agree the V1 schema between repositories
- produce representative complete, partial, unavailable, contested, and evolution fixtures
- confirm stable identifiers and ordering
- do not build a decorative dashboard against invented data

### Stage 2: Application shell

- Vite TypeScript application
- routing and layout
- projection validation
- static fixture adapter
- live adapter interface
- theme foundations
- accessibility and test harness

### Stage 3: Overview and Focus

- identity and assessment strip
- architectural briefing
- compact facts
- risk and attention summary
- selected-element Focus
- agent handoff envelope generation

### Stage 4: Architecture Map

- deterministic region layout
- components, boundaries, contracts, and flows
- selection and deep links
- Structure and Authority lenses
- accessible structured equivalent

### Stage 5: Evolution and integration

- revision comparison
- Change lens
- GitHub Pages snapshot mode
- Sensei live serving
- VS Code deep links
- visual polish and performance verification

Behavior, Risk, and Closure lenses may be completed in Stage 5 or a later bounded stage without changing the schema's semantic foundations.

## 20. Acceptance criteria for Dashboard V1

A repository-unfamiliar architect can use the dashboard to:

- identify the repository and authoritative revision
- summarize the system's major regions
- identify important authority boundaries
- trace at least one important contract-mediated flow
- distinguish architecture health, integrity, completeness, and availability
- identify the highest-priority current concern
- understand what changed between two authoritative revisions
- select an architectural element and see a precise explanation
- create a grounded agent handoff without copying raw graph data

The implementation fails the contract if it is visually polished but requires the user to reconstruct architecture from ontology categories, artifact tables, or an unbounded node graph.
