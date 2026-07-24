// Overview (architecture-dashboard-v1.md §6.1, claude-stage-3-brief.md §1).
// Orients a repository-unfamiliar reader using only validated projection
// fields: identity, the four independent assessments plus availability,
// owner-produced briefing, canonical facts, attention, and recent change —
// in that fixed reading order. Nothing here computes, ranks, or infers
// architectural meaning; every value is copied from the projection or is
// neutral interface language.

import type {
  Assessment,
  BriefingStatement,
  Change,
  Evolution,
  Fact,
  Identity,
  ProjectionAvailability,
  SenseiDashboardProjectionV1,
} from "../../contract/generated/dashboard-projection-v1.js";
import { ReferenceIndex } from "../adapter/reference-index.js";
import { ROUTE_PATHS } from "../router.js";
import { el, provenanceDisclosure, referenceList, section, statusLine } from "./dom.js";

const ACTIVE_CONTEXT_KIND_LABEL: Record<string, string> = {
  task: "Active task",
  pull_request: "Active pull request",
  change: "Active change",
  session: "Active session",
};

function identityBlock(identity: Identity): HTMLElement {
  const wrap = el("div", { className: "identity-block" });
  wrap.appendChild(el("h1", { text: identity.repository.display_name }));
  wrap.appendChild(el("p", { className: "identity-block__key", text: `Repository key: ${identity.repository.key}` }));

  const revisionText = identity.revision.display ?? identity.revision.id;
  const revisionP = el("p", { className: "identity-block__revision" });
  revisionP.appendChild(el("span", { text: `Revision: ${revisionText}` }));
  if (identity.revision.ref) {
    revisionP.appendChild(el("span", { text: ` (${identity.revision.ref})` }));
  }
  wrap.appendChild(revisionP);
  if (identity.revision.committed_at) {
    wrap.appendChild(el("p", { className: "identity-block__committed-at", text: `Committed at: ${identity.revision.committed_at}` }));
  }
  wrap.appendChild(
    el("p", {
      className: "identity-block__generated-at",
      text: `Projection generated at: ${identity.generated_at} (metadata, not an authority signal)`,
    })
  );

  const ga = identity.graph_authority;
  const gaLine = statusLine({ label: "Graph authority — observed", state: ga.observed });
  const gaCurrentP = el("p", { className: "status-line__summary" });
  gaCurrentP.appendChild(el("span", { text: "Current: " }));
  gaCurrentP.appendChild(el("span", { className: `status-token status-token--${ga.current}`, text: ga.current }));
  gaLine.appendChild(gaCurrentP);
  gaLine.appendChild(el("p", { className: "status-line__summary", text: `Identity: ${ga.identity ?? "unknown"}` }));
  gaLine.appendChild(el("p", { className: "status-line__summary", text: ga.summary }));
  wrap.appendChild(gaLine);

  return wrap;
}

function assessmentBlock(categoryLabel: string, a: Assessment, extra?: HTMLElement): HTMLElement {
  const block = statusLine({ label: categoryLabel, state: a.state, severity: a.severity, summary: a.label });
  block.appendChild(el("p", { className: "assessment-row__summary", text: a.summary }));
  if (extra) block.appendChild(extra);
  block.appendChild(provenanceDisclosure(a.provenance));
  return block;
}

function availabilityBlock(availability: ProjectionAvailability): HTMLElement {
  const block = statusLine({ label: "Projection availability", state: availability.state, summary: availability.summary });
  if (availability.limitations.length > 0) {
    const list = el("ul", { className: "assessment-row__limitations" });
    for (const limitation of availability.limitations) {
      list.appendChild(el("li", { text: limitation }));
    }
    block.appendChild(list);
  }
  return block;
}

function activeContextBlock(ctx: NonNullable<SenseiDashboardProjectionV1["active_context"]>): HTMLElement {
  const label = ACTIVE_CONTEXT_KIND_LABEL[ctx.kind] ?? ctx.kind;
  const wrap = section(label, "active-context");
  wrap.appendChild(el("p", { className: "active-context__heading", text: `${label}: ${ctx.label}` }));
  if (ctx.url) {
    wrap.appendChild(el("a", { text: "Open", attrs: { href: ctx.url, target: "_blank", rel: "noopener noreferrer nofollow" } }));
  }
  return wrap;
}

