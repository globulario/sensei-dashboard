# Claude implementation brief: deterministic Architecture Map

**Status:** Active implementation contract for draft PR #6  
**Target repository:** `globulario/sensei-dashboard`  
**Target branch:** `feat/dashboard-stage-4-architecture-map`  
**Base branch:** `main`  
**Base SHA:** `c5bfddde6c5c2b3ce663827c5d2b9046d48707b2`  
**Architect role:** GPT defines and reviews the contract.  
**Implementer role:** Claude implements, tests, pushes, waits for CI, and stops for review.

This is canonical Dashboard V1 **Stage 4: Architecture Map**. It follows merged PR #5, which completed Overview, Focus, explicit reference resolution, producer-required Focus integrity validation, and bounded agent-handoff export.

## Mission

Replace the current flat region-name placeholder with a deterministic, accessible, human-scale architectural map that communicates only validated projection truth.

This stage implements:

1. a pure deterministic layout and routing model;
2. a responsive SVG map for regions, components, boundaries, contracts, and flows;
3. Structure and Authority lenses with stable geometry;
4. precise Focus navigation through stable identifiers;
5. an equivalent semantic relationship surface for keyboard and assistive-technology users;
6. honest partial, empty, unresolved-reference, and unavailable states.

This stage does not introduce live data transport, source browsing, mutation controls, a graph explorer, or new architectural semantics.

## Read first

Treat these as requirements, not inspiration:

- `docs/architecture-dashboard-v1.md`, especially §§3, 5, 6.2, 7, 9, 10, 12-15, 18, and 19
- `docs/dashboard-projection-v1.schema.json`
- `contract/generated/dashboard-projection-v1.ts`
- `docs/fixtures/dashboard-projection/v1/**`
- `src/router.ts`
- `src/shell.ts`
- `src/views/map.ts`
- `src/views/focus.ts`
- `src/adapter/reference-index.ts`
- `src/adapter/focus-integrity.ts`
- merged PR #4 and PR #5 review history

The producer-consumer pin remains authoritative. Do not modify generated contract types manually and do not change the projection or handoff schema in this PR.

Before architecture-sensitive editing, load `.sensei/skills/sensei-architect/SKILL.md` and use the repository's current Sensei workflow. Until checkout-domain binding is available in the installed Sensei version, pass the domain explicitly:

```bash
sensei briefing --domain github.com/globulario/sensei-dashboard --file <path>
```

An empty or degraded protection/briefing result is not evidence that the file is safe.

## Architectural laws

### A. Sensei owns truth; the map owns geometry

The dashboard may calculate positions, dimensions, routes, clipping, viewport transforms, and visual emphasis. Those are communication mechanics.

The frontend must not calculate or infer:

- architectural ownership or authority;
- health, integrity, completeness, availability, risk, importance, centrality, or priority;
- missing contracts or flows from code or collection counts;
- new relationships from proximity, shared names, matching prefixes, or graph traversal;
- hidden groupings not supplied through explicit region, component, boundary, contract, flow, or visual-anchor fields.

Every rendered architectural element and relationship must come from an explicit validated projection object or reference.

### B. Layout is deterministic and reproducible

For the same projection semantic input, repeated layout runs must produce the same nodes, coordinates, dimensions, ports, edge routes, labels, and ordering.

The implementation must not use:

- force simulation;
- random seeds;
- current time;
- browser-measured text as a layout input;
- unordered object or map iteration;
- viewport size as a semantic ordering input.

Array order alone must not make layout unstable. Use explicit owner hints and stable identifiers as deterministic keys.

### C. Lens changes emphasis, not architectural identity or geometry

Structure and Authority use the same layout model and coordinates. Switching lenses may change visibility, line weight, opacity, labels, and explanatory legend text, but must not move regions, components, boundaries, or relationship routes.

The six canonical lens identifiers remain preserved by the product contract. This PR implements only:

- `structure`
- `authority`

A canonical but unimplemented lens (`behavior`, `risk`, `change`, or `closure`) must produce an explicit unavailable-lens state or control treatment. It must not silently become Structure while claiming the requested lens is active.

### D. Explicit references only

The map may resolve only explicit identifiers present in:

- `region.component_refs`;
- `component.region_ref`;
- `component.authority_refs`;
- `boundary.member_refs`;
- `contract.source_ref` and `contract.target_ref`;
- `contract.boundary_refs`;
- `flow.steps[*].element_ref`;
- `flow.steps[*].contract_ref`.

