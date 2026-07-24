// Focus (architecture-dashboard-v1.md §6.3, claude-stage-3-brief.md §2).
// Gives a precise, reference-resolved explanation for one selected
// architectural element. Referential integrity between selectable elements
// and Focus records is enforced upstream at the adapter boundary
// (src/adapter/focus-integrity.ts) — a schema-valid but producer-invalid
// projection never reaches here at all. This renderer only ever sees an
// already-validated projection and an already-resolved FocusOutcome.
//
// This renderer is synchronous and takes an already-resolved FocusOutcome —
// Shell owns the async loadFocusRecord() call and the stale-response guard
// around it (see shell.ts's #renderGeneration). A view doing its own
// awaiting here was the root cause of a real race: two overlapping
// /element/:id navigations both call this function, and whichever fetch
// resolved last used to win regardless of which navigation was more
// recent.

import type { FocusOutcome } from "../adapter/types.js";
import { ReferenceIndex } from "../adapter/reference-index.js";
import type { FocusRecord, SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { renderUnknownElement } from "../state/render-states.js";
import { bareIdList, el, externalSourceLink, provenanceDisclosure, referenceList, statusLine } from "./dom.js";
import { renderHandoffPanel } from "../handoff/handoff-panel.js";

function identityBlock(record: FocusRecord): HTMLElement {
  const wrap = el("div", { className: "focus-identity" });
  wrap.appendChild(el("h1", { text: record.name }));
  wrap.appendChild(el("p", { className: "focus-identity__id", text: `Stable id: ${record.element_ref}` }));
  wrap.appendChild(el("p", { className: "focus-identity__kind", text: `Element kind: ${record.element_kind}` }));
  wrap.appendChild(statusLine({ label: "State", state: record.state }));
  wrap.appendChild(el("p", { className: "focus-identity__responsibility", text: record.responsibility }));
  return wrap;
}

/**
 * Surfaces the projection's own partial-availability state and any
 * observation-completeness limitations on the Focus route — not just the
 * selected record's own provenance.limitations (ARCHITECT REVIEW finding #3
 * on PR #5: a partial projection whose selected record has no local
 * limitation must not lose the global availability/observation warning on
 * navigation from Overview). Only owner-supplied strings are shown; nothing
 * here is synthesized. Text already present in the record's own provenance
 * is not repeated, while preserving first-occurrence order across the
 * remaining sources. Renders nothing for a fully available projection with
 * no observation-completeness limitations, so an available projection never
 * receives a false partial warning.
 */
function projectionPartialNotice(projection: SenseiDashboardProjectionV1, record: FocusRecord): HTMLElement | null {
  const isPartial = projection.availability.state === "partial";
  const completenessLimitations = projection.assessments.observation_completeness.provenance.limitations ?? [];
  if (!isPartial && completenessLimitations.length === 0) {
    return null;
  }

  const alreadyShown = new Set(record.provenance.limitations ?? []);
  const extra: string[] = [];
  const pushUnique = (text: string) => {
    if (!alreadyShown.has(text) && !extra.includes(text)) extra.push(text);
  };
  if (isPartial) {
    for (const limitation of projection.availability.limitations) pushUnique(limitation);
  }
  for (const limitation of completenessLimitations) pushUnique(limitation);

  const wrap = el("div", { className: "focus-partial-notice" });
  if (isPartial) {
    wrap.appendChild(
      statusLine({ label: "Projection availability", state: projection.availability.state, summary: projection.availability.summary })
    );
  }
  if (extra.length > 0) {
    const list = el("ul", { className: "focus-partial-notice__limitations" });
    for (const limitation of extra) {
      list.appendChild(el("li", { text: limitation }));
    }
    wrap.appendChild(list);
  }
  return wrap;
}

function sourceLinksSection(record: FocusRecord): HTMLElement | null {
  if (!record.source_links || record.source_links.length === 0) return null;
  const wrap = el("div", { className: "focus-source-links" });
  wrap.appendChild(el("p", { className: "ref-list__label", text: `Source links (${record.source_links.length})` }));
  const list = el("ul");
  for (const link of record.source_links) {
    const item = el("li");
    item.appendChild(externalSourceLink(link.label, link.target));
    list.appendChild(item);
  }
  wrap.appendChild(list);
  return wrap;
}

function foundFocus(container: HTMLElement, record: FocusRecord, projection: SenseiDashboardProjectionV1): void {
  const index = new ReferenceIndex(projection);

  container.appendChild(identityBlock(record));

  const partialNotice = projectionPartialNotice(projection, record);
  if (partialNotice) container.appendChild(partialNotice);

  for (const [label, refs] of [
    ["Owned by", record.owner_refs],
    ["Owns", record.owned_refs ?? []],
    ["Contracts", record.contract_refs],
    ["Flows", record.flow_refs],
    ["Attention items", record.attention_refs],
    ["Recent architectural changes", record.recent_change_refs ?? []],
  ] as const) {
    const refListEl = referenceList(label, refs, index);
    if (refListEl) container.appendChild(refListEl);
  }

  const decisions = bareIdList("Decisions", record.decision_refs);
  if (decisions) container.appendChild(decisions);

  const sourceLinks = sourceLinksSection(record);
  if (sourceLinks) container.appendChild(sourceLinks);

  container.appendChild(provenanceDisclosure(record.provenance));

  renderHandoffPanel(container, projection, {
    id: record.element_ref,
    kind: record.element_kind,
    focusRecord: record,
  });
}

export function renderFocus(container: HTMLElement, outcome: FocusOutcome, projection: SenseiDashboardProjectionV1): void {
  container.replaceChildren();

  switch (outcome.status) {
    case "loading":
      // The real adapter never actually returns this status from
      // loadFocusRecord (Shell renders its own loading block before
      // awaiting) — handled for exhaustiveness, not a reachable UI state.
      return;
    case "not_found":
      container.appendChild(el("h1", { text: "Focus" }));
      renderUnknownElement(container, outcome.elementId);
      return;
    case "unavailable": {
      container.appendChild(el("h1", { text: "Focus" }));
      const note = el("p", { className: "state-block state-block--unavailable", text: outcome.reason, attrs: { role: "status" } });
      container.appendChild(note);
      return;
    }
    case "found":
      foundFocus(container, outcome.record, projection);
      return;
  }
}
