# Stage 1 architecture notes

Implements `docs/claude-stage-1-brief.md`. This note describes the
structure that landed, for whoever picks up Overview/Focus (Stage 3) or the
Architecture Map (Stage 4) next.

## Frontend stack: Vite + vanilla TypeScript, no UI framework

Stage 1 is a shell, four routes, and honest-state rendering — no complex
interactive state, no component tree deep enough to need a framework's
diffing/reactivity. `claude-stage-1-brief.md` §1 explicitly requires
evaluating whether a framework "materially reduces complexity" before
adding one; for this scope it did not. All DOM construction uses direct
`document.createElement`/`replaceChildren` calls (see `src/shell.ts`,
`src/views/*.ts`). If the Architecture Map (Stage 4) turns out to need
real interactive/reactive state management, that is the point to
re-evaluate — not before.

No CSS framework or design system either — `src/style.css` is hand-written,
scoped to making the honest states (`state-block--*` classes) visually
distinct, per §5's "no large dependency stack" instruction.

## The validated adapter boundary

`src/adapter/types.ts` defines the one interface every view depends on,
`ProjectionAdapter`. Nothing outside `src/adapter/` ever calls `fetch`,
parses JSON, or touches ajv. The boundary is deliberately narrow:

```
fetch → JSON.parse → validateProjection() (real Draft 2020-12, ajv,
        against the pinned docs/dashboard-projection-v1.schema.json)
      → ProjectionOutcome (loading | available | unavailable | invalid | disconnected)
```

Once a `ProjectionOutcome` crosses that boundary as `status: "available"`,
its `projection` field is the real, generated `SenseiDashboardProjectionV1`
type (`contract/generated/dashboard-projection-v1.ts`, produced in
`sensei-dashboard#3`) — not `any`, not a partially-validated shape. Views
never see raw JSON and never repair or default a missing field themselves
(`claude-stage-1-brief.md` §2).

`StaticFixtureAdapter` (`src/adapter/static-fixture-adapter.ts`) is the one
implementation this stage ships. It resolves a named fixture set (default:
`real-repo`, the accepted Sensei fixture; see `?fixture=` in
`src/main.ts`) to a URL under `/fixtures/...` and fetches it exactly the
way a GitHub Pages static snapshot deployment would.

### Where a future live adapter attaches

A live adapter is a second class implementing `ProjectionAdapter` —
`loadProjection()`/`loadFocusRecord()`/`capabilities()` — that calls a real
Sensei endpoint instead of `fetch`-ing a static file, and reports
`capabilities().mode === "live"`. No view, no router, and no shell code
changes: `src/main.ts` is the only place that decides which adapter
implementation to construct. This stage does not invent that endpoint or
protocol (`claude-stage-1-brief.md` §3, "Do not invent a backend protocol
in this repository").

## Route model

Four stable routes (`src/router.ts`), matching `claude-stage-1-brief.md`
§4 exactly: `/` and `/overview` (Overview), `/map` (Architecture Map),
`/element/:elementId` (Focus), `/evolution` (Evolution). A fifth named
surface, Agent Handoff (`architecture-dashboard-v1.md` §6.5), has no route
of its own in Stage 1 — it is Stage 3 scope
(`claude-stage-1-brief.md`'s non-goals explicitly exclude "agent handoff
envelope generation"). It appears only as a disabled, honestly-labeled
"Ask Agent" affordance inside Focus (`src/views/focus.ts`), so the surface
is visible without being implemented.

Element ids are percent-encoded when building a link (`elementHref()`) and
decoded when parsing a route — the `stableId` pattern in the schema permits
characters (`/`, `#`, `@`, `:`) that are meaningful in a URL path, so the
raw id is never placed directly into a path segment. Optional `lens` and
`revision` query parameters round-trip through `Route.query` even though
no view reads them yet.

## Component/view boundaries

- `src/shell.ts` owns the persistent chrome (header, identity strip, nav,
  main content region) and the one `loadProjection()` call per route
  render. It renders the shared honest-state block
  (`src/state/render-states.ts`) and returns before calling into a
  view-specific renderer whenever the outcome isn't `"available"`.
- `src/views/*.ts` each export one `render*(container, projection, ...)`
  function. They only run once the shell has already confirmed
  `status: "available"` — a view can assume `projection` is real, validated
  data, never `undefined` or partially-shaped.
- `src/views/focus.ts` is the one view that calls the adapter itself
  (`loadFocusRecord`), since which record to show depends on the route's
  `elementId`, not just the already-loaded projection.

No component in this stage consumes raw triples, computes health/
integrity/completeness, or invents a metric the schema doesn't already
carry (`claude-stage-1-brief.md`, non-goals and acceptance criterion 5).

## Honest states

`src/state/render-states.ts` is the single place that decides how to
render `loading`, `disconnected` (missing snapshot / network failure),
`invalid` (failed schema validation), `unavailable` (a validated
projection whose own `availability.state` says so), and the partial-
projection banner (`availability.state === "partial"`, with its
`limitations` shown verbatim). `renderUnknownElement()` covers a
deep-linked id with no matching focus record. Every view calls
`renderNonAvailableState()` first; none of them re-implement this
decision. `public/fixtures/_synthetic/` documents the two hand-authored
test fixtures (a fully-`available` projection and a schema-invalid one)
needed because no accepted Sensei fixture currently reports `available` —
see that directory's README for why.