Do not expand transitively, infer adjacency, derive a dependency from containment, or manufacture a relationship because two elements share a region.

### E. Unknown and incomplete states remain visible

Missing or unresolved references must never be repaired with a similarly named object. A relationship with an unresolved endpoint must not be drawn to a guessed target.

The UI must distinguish:

- no map elements supplied;
- partial projection with limitations;
- unresolved explicit references;
- unsupported lens;
- selected element absent from this revision;
- projection unavailable or invalid.

None of these states means the architecture is safe, healthy, or relationship-free.

### F. Visual meaning is redundant

Color may support meaning but never carry it alone. State and relationship distinctions require labels, line patterns, icons, text, or accessible descriptions.

No essential content may exist only in hover behavior.

## Deliverables

## 1. Pure map model

Introduce a pure, testable map-model/layout boundary. Names may follow repository conventions, but the ownership must remain clear.

Suggested shape:

```ts
interface ArchitectureMapModel {
  projectionId: string;
  bounds: Rect;
  lanes: MapLane[];
  regions: MapRegionNode[];
  components: MapComponentNode[];
  boundaries: MapBoundary[];
  contracts: MapContractEdge[];
  flows: MapFlowPath[];
  diagnostics: MapDiagnostic[];
}
```

The pure owner must:

- receive an already validated `SenseiDashboardProjectionV1`;
- return plain immutable data with no DOM nodes;
- preserve stable ids and source objects or typed references;
- centralize deterministic sorting, dimensions, placement, ports, and routing;
- never fetch, read globals, inspect the DOM, or mutate the projection;
- expose diagnostics instead of throwing on a bounded unresolved relationship;
- fail typed for impossible internal layout states.

Rendering code consumes this model. It must not independently recalculate layout or relationship meaning.

## 2. Deterministic placement contract

The implementation may choose exact numeric constants, but they must be centralized and tested.

### 2.1 Stable ordering

Use these deterministic keys:

**Regions**

1. normalized `visual_anchor.lane` token, with missing/null in one documented default lane;
2. `visual_anchor.order` ascending;
3. normalized `visual_anchor.group` token;
4. stable region id ascending.

**Components inside a region**

1. normalized component `visual_anchor.lane` token;
2. `visual_anchor.order` ascending;
3. normalized component `visual_anchor.group` token;
4. stable component id ascending.

Do not sort by name, state, severity, collection size, attention count, or any locally calculated notion of importance.

### 2.2 Region and component geometry

- Regions are visibly bounded containers with stable labels and responsibility text available through accessible description or progressive disclosure.
- Components are placed inside the region named by their explicit `region_ref`.
- Fixed design metrics or deterministic content-independent size classes are preferred over DOM text measurement.
- Component count may determine required geometric capacity, but must not be presented as architectural importance.
- A component whose `region_ref` cannot be resolved is not inserted into a guessed region. Surface it in diagnostics.
- `region.component_refs` may be used as an integrity cross-check, but not to invent placement that contradicts `component.region_ref`.
- A mismatch between the two explicit directions must be visible as a projection diagnostic. Do not silently choose a union and hide the conflict.

### 2.3 Lane and group hints

`visual_anchor.lane` and `visual_anchor.group` are owner hints, not architectural entities.

- Lanes create deterministic layout bands or columns.
- Groups may create stable subdivisions or labels inside a lane/region.
- Missing hints use documented neutral defaults.
- The UI must not describe a lane/group as a domain, owner, subsystem, or authority unless the projection supplies that meaning elsewhere.

### 2.4 Spatial stability

Prove at least:

- repeated layout of identical input is byte-equivalent after canonical serialization;
- shuffled input arrays produce identical geometry and routes;
- switching Structure to Authority leaves all coordinates and routes unchanged;
- adding an element to one region does not reorder unrelated lanes or regions;
- no two component rectangles overlap;
- every component rectangle remains inside its region container.

## 3. Relationship routing

Render only explicit projection relationships.

### 3.1 Contracts

For each contract:

- resolve the exact source and target stable ids;
- preserve direction exactly: `source_to_target`, `target_to_source`, `bidirectional`, or `undirected`;
- retain id, name, kind, state, summary, boundary refs, and Focus target;
- use deterministic source/target ports and orthogonal or otherwise explicitly bounded routing;
- route through dedicated gutters so edges do not run through unrelated node interiors;
- offset parallel relationships deterministically by stable id;
- use a deterministic self-loop shape when source and target are the same;
- omit the geometric edge and emit a visible diagnostic when an endpoint is unresolved.

