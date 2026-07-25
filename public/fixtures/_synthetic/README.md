# Synthetic fixtures

These two files are **not** part of the accepted Sensei fixture set recorded
in `contract/pin.json`. They are hand-authored, clearly-labeled test data
used only to exercise UI states no accepted fixture currently demonstrates:

- `available.json` — every accepted fixture from Sensei's producer is
  honestly `partial` or `unavailable` (regions, flows, and
  architecture_health are not yet authored on the producer side — see
  `sensei-dashboard#3` / `sensei#116`). Stage 1 still needs to prove the
  fully-`available` rendering path works, so this fixture exists solely for
  that purpose. Its `identity.repository.display_name` and
  `availability.summary` both say so explicitly.
- `invalid-schema.json` — deliberately fails schema validation (an invalid
  `graph_authority.current` enum value, and missing required top-level
  fields) to exercise the adapter's "invalid" outcome.
- `map-rich.json` — every accepted fixture from Sensei's producer is too
  sparse to prove every Stage 4 Architecture Map path (`real-repo` alone has
  one synthetic placeholder region and zero flows). This fixture hand-
  authors 3 regions across 2 lanes, both boundary kinds, a cross-region
  parallel contract pair, a bidirectional contract, a self-contract, and a
  4-step flow with an explicit `contract_ref`, plus a mix of
  contested/unknown/open states — reachable only via
  `?fixture=_synthetic-map-rich`, never the default (see
  `static-fixture-adapter.test.ts`).

Per `docs/claude-stage-1-brief.md`: "A deliberately labeled synthetic test
fixture is acceptable for isolated component tests, but the development
application must default to an accepted repository projection fixture." The
app's default fixture is `real-repo` (see `DEFAULT_FIXTURE` in
`src/adapter/static-fixture-adapter.ts`); these two are reachable only via
an explicit `?fixture=_synthetic-available` / `?fixture=_synthetic-invalid-schema`
query parameter, never the default.
