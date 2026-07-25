# Claude implementation brief: Evolution and integration

**Status:** Draft implementation contract for a future PR
**Target repository:** `globulario/sensei-dashboard`
**Base branch:** `main`
**Base SHA:** `8a45f3f1e237a2e83352b01fcd417a3898efe2b4` (tip of `main` at brief-authoring time; the implementer must re-pin this against the actual base SHA of the branch they open)
**Architect role:** defines and reviews the contract.
**Implementer role:** implements, tests, pushes, waits for CI, and stops for review.

This is canonical Dashboard V1 **Stage 5: Evolution and integration**, per `docs/architecture-dashboard-v1.md` §19's exact list: revision comparison, Change lens, GitHub Pages snapshot mode, Sensei live serving, VS Code deep links, visual polish and performance verification. It follows merged PR #6 (Stage 4: deterministic Architecture Map, Structure and Authority lenses).

## Mission

Close out Dashboard V1 by making the projection's own `evolution` block a first-class, well-rendered surface; adding Change as the map's third implemented lens; making the static build a real, publishable GitHub Pages snapshot; and auditing visual/performance polish against the mockup direction already committed to this repository.

Two of the six listed deliverables — **Sensei live serving** and **VS Code deep links** — have a real, evidenced blocker each (below). This brief does not pretend those blockers don't exist. Each gets a narrowed, honestly-scoped deliverable plus an explicit stop condition, rather than an invented backend or an invented extension to satisfy the letter of the stage list.

## Read first

Treat these as requirements, not inspiration:

- `docs/architecture-dashboard-v1.md`, especially §3.4, §6.4, §7, §11, §17, §19, §20
- `docs/claude-stage-4-map-brief.md` — the immediately preceding stage's brief; this document reuses its architectural laws, module-boundary discipline, and honest-state vocabulary rather than re-deriving them
- `contract/generated/dashboard-projection-v1.ts` — `Evolution`, `Change`, `Capabilities` types already exist and are unchanged by this stage
- `docs/fixtures/dashboard-projection/v1/**`, especially `evolution-first-revision/projection.json` (the only fixture demonstrating the honest first-revision state) and `public-redacted/projection.json` (the only fixture with `active_context: null` produced specifically for public distribution)
- `src/views/evolution.ts`, `src/router.ts`, `src/adapter/types.ts`, `src/adapter/static-fixture-adapter.ts`
- `src/map/lens.ts`, `src/map/render-svg.ts`, `src/map/model.ts` — the lens/model infrastructure this stage extends, not replaces
- `.github/workflows/dashboard-app.yml`, `.github/workflows/contract-parity.yml`, `vite.config.ts`
- `docs/architecture/layout/*.png` — the committed visual-direction mockups; the current app is deliberately plain and CSS-restylable toward this, not yet restyled (see §6 below)
- merged PR #6's review history (three ARCHITECT REVIEW rounds) for the reference-kind and shared-model-ownership discipline this stage's Change lens work must not repeat gaps in

Before architecture-sensitive editing, load `.sensei/skills/sensei-architect/SKILL.md` and follow the repository's current Sensei workflow, passing the domain explicitly:

```bash
sensei briefing --domain github.com/globulario/sensei-dashboard --file <path>
```

`docs/awareness/high_risk_files.yaml` already lists `src/map/{model,layout,routing}.ts`, the schema/pin files, and several adapter/shell files as high-risk with real, evidenced invariants attached (from PR #6's review cycle) — an empty or degraded briefing elsewhere is not evidence that a file is safe.

## Architectural laws

All of PR #6's laws (A–F) still apply without modification: Sensei owns truth, the map/evolution surfaces own only presentation of what's explicitly supplied; layout stays deterministic; a lens changes emphasis only, never geometry; only explicit reference fields resolve; unknown/incomplete states stay visible; color is never the sole carrier of meaning. Two additions specific to this stage:

### G. A live adapter is only as real as its producer contract

`ProjectionAdapter`, `AdapterCapabilities`, and any live-mode UI must not silently assume a producer capability that is not actually documented and implemented on the Sensei-core side. An untested assumption about a live endpoint's shape is exactly the failure class PR #6's reference-kind reviews spent three rounds correcting inside this repository alone — do not import an unreviewed version of the same mistake from a cross-repo assumption.

### H. A stage boundary is not an excuse to weaken an earlier stage's honesty

Extending `evolution.ts` or adding the Change lens must not regress any Stage 3/4 honest-state, accessibility, or determinism guarantee. Every Stage 4 required test (`npm run test:app`) must stay green throughout this stage, not just at the end.

## Deliverables

### 1. Evolution view: full rendering of the existing embedded diff

`src/views/evolution.ts` today is a Stage 1 placeholder: one summary line, changes as flat `[impact] title — summary` list items, no resolved references, no provenance, and an explicit `"Revision comparison ... is not implemented in Stage 1"` placeholder string still present. Nothing here requires a schema change — `Evolution`/`Change` have carried `element_refs`, `impact`, `kind`, and `provenance` since Stage 1's pinned contract.

Bring it to the same rigor as Focus (`src/views/focus.ts`) and the Map's relationship list (`src/map/render-svg.ts`'s `buildRelationshipList`):