Do not merge two contracts because they share endpoints. They remain distinct selectable architectural records.

### 3.2 Flows

For each flow:

- preserve step order exactly from `steps[*].order`, with stable-id tie-breaking only for invalid duplicate order diagnostics;
- connect only consecutive explicit `element_ref` steps;
- show the optional explicit `contract_ref` when supplied;
- do not infer skipped steps, alternate paths, or an endpoint outside the declared sequence;
- preserve flow id, name, kind, state, summary, and Focus target;
- use a distinct non-color-only visual pattern from contracts;
- emit diagnostics for unresolved step or contract refs rather than inventing a route.

All owner-supplied flows are already the bounded projection set. The frontend must not rank or suppress them by locally calculated importance.

### 3.3 Boundaries and authority references

Boundaries must be represented without implying a geometric enclosure the projection does not prove.

A permitted implementation is a deterministic labelled boundary rail/band with explicit membership connectors. A true enclosure is allowed only when it encloses exactly the resolved `member_refs` and does not accidentally imply membership for unrelated nodes.

Requirements:

- preserve boundary id, name, kind, state, summary, member refs, and Focus target;
- show unresolved members as diagnostics;
- component `authority_refs` may emphasize direct links to the referenced boundary/authority object only;
- `contract.boundary_refs` may emphasize the explicit crossing only;
- do not infer that every contract crossing region geometry crosses an authority boundary;
- do not synthesize ownership from containment.

## 4. SVG renderer

Replace `src/views/map.ts`'s Stage 1 placeholder with a responsive SVG-based renderer consuming the pure map model.

Requirements:

- one stable `viewBox` derived from model bounds;
- responsive width without recomputing semantic geometry;
- region and component labels readable at the default fitted view where practical;
- relationship labels exposed without requiring permanent edge clutter, using a selected/linked relationship panel or semantic companion list;
- deterministic SVG element and marker ids scoped by projection/map identity to avoid document collisions;
- safe text rendering through DOM APIs, never string-concatenated untrusted markup;
- no SVG `foreignObject` dependency for core meaning;
- no canvas-only rendering because the map must preserve accessible DOM structure and testability;
- no external layout or graph dependency unless an `ARCHITECT QUESTION` demonstrates why a small local deterministic implementation is insufficient.

The visual layer order must be stable and documented. A reasonable order is:

1. region/lane backgrounds;
2. boundary overlays or rails;
3. contract and flow routes;
4. component and region foreground nodes;
5. labels, selected state, and focus indicators.

## 5. Lenses and URL state

Add an explicit Architecture Map lens control.

### 5.1 Supported behavior

- Default lens: `structure`.
- Implemented lenses: `structure`, `authority`.
- Preserve the current `fixture`, revision, and unrelated query context.
- Lens changes update the canonical URL so reload, browser back/forward, copied links, and new tabs preserve the same lens.
- Existing route-query preservation and malformed-URL safety from PR #4 must remain green.
- An unknown lens token must not crash the map.
- A recognized but unimplemented canonical lens must be shown honestly as unavailable in this build.

### 5.2 Structure lens

Structure emphasizes:

- region containers;
- component containment;
- explicit contracts;
- explicit flows;
- stable names and responsibilities.

Boundaries remain available but visually secondary.

### 5.3 Authority lens

Authority uses identical geometry and emphasizes only explicit:

- boundary objects;
- component `authority_refs`;
- boundary membership;
- contract `boundary_refs`;
- authority/ownership/trust/domain boundary kinds as already supplied.

The frontend must not decide that a component is authoritative merely because it is central, highly connected, or positioned near a boundary.

## 6. Selection, Focus, and navigation

Every selectable map record must use its stable id.

- Region, component, boundary, contract, and flow affordances deep-link to `/element/:id` through the centralized route/href helper.
- Preserve current query context including `fixture` and `lens`.
- Do not use display names as route identity.
- A visual edge may be difficult to operate directly with keyboard or touch, so provide an equivalent semantic relationship list or panel with Focus links.
- Browser back/forward must preserve map lens and route meaning.
- Selection/focus styling must not move the map.
- Do not create a source-file browser or symbol-navigation surface.

## 7. Accessibility

At minimum:

