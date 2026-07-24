# Sensei Dashboard

A human-scale architectural observatory for [Sensei](https://github.com/globulario/sensei).

Sensei Dashboard presents repository structure, authority, contracts, risk, evidence, and architectural evolution without exposing the raw semantic graph as the primary interface.

![Sensei Dashboard visual direction](docs/assets/architecture-dashboard-concept.svg)

## Product boundary

- **Sensei core** constructs and owns architectural truth: canonical projections, assessment semantics, revision comparison, snapshots, and live APIs.
- **Sensei Dashboard** communicates that truth through a standalone web application.
- **Agents** explain, investigate, propose, and act from grounded dashboard context.
- **Editor integrations** remain thin contextual bridges into the dashboard.

The dashboard must never infer architectural meaning from raw RDF, artifact counts, or frontend heuristics. It renders an owner-produced, versioned projection.

## Design contract

The project is currently in its design-contract phase. No frontend framework has been committed yet.

- [Dashboard V1 product and semantic contract](docs/architecture-dashboard-v1.md)
- [Dashboard Projection V1 JSON Schema](docs/dashboard-projection-v1.schema.json)
- [Agent Handoff V1 JSON Schema](docs/agent-handoff-v1.schema.json)
- [Claude Stage 1 implementation brief](docs/claude-stage-1-brief.md)
- [Tracking issue #1](https://github.com/globulario/sensei-dashboard/issues/1)

## Contract tooling

`globulario/sensei` is now the canonical producer of both schemas above
([sensei#116](https://github.com/globulario/sensei/pull/116)). This
repository pins the exact adopted commit, verifies digest parity against it
in CI, imports the accepted fixtures, and generates TypeScript types from
the pinned schemas — see [`contract/PARITY.md`](contract/PARITY.md) for the
full handshake.

```bash
npm ci
npm run verify:pin      # local digests + live cross-repo parity + schema validation
npm run generate:types  # regenerate contract/generated/*.ts
npm test
```

No application code lives here yet — `contract/` and `docs/fixtures/` are
consumer-side contract tooling only. The Stage 1 Vite shell begins only
after this lands.

## Planned product shape

The canonical interface will be a standalone TypeScript web application built with Vite. The same application will support:

- live local mode through Sensei
- immutable static snapshot mode for GitHub Pages
- deep links from lightweight editor integrations
- optional desktop packaging later, after the web application is proven

The implementation sequence is contract and fixtures, application shell, Overview and Focus, Architecture Map, then Evolution and integrations.