- Render `evolution.availability`/`.limitations` honestly (reuse `renderPartialBannerIfAny` and the existing partial-projection pattern from `render-states.ts`; do not invent a new banner shape).
- For each `Change`: stable id, kind (as visible text, not color-only), title, summary, `impact` token (`improved | degraded | changed | unknown` — render exactly as supplied, never re-derive or re-rank it), resolved `element_refs` via `ReferenceIndex` (unresolved refs become a visible diagnostic exactly like Focus's `referenceList`, never a silently dropped link), and a provenance disclosure (`provenanceDisclosure` from `dom.ts`, reused not reimplemented).
- Honest empty states, distinguished exactly as the schema distinguishes them: no prior revision (`base_revision === null`, `evolution-first-revision` fixture) vs. a real prior revision with zero recorded changes (`contested` fixture today happens to be this case) vs. `evolution.availability !== "available"`. Three different sentences, not one collapsed empty state.
- Remove the Stage 1 placeholder string once the real rendering supersedes it.

### 2. Change lens (the map's third implemented lens)

Stage 5's "Change lens" is a **map lens**, not a separate rendering surface — `architecture-dashboard-v1.md` §7 defines all six lenses (Structure, Authority, Behavior, Risk, Change, Closure) as changing "emphasis, not the identity or layout of the architecture," and `src/map/lens.ts` already carries the full six-token `MapLens` union with `IMPLEMENTED_MAP_LENSES` currently `["structure", "authority"]`. This stage adds `"change"` to that list. It does not add Behavior, Risk, or Closure — those remain `unimplemented_canonical` per the existing honest-unsupported-lens state, unchanged from Stage 4 (§19 of the product contract explicitly permits deferring them past Stage 5).

Requirements, following Stage 4's established discipline exactly:

- `buildArchitectureMapModel` still takes no lens parameter. Change-lens emphasis is computed in `render-svg.ts` from data the model already exposes — specifically, resolve `projection.evolution.changes[*].element_refs` against the same model (regions/components/boundaries/contracts/flows) used for Structure/Authority, using the same reference-kind diagnostic discipline PR #6 established (`unresolved_reference` for a genuinely nonexistent id, `unrendered_reference_kind` for a real id of an unrendered kind — reuse `ReferenceIndex`/the model's existing resolution, do not reinvent a third resolver).
- Emphasis may use `impact` (`improved | degraded | changed | unknown`) as a visual class exactly the way Structure/Authority already key classes off `state`/`kind` — text-visible, never color-only, consistent with Law F.
- Structure/Authority/Change coordinates must be provably identical (extend the existing `render-svg.test.ts` byte-identical-geometry-attribute assertion to cover all three lenses pairwise, not just Structure vs. Authority).
- A companion "Changes in this view" list (mirroring the Map's existing relationship-list pattern) is required for keyboard/assistive-technology access to which elements changed and why, exactly the way contracts/flows/boundaries already have one.
- Do not infer a change for an element merely because it is spatially near a changed element, and do not rank/sort elements by "how much" they changed — `impact` is a supplied enum, not a magnitude.

### 3. GitHub Pages snapshot mode

No Pages deploy workflow exists today (`.github/workflows/` has only `dashboard-app.yml` build+test and `contract-parity.yml`). `vite.config.ts`'s `base: "./"` is already Pages-compatible by design (per its own comment), and `public/fixtures/**` is already the real static data source, byte-parity-tested against `docs/fixtures/**` by `src/test-support/public-fixtures-parity.test.ts`.

- Add a deploy workflow (e.g. `.github/workflows/pages.yml`) that builds on push to `main` and publishes `dist/` via GitHub's official Pages actions (`actions/upload-pages-artifact` + `actions/deploy-pages`), gated the same way `dashboard-app.yml` is on relevant path changes plus the workflow file itself.
- Per `architecture-dashboard-v1.md` §11 ("A public static snapshot redacts `active_context` by default... The frontend does not decide what is safe to publish"): the Pages-deployed build's *default* fixture must not silently be `real-repo` (which is fine for local dev but was never produced as a public-safe snapshot). Decide and implement an explicit default-fixture selection for the Pages build specifically — the `public-redacted` fixture already exists for exactly this purpose. This is a build-time or adapter-default decision, not a runtime frontend judgment call; document exactly which mechanism you use (env var read at build time, a separate Pages-specific entry point, etc.) and why it doesn't let the frontend itself decide what's safe.
- Verify the deployed static site actually loads and navigates correctly (Overview/Map/Focus/Evolution, at least one Focus deep link) via a real browser check against either a local `vite preview` of the production build or the live Pages URL once deployed — this is a live-app check per this repository's own `run`/browser-verification convention, not just `npm run build` succeeding.

### 4. Sensei live serving — narrowed, with a required stop condition first

**Evidenced blocker:** `globulario/sensei`'s `proto/awareness_graph.proto` and `golang/server/` expose no RPC or HTTP endpoint that serves a `dashboard-projection-v1` document. The `golang/architecture/dashboardprojection` package (`types.go`, `validate.go`, `digest.go`, `schemavalidate.go`) is a **producer/validator library** used to build and check the static fixtures this repository already pins — it is not a live-serving surface, and none exists anywhere in that repository today.

**Required stop condition:** before writing any `LiveSenseiAdapter` implementation code, post an `ARCHITECT QUESTION` (per this brief's Stop Conditions section) asking Sensei core to specify — or confirm the absence of — a live dashboard-projection-serving contract (exact RPC/HTTP shape, auth, revision-listing semantics for `AdapterCapabilities.revisionCompare`). Do not invent this contract unilaterally the way the Stage 4 implementer initially inferred reference-kind scope from fixture shape instead of schema authority (PR #6, first ARCHITECT REVIEW finding) — that mistake cost three review rounds inside one repository; inventing a cross-repo wire contract unilaterally is the same mistake at higher cost.

**What is buildable now, independent of the answer:**

- The `ProjectionAdapter`/`AdapterCapabilities` interface extension needed to support a second, live-mode adapter at all — specifically, whatever method shape is needed for revision listing/comparison (`AdapterCapabilities.revisionCompare` has existed since Stage 1 and has always been `false`; nothing in the current interface can list or fetch a non-default revision). Design this interface extension, get it reviewed, and implement it against `StaticFixtureAdapter` first (which can honestly report `revisionCompare: false` and a single-revision-only implementation) so `LiveSenseiAdapter` has a real interface to implement once the wire contract is confirmed.
- A `LiveSenseiAdapter` skeleton with full test coverage against an in-repo mock HTTP/RPC server standing in for the not-yet-specified real endpoint, clearly labeled as testing the adapter's own logic (error handling, capability reporting, honest-state mapping) rather than proving live interoperability with the real Sensei server.
- Live-mode UI states (`CONFIGURED, NOT VERIFIED`-style distinctions, connection status) that don't depend on the endpoint's exact shape.

**Explicitly deferred until the architect question is answered:** actual wire-level integration with a real running `sensei serve` instance; any claim in the PR evidence that live mode has been proven against the real server.

### 5. VS Code deep links — narrowed to the inbound URL contract

**Evidenced blocker:** no VS Code extension exists anywhere in this repository or evidence of one having been started elsewhere for this project specifically. `architecture-dashboard-v1.md` §3.4 itself scopes the extension's job as thin ("The extension is not the canonical host for the full dashboard") but does not say Stage 5 builds that extension — and it is explicitly out of scope here (see Non-goals).

**What Stage 5 actually owns**, per §3.4's list read from the Dashboard's own side:

- **Inbound (already mostly satisfied):** document the existing `/element/:id?fixture=&lens=` URL shape (via `elementHref`, `withQueryParam`) as the stable, external-tool-facing deep-link contract — any external caller (a future VS Code extension, a shell script, a chat client) can already construct a correct deep link today. Confirm this with an explicit integration test asserting a hand-built URL string (not one produced by the app's own code) round-trips through `parseRoute` to the expected route+query, proving the contract is stable from the *outside*, not just internally self-consistent.
- **Outbound, and genuinely open:** `FocusRecord.source_links[*].target` is producer-supplied and currently rendered only through `externalSourceLink`'s `SAFE_LINK_SCHEMES = new Set(["http:", "https:"])` allowlist (`src/views/dom.ts`) — a `vscode://` (or similar editor-URI-scheme) target is rejected today as an unsafe scheme, rendered as plain text with a diagnostic. Whether and how to accept an editor URI scheme is a real, unresolved design decision requiring its own **ARCHITECT QUESTION** before touching `SAFE_LINK_SCHEMES`: which exact scheme(s) (`vscode://`, `vscode-insiders://`, `cursor://`, something producer-negotiated?), scoped to which field (`source_links` only, or anywhere a link renders?), and what proves a given `vscode://...` target is well-formed rather than merely scheme-safe. Widening a security-relevant allowlist without an explicit, reviewed answer to those questions is exactly the kind of unilateral decision this brief's stop conditions exist to prevent.

### 6. Visual polish and performance verification

- **Visual:** `docs/architecture/layout/*.png` (committed, user-authored mockups — dark theme, icon-decorated cards, a legend, boundary-kind-differentiated lines, severity color coding) is the real visual target; the current app is deliberately plain. The Map's own styling (`src/style.css`'s `.map-*` rules) was built with zero hardcoded colors specifically so this restyle would be CSS-only — verify that same property for Overview/Focus/Evolution (audit for any inline styles or non-parameterized colors that would block a pure-CSS pass) and either confirm it already holds or fix it as part of this deliverable. Actually reskinning to match the mockups pixel-for-pixel is not required by this stage unless you choose to do it; what's required is that nothing about the current implementation *blocks* doing so later without a refactor, proven the same way it was proven for the Map (class-parameterized elements, CSS custom properties, no hardcoded hex values in TypeScript).
- **Performance:** `architecture-dashboard-v1.md` §17 explicitly defers exact numeric budgets to "after fixture measurement" — this is that stage. Using the accepted fixtures plus `_synthetic-map-rich`, measure and record: initial render time, DOM node count, and Map interaction responsiveness (lens toggle, Focus navigation) at realistic fixture scale. Record actual numbers in the PR evidence; do not invent target numbers without measurement backing them.

## Component boundaries

Unchanged from Stage 4's established boundaries (`claude-stage-4-map-brief.md` §10): adapter owns fetch/parse/validation, Shell owns async loading and staleness, views stay synchronous, `src/map/model.ts`/`layout.ts`/`routing.ts` stay DOM-free, route/href generation stays centralized in `router.ts`, `ReferenceIndex` is reused for labels/links and never extended into traversal. This stage's new adapter work (`LiveSenseiAdapter`, the `ProjectionAdapter` extension) follows the same ownership split established in the AI-workspace contract review (PR #8 §11.1): a schema/contract that describes a Sensei-core-owned surface (a live projection endpoint) ships only once Sensei core has actually adopted and documented it — this repository does not get to unilaterally declare a producer contract on Sensei core's behalf.

## Tests and required proof

In addition to Stage 4's existing required-proof categories (all of which must remain green):

- Evolution: honest-state coverage for all three empty/partial states named in Deliverable 1; resolved/unresolved `element_refs` rendering; provenance disclosure present.
- Change lens: geometry-identical proof across Structure/Authority/Change (not just the existing pairwise check); diagnostics for changes referencing unresolved/wrong-kind elements; the companion changes list is keyboard-reachable.
- Pages: the byte-parity test (`public-fixtures-parity.test.ts`) stays green; a new test or documented manual check proves the Pages-specific default-fixture decision from Deliverable 3 actually takes effect in a production build.
- Live adapter: full unit coverage against the in-repo mock from Deliverable 4, explicitly not claimed as live-server-interoperability proof.
- Deep links: the external-URL round-trip test from Deliverable 5.
- No regression: `npm run test:app`, `npm test`, `npm run verify:pin`, `npm run typecheck`, `npm run build` all pass throughout, not just at handoff.

## Explicit non-goals

Do not implement in this stage:

- Behavior, Risk, or Closure map lens semantics (still explicitly deferrable past Stage 5 per the product contract)
- a real VS Code extension of any kind — editor/vscode/* files, a `package.json` for a VS Code extension, or any VS Code-API-dependent code
- live wire-level integration with a real `sensei serve` instance before the Deliverable 4 architect question is answered
- widening `SAFE_LINK_SCHEMES` before the Deliverable 5 architect question is answered
- arbitrary multi-revision browsing/history UI beyond the single embedded `base_revision`/`head_revision` diff already in the schema (that would require the same live-endpoint contract Deliverable 4 is blocked on)
- any schema or `contract/pin.json` change
- a pixel-exact reproduction of `docs/architecture/layout/*.png` (restylability is required; the restyle itself is optional for this stage)
- Tauri, desktop packaging, or any `sensei-runner`/AI-architect-workspace work (that is issue #7 / PR #8's separate track, explicitly not this stage)

## Stop conditions

Stop and post an `ARCHITECT QUESTION` before coding around any of these:

- **Required, before Deliverable 4 begins:** Sensei core's live dashboard-projection-serving contract is unspecified (confirmed unspecified as of this brief's authoring — see Deliverable 4).
- **Required, before Deliverable 5's outbound half begins:** the accepted editor-URI scheme(s) and their exact scope are unspecified (confirmed unspecified as of this brief's authoring — see Deliverable 5).
- the Pages-specific default-fixture mechanism (Deliverable 3) appears to require a runtime frontend judgment call about what's safe to publish, rather than a build-time/producer-driven decision
- a required Change-lens visual distinction would require inventing severity, importance, or a ranking `impact` does not itself supply
- the existing `ProjectionAdapter` interface cannot be extended for revision listing without an unbounded rewrite of `StaticFixtureAdapter` or `Shell`
- Sensei protection/briefing is degraded in a way that makes an architecture-sensitive edit unverifiable
- this brief conflicts with the pinned schema or any merged prior-stage behavior

Do not patch a semantic or cross-repo gap with a local heuristic.

## Required commands

From a clean checkout, run and report:

```bash
npm ci
npm run verify:pin
npm test
npm run typecheck
npm run test:app
npm run build
```

Plus a real browser check of the production build (local `vite preview` or the deployed Pages URL) per Deliverable 3.

Also run the repository's current Sensei checks appropriate to the changed files and report the exact domain used (`github.com/globulario/sensei-dashboard`). Do not claim full Sensei coverage when the graph or protection state is partial/degraded for a touched file.

## Required PR evidence

Before handing back for review, update the PR description or add one structured comment containing:

- exact base SHA and exact head SHA
- concise file/directory overview
- Evolution rendering behavior and honest-state coverage
- Change lens: geometry-identity proof, diagnostics behavior, companion list
- Pages deploy: workflow added, default-fixture decision and mechanism, live/preview verification evidence
- Live adapter: architect-question status/answer, what was built vs. deferred, mock-only test scope stated explicitly
- Deep links: external round-trip test evidence, architect-question status/answer for the outbound scheme question
- Visual/performance: restylability audit result, measured performance numbers with the fixture/scale they were measured against
- commands and results
- Sensei briefing/preflight evidence and exact domain
- GitHub Actions status on the exact head
- known limitations
- explicit confirmation that no frontend-authored architectural semantics, schema change, live transport claimed-but-unproven, or mutation authority was introduced
- deviations from this brief, or `None`

## Handoff protocol

When implementation and CI are ready, post:

```text
IMPLEMENTATION READY FOR ARCHITECT REVIEW

Architect brief: docs/claude-stage-5-brief.md
Base SHA: <exact>
Head SHA: <exact>

Implemented:
- ...

Evolution evidence:
- honest-state coverage:
- resolved/unresolved references:

Change lens evidence:
- geometry identity across Structure/Authority/Change:
- diagnostics:
- companion list:

Pages evidence:
- workflow:
- default-fixture decision:
- live/preview verification:

Live adapter evidence:
- architect question / answer:
- scope built vs. deferred:

Deep link evidence:
- external round-trip test:
- outbound-scheme architect question / answer:

Visual/performance evidence:
- restylability audit:
- measured numbers:

Verification:
- npm run verify:pin: PASS
- npm test: PASS
- npm run typecheck: PASS
- npm run test:app: PASS
- npm run build: PASS
- GitHub Actions: PASS

Deviations:
- None | ...

HANDOFF: ARCHITECT REVIEW
```

Then stop. Do not merge and do not begin any AI-architecture-workspace (issue #7 / PR #8) implementation work from this handoff.