- a semantic heading names the Architecture Map;
- the lens control has a programmatic label and keyboard operation;
- SVG has a useful accessible name and description;
- regions/components have stable accessible labels containing name, kind, state, and stable id;
- contracts, flows, and boundaries are reachable through an equivalent semantic list even when their SVG shape is not reliably keyboard-operable;
- visible focus treatment exists for all interactive elements;
- state and relationship kinds are not communicated by color alone;
- no essential content exists only in hover tooltips;
- reduced-motion preferences remain respected;
- zoom is not required to discover the names of major regions;
- diagnostics use appropriate live-region or alert semantics only when they arise from an interaction, not as noisy page-load announcements.

## 8. Honest bounded states

### 8.1 Empty projection

When no regions/components are supplied, show a neutral map-empty state:

> No architectural elements were supplied for this projection.

Do not say the repository has no architecture.

### 8.2 Partial projection

Retain the existing projection-level partial banner and limitations. The SVG must not hide the fact that the rendered map is bounded by partial observation.

### 8.3 Unresolved explicit refs

Display a bounded diagnostics section containing:

- source record id and kind;
- unresolved stable id;
- relationship field involved;
- neutral explanation that the map omitted the unresolved geometry.

Do not fabricate a target or drop the problem silently.

### 8.4 Unsupported lens

A canonical but unimplemented lens must show that the lens is not implemented in this build and offer the implemented Structure/Authority choices. Do not label the result as the requested lens while drawing Structure.

### 8.5 No relationships

When contracts, flows, or boundaries are empty, render a neutral absence-of-supplied-records state. Do not claim there are no dependencies, workflows, or authority boundaries in the repository.

## 9. Synthetic map-rich proof fixture

The currently accepted producer fixtures may not contain enough regions, boundaries, contracts, and flows to visually prove every Stage 4 path.

One clearly labelled dashboard-local synthetic fixture is permitted only for isolated map proof.

Requirements:

- place it under the existing `_synthetic` fixture namespace, not under the pinned producer fixture tree;
- validate it against the pinned projection schema;
- mark repository display/availability text explicitly as synthetic test data;
- include at least three regions, multiple components, two boundary kinds, parallel contracts, a bidirectional contract, a self-contract, and a multi-step flow;
- include partial/unknown/contested states without implying they came from Sensei production output;
- use `active_context: null`;
- do not add it to `contract/pin.json` or claim producer parity;
- default development mode remains the accepted `real-repo` fixture;
- tests must ensure the synthetic fixture cannot silently become the default.

If the existing fixture adapter cannot support this without broadening its contract, use a test-only typed fixture builder instead and provide browser proof through another explicitly bounded route.

## 10. Component boundaries

Preserve the current architecture:

- adapter owns fetch, parsing, schema validation, and producer-required semantic validation;
- Shell owns asynchronous loading and stale-render cancellation;
- views remain synchronous where practical;
- the pure map model/layout owner has no DOM or transport dependency;
- rendering code does not mutate projection or model;
- route/href generation remains centralized;
- the existing reference index may be reused for exact labels and links, but not extended into graph traversal;
- no UI-framework migration or design-system dependency without an architect-approved amendment.

A small number of focused modules is preferred over one giant `map.ts`. Suggested boundaries:

```text
src/map/model.ts
src/map/layout.ts
src/map/routing.ts
src/map/render-svg.ts
src/map/lens.ts
src/map/diagnostics.ts
```

Exact names may differ. Ownership must not blur.

## 11. Tests and required proof

Add or extend automated tests proving at least:

### Model and determinism

- identical input creates identical canonical model output;
- shuffled regions/components/boundaries/contracts/flows create identical output;
- projection objects and arrays are not mutated;
- owner hint ordering and stable-id tie-breaking are exact;
- duplicate ids or contradictory explicit placement produce diagnostics, not guessed repair;
- empty collections produce honest bounded models.

### Geometry

- component rectangles do not overlap;
- components stay inside their explicit region;
- region/lane ordering is stable;
- Structure and Authority coordinates are identical;
- adding one component does not reorder unrelated regions/lanes;
- bounds contain every rendered node and route.

### Routing

- contract direction markers are correct for all four direction tokens;
- parallel contracts receive stable distinct routes;
- self-contract routing is stable;
- routes do not cross unrelated node interiors;
- flow step order is preserved exactly;
- unresolved contract/flow/boundary refs generate diagnostics and no guessed edge;
- no transitive or inferred relationship is introduced.

### Rendering and lenses

- default route uses Structure;
- Authority changes emphasis without geometry change;
- lens query survives navigation, reload, and Focus links;
- unknown lens does not crash;
- recognized unimplemented lens is honest;
- SVG ids are deterministic and collision-safe;
- unsafe projection text never becomes markup;
- partial limitations remain visible.

