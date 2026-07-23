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
- [Claude Stage 1 implementation brief](docs/claude-stage-1-brief.md)
- [Tracking issue #1](https://github.com/globulario/sensei-dashboard/issues/1)

## Planned product shape

The canonical interface will be a standalone TypeScript web application built with Vite. The same application will support:

- live local mode through Sensei
- immutable static snapshot mode for GitHub Pages
- deep links from lightweight editor integrations
- optional desktop packaging later, after the web application is proven

The implementation sequence is contract and fixtures, application shell, Overview and Focus, Architecture Map, then Evolution and integrations.