function identityAndAssessmentStrip(projection: SenseiDashboardProjectionV1): HTMLElement {
  const strip = section("Repository, authority, and assessments", "identity-strip");
  strip.appendChild(identityBlock(projection.identity));

  const coverage = projection.assessments.observation_completeness.coverage;
  const observed = coverage.observed === null ? "unknown" : String(coverage.observed);
  const total = coverage.total === null ? "unknown" : String(coverage.total);
  const coverageP = el("p", { className: "status-line__summary", text: `Coverage: ${observed} / ${total} ${coverage.unit}` });

  strip.appendChild(assessmentBlock("Architecture health", projection.assessments.architecture_health));
  strip.appendChild(assessmentBlock("Projection integrity", projection.assessments.projection_integrity));
  strip.appendChild(assessmentBlock("Observation completeness", projection.assessments.observation_completeness, coverageP));
  strip.appendChild(availabilityBlock(projection.availability));

  if (projection.active_context) {
    strip.appendChild(activeContextBlock(projection.active_context));
  }

  return strip;
}

function briefingItem(statement: BriefingStatement, index: ReferenceIndex): HTMLElement {
  const article = el("article", { className: `briefing-statement briefing-statement--${statement.kind}` });
  const heading = el("p", { className: "briefing-statement__heading" });
  heading.appendChild(el("span", { className: `status-token status-token--${statement.kind}`, text: statement.kind }));
  heading.appendChild(el("span", { text: " · severity: " }));
  heading.appendChild(el("span", { className: `severity-token severity-token--${statement.severity}`, text: statement.severity }));
  article.appendChild(heading);
  article.appendChild(el("p", { className: "briefing-statement__text", text: statement.text }));
  const refs = referenceList("References", statement.element_refs, index);
  if (refs) article.appendChild(refs);
  article.appendChild(provenanceDisclosure(statement.provenance));
  return article;
}

function briefingSection(projection: SenseiDashboardProjectionV1, index: ReferenceIndex): HTMLElement | null {
  if (projection.briefing.length === 0) return null;
  const s = section("Architectural briefing", "briefing-section");
  s.appendChild(el("h2", { text: "Briefing" }));
  for (const statement of projection.briefing) {
    s.appendChild(briefingItem(statement, index));
  }
  return s;
}

function factRow(fact: Fact, index: ReferenceIndex): [HTMLElement, HTMLElement] {
  const dt = el("dt", { className: "facts-list__label" });
  dt.appendChild(el("span", { text: `${fact.label}: ` }));
  dt.appendChild(el("span", { className: `status-token status-token--${fact.state}`, text: fact.state }));

  const dd = el("dd", { className: "facts-list__value" });
  const valueText = fact.value === null ? "unknown" : `${fact.value}${fact.unit ? ` ${fact.unit}` : ""}`;
  dd.appendChild(el("span", { text: valueText }));
  if (fact.element_refs && fact.element_refs.length > 0) {
    const refs = referenceList("References", fact.element_refs, index);
    if (refs) dd.appendChild(refs);
  }

  return [dt, dd];
}

function factsSection(projection: SenseiDashboardProjectionV1, index: ReferenceIndex): HTMLElement | null {
  const facts = projection.facts;
  if (!facts || facts.length === 0) return null;
  const s = section("Compact facts", "facts-section");
  s.appendChild(el("h2", { text: "Compact facts" }));
  const list = el("dl", { className: "facts-list" });
  for (const fact of facts) {
    const [dt, dd] = factRow(fact, index);
    list.appendChild(dt);
    list.appendChild(dd);
  }
  s.appendChild(list);
  return s;
}

