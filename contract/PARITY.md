# Producer–consumer parity handshake

`globulario/sensei` is the canonical **producer** of the
`sensei.dashboard.projection.v1` and `sensei.dashboard.agent-handoff.v1`
contracts (adopted in
[sensei#116](https://github.com/globulario/sensei/pull/116), commit
`cbeb5719466772e136d2f212d69bbed2900c7420`). This repository is the
**consumer**: it renders whatever Sensei's producer emits, and must never
diverge from the schema Sensei actually adopted.

This directory (`contract/`) plus `docs/*.schema.json` and
`docs/fixtures/dashboard-projection/v1/` hold the consumer-side half of that
handshake. Nothing under `src/`, no Vite application, and no routing exists
yet — see `docs/claude-stage-1-brief.md` for what comes after this lands.

## What is pinned, and where

| What | Where | Source of truth |
|---|---|---|
| Projection schema | `docs/dashboard-projection-v1.schema.json` | mirrored byte-for-byte from `sensei`'s `docs/schemas/dashboard-projection/v1/dashboard-projection-v1.schema.json` |
| Handoff schema | `docs/agent-handoff-v1.schema.json` | mirrored byte-for-byte from `sensei`'s `docs/schemas/dashboard-projection/v1/agent-handoff-v1.schema.json` |
| Exact source commit + every digest | `contract/pin.json` | authored here, verified against both the local files and the live commit in `sensei` |
| Accepted fixtures | `docs/fixtures/dashboard-projection/v1/**/*.json` | mirrored byte-for-byte from the same `sensei` commit's `docs/fixtures/dashboard-projection/v1/` |
| Generated TypeScript types | `contract/generated/*.ts` | derived from the two schema files above; never hand-edited |

The two schema files were **not** modified when this repository originally
authored them (`sensei-dashboard#2`) nor when `sensei` adopted them
verbatim — their digests are identical across both repositories today. That
is expected, not incidental: Sensei's schema now carries a `$comment`
requiring exact digest parity before this repository accepts fixtures or
generates types from a new version.

## The three checks

Run all of them with:

```bash
npm run verify:pin
```

or individually via the test suite (`npm test`, see `test/pin.test.mjs` and
`test/fixtures.test.mjs`):

1. **Local digest check.** Every file `contract/pin.json` lists is
   re-hashed and compared against the digest recorded there. Catches an
   accidental hand-edit to a file that is supposed to be an exact mirror.
2. **Live cross-repo parity check.** Every pinned schema is fetched from
   `raw.githubusercontent.com/globulario/sensei/<pinned commit>/<path>` and
   byte-compared against the local mirror. This is the actual
   producer-consumer parity proof, not just "unchanged since I copied it".
   Set `SKIP_LIVE_PIN_CHECK=1` to skip it (e.g. offline development); CI
   always runs it.
3. **Fixture schema validation.** Every fixture in `contract/pin.json` is
   validated against the real, canonical JSON Schema (Draft 2020-12, via
   `ajv`) for whichever contract it belongs to.

## A quirk this handshake works around, not fixes

The projection schema's own `$id`
(`https://globulario.github.io/sensei-dashboard/schema/dashboard-projection-v1.json`)
and the literal filename the handoff schema's cross-schema `$ref`
resolves to (`.../dashboard-projection-v1.schema.json`, note the extra
`.schema`) don't textually match. This is a pre-existing property of both
vendored schema files, not something introduced by this repository or by
Sensei's adoption of them. `scripts/lib/pin.mjs` and
`scripts/lib/generate.mjs` both work around it — the former by registering
the projection schema under both URIs before compiling the handoff schema,
the latter by resolving the handoff schema's `$ref` filesystem-relative
(both files live in `docs/`, so this is transparent). Neither schema file
was edited to work around this; if a future schema version wants to close
the gap, that is a decision for the schema owner (Sensei), not a consumer
patch.

## Regenerating TypeScript types

```bash
npm run generate:types
```

Deterministic: the same two schema files always produce byte-identical
output (`test/generated-types.test.mjs` asserts this both as a two-run
comparison and as a "committed output is not stale" check). The generator
(`json-schema-to-typescript`, pinned exact version in `package.json`) only
transcribes what the schema declares — required-ness, enums, unions, and
`additionalProperties: false` (which surfaces as no open index signature on
the generated root interfaces, also asserted by that test) all carry
through unchanged. It does not add fields, rename properties, or introduce
any frontend-invented semantics.

## Updating the pin to a new Sensei commit

1. Confirm the new schema version has been accepted and merged in
   `globulario/sensei` (same review bar as the original adoption).
2. Update `contract/pin.json`: `source_commit`, every schema/fixture digest,
   and add/remove fixture entries to match what Sensei now publishes.
3. Copy the updated schema files into `docs/*.schema.json` and fixtures into
   `docs/fixtures/dashboard-projection/v1/`.
4. Run `npm run generate:types` and commit the regenerated
   `contract/generated/*.ts`.
5. Run `npm run verify:pin` and `npm test` — both must pass before opening
   a PR for the pin update itself.
