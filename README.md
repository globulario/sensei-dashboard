# Sensei Dashboard

A human-scale architectural observatory for [Sensei](https://github.com/globulario/sensei).

Sensei Dashboard will present repository structure, authority, contracts, risk, evidence, and architectural evolution without exposing the raw semantic graph as the primary interface.

## Repository boundary

- **Sensei core** constructs and owns architectural truth: canonical projections, assessment semantics, revision comparison, snapshots, and live APIs.
- **Sensei Dashboard** communicates that truth through a standalone web application.
- **Agents** explain, investigate, propose, and act from grounded dashboard context.
- **Editor integrations** remain thin contextual bridges into the dashboard.

The project is currently in its design-contract phase. No frontend framework has been committed yet.