function attentionItemBlock(item: SenseiDashboardProjectionV1["attention"][number], index: ReferenceIndex): HTMLElement {
  const article = el("article", { className: "attention-item" });
  const heading = el("p", { className: "attention-item__heading" });

  let titleNode: HTMLElement;
  if (item.selectable === true) {
    const resolution = index.resolve(item.id);
    titleNode =
      resolution.resolved && resolution.href
        ? el("a", { text: item.title, attrs: { href: resolution.href } })
        : el("span", { text: item.title });
  } else {
    titleNode = el("span", { text: item.title });
  }
  heading.appendChild(titleNode);
  heading.appendChild(el("span", { text: " · " }));
  heading.appendChild(el("span", { className: `status-token status-token--${item.kind}`, text: item.kind }));
  heading.appendChild(el("span", { text: " · " }));
  heading.appendChild(el("span", { className: `status-token status-token--${item.state}`, text: item.state }));
  heading.appendChild(el("span", { text: " · severity: " }));
  heading.appendChild(el("span", { className: `severity-token severity-token--${item.severity}`, text: item.severity }));
  article.appendChild(heading);
  article.appendChild(el("p", { text: item.summary }));

  const refs = referenceList("References", item.element_refs, index);
  if (refs) article.appendChild(refs);
  article.appendChild(provenanceDisclosure(item.provenance));
  return article;
}

function attentionSection(projection: SenseiDashboardProjectionV1, index: ReferenceIndex): HTMLElement {
  const s = section("Current attention", "attention-section");
  s.appendChild(el("h2", { text: "Current attention" }));
  if (projection.attention.length === 0) {
    s.appendChild(el("p", { className: "attention-empty", text: "No current attention items were supplied by this projection." }));
    return s;
  }
  for (const item of projection.attention) {
    s.appendChild(attentionItemBlock(item, index));
  }
  return s;
}

function changeRow(change: Change, index: ReferenceIndex): HTMLElement {
  const item = el("li", { className: "evolution-change" });
  const heading = el("p", { className: "evolution-change__heading" });
  heading.appendChild(el("span", { text: `${change.title} · ` }));
  heading.appendChild(el("span", { className: `status-token status-token--${change.kind}`, text: change.kind }));
  heading.appendChild(el("span", { text: " · impact: " }));
  heading.appendChild(el("span", { className: `status-token status-token--${change.impact}`, text: change.impact }));
  item.appendChild(heading);
  item.appendChild(el("p", { text: change.summary }));
  const refs = referenceList("References", change.element_refs, index);
  if (refs) item.appendChild(refs);
  return item;
}

function evolutionSection(evolution: Evolution, index: ReferenceIndex): HTMLElement {
  const s = section("Recent architectural changes", "evolution-section");
  s.appendChild(el("h2", { text: "Recent architectural changes" }));
  s.appendChild(statusLine({ label: "Evolution availability", state: evolution.availability, summary: evolution.summary ?? undefined }));

  if (evolution.limitations && evolution.limitations.length > 0) {
    const list = el("ul", { className: "evolution-limitations" });
    for (const limitation of evolution.limitations) {
      list.appendChild(el("li", { text: limitation }));
    }
    s.appendChild(list);
  }

  if (evolution.changes.length === 0) {
    const message =
      evolution.base_revision === null
        ? "This is the first authoritative projection — there is no prior revision to compare against."
        : "No changes are recorded between these revisions.";
    s.appendChild(el("p", { className: "evolution-empty", text: message }));
    return s;
  }

  const list = el("ul", { className: "evolution-changes" });
  for (const change of evolution.changes) {
    list.appendChild(changeRow(change, index));
  }
  s.appendChild(list);
  return s;
}

function mapPreviewBoundary(): HTMLElement {
  const wrap = el("div", { className: "map-preview-boundary" });
  wrap.appendChild(
    el("p", {
      className: "stage-placeholder",
      text: "The Architecture Map (deterministic layout, boundaries, contracts, flows) is a later stage — see the Map placeholder route.",
    })
  );
  wrap.appendChild(el("a", { text: "Open Map placeholder", attrs: { href: ROUTE_PATHS.map + window.location.search } }));
  return wrap;
}

export function renderOverview(container: HTMLElement, projection: SenseiDashboardProjectionV1): void {
  container.replaceChildren();
  const index = new ReferenceIndex(projection);

  container.appendChild(identityAndAssessmentStrip(projection));

  const briefing = briefingSection(projection, index);
  if (briefing) container.appendChild(briefing);

  const facts = factsSection(projection, index);
  if (facts) container.appendChild(facts);

  container.appendChild(attentionSection(projection, index));
  container.appendChild(evolutionSection(projection.evolution, index));
  container.appendChild(mapPreviewBoundary());
}