### Accessibility

- lens control is labelled and keyboard-operable;
- map has an accessible name/description;
- every selectable region/component has a stable Focus link;
- boundaries/contracts/flows have an equivalent semantic relationship list;
- state/relationship distinctions have non-color text or pattern cues;
- no required information is hover-only.

### Fixtures and regression

- accepted default fixture renders without console errors;
- synthetic map-rich fixture validates and cannot become default;
- unavailable, partial, contested, empty, and unresolved-ref states remain honest;
- all PR #4 routing/staleness and PR #5 Overview/Focus/handoff tests remain green;
- producer pin, public-fixture parity, generated-type drift, and schema checks remain green.

## 12. Required commands

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

Also run the repository's current Sensei checks appropriate to the changed files and report the exact domain used. Do not claim full Sensei coverage when the installed graph or protection state is partial/degraded.

## 13. Required PR evidence

Before handing back for review, update the PR description or add one structured comment containing:

- exact base SHA and exact head SHA;
- concise file/directory overview;
- pure map model and layout ownership;
- deterministic ordering and geometry rules implemented;
- contract, flow, and boundary routing behavior;
- Structure and Authority lens behavior;
- query/deep-link behavior;
- map diagnostics and honest-state behavior;
- accessibility behavior and semantic relationship list;
- commands and results;
- Sensei briefing/preflight evidence and exact domain;
- GitHub Actions status on the exact head;
- screenshots of Structure and Authority using the same projection and viewport;
- proof or overlay showing coordinates are unchanged across those lens screenshots;
- screenshot of the accepted default fixture;
- screenshot of the labelled synthetic map-rich fixture if used;
- screenshot/test evidence for partial and unresolved-reference diagnostics;
- canonical serialized model digest from two repeated runs and from a shuffled-input run;
- known limitations;
- explicit confirmation that no frontend-authored architectural semantics, schema change, live transport, or mutation authority was introduced;
- deviations from this brief, or `None`.

## Explicit non-goals

Do not implement in this PR:

- Behavior, Risk, Change, or Closure map lens semantics;
- force-directed or physics-based layout;
- raw RDF/SPARQL or generic graph exploration;
- live Sensei adapter, polling, WebSockets, SSE, or MCP transport;
- live Claude, Codex, OpenAI, Gemini, or other agent invocation;
- governed-change application, mutation controls, approvals, or merge actions;
- full revision-comparison UI;
- source-code browsing, file tree, or symbol explorer;
- frontend-authored ranking, scoring, health, risk, importance, or confidence;
- inference from artifact counts, filename similarity, or geometric proximity;
- new projection or handoff schema fields;
- schema-version changes;
- producer fixture changes inside the pinned tree;
- GitHub Pages deployment changes unrelated to map assets;
- authentication;
- Tauri or VS Code embedding;
- broad visual redesign unrelated to the Architecture Map.

## Stop conditions

Stop and post an `ARCHITECT QUESTION` before coding around any of these:

- a required map relationship meaning is absent from the projection;
- the accepted fixtures contradict the explicit reference model;
- component placement requires choosing between contradictory producer fields without a diagnostic path;
- a required visual distinction would require inventing architectural severity, importance, or ownership;
- satisfying deterministic routing appears to require a new schema field;
- an external graph/layout dependency appears necessary;
- the existing router cannot preserve a typed lens without an unbounded rewrite;
- accessible relationship operation appears to require information not present in the projection;
- the map requires live transport or source inspection;
- Sensei protection/briefing is degraded in a way that makes architecture-sensitive edits unverifiable;
- this brief conflicts with the pinned schema or merged PR #5 behavior.

Do not patch semantic gaps with local heuristics.

## Handoff protocol

When implementation and CI are ready, post:

```text
IMPLEMENTATION READY FOR ARCHITECT REVIEW

Architect brief: docs/claude-stage-4-map-brief.md
Base SHA: c5bfddde6c5c2b3ce663827c5d2b9046d48707b2
Head SHA: <exact>

Implemented:
- ...

Map evidence:
- model/layout owner:
- deterministic geometry:
- contract/flow/boundary routing:
- Structure lens:
- Authority lens:
- diagnostics:
- accessibility:

Sensei evidence:
- domain:
- briefing/preflight:
- coverage limitations:

Verification:
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

Then stop. Do not merge and do not begin live transport, Evolution comparison, or another lens.