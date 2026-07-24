// Small shared DOM-construction helpers used by Overview and Focus
// (claude-stage-3-brief.md §4: "A small projection-index/view-model module
// is acceptable" — this is the rendering-side equivalent, kept to plain
// element construction with no UI-framework dependency). Every element
// carries a visible machine-token/label pair, never color alone
// (brief §5: "status meaning available without color").

import type { Provenance } from "../../contract/generated/dashboard-projection-v1.js";
import type { ReferenceIndex } from "../adapter/reference-index.js";

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts?: { className?: string; text?: string; attrs?: Record<string, string> }
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts?.className) node.className = opts.className;
  if (opts?.text !== undefined) node.textContent = opts.text;
  if (opts?.attrs) {
    for (const [key, value] of Object.entries(opts.attrs)) node.setAttribute(key, value);
  }
  return node;
}

export function section(ariaLabel: string, className?: string): HTMLElement {
  const s = el("section", { className });
  s.setAttribute("aria-label", ariaLabel);
  return s;
}

/** A machine token plus human label plus optional severity, rendered as
 * text (not color alone) so the meaning survives a monochrome capture or a
 * screen reader. `unknown` and `not_applicable` render with their own
 * distinct text — the caller passing them through verbatim is what keeps
 * them distinct, this only avoids collapsing them into a shared style. */
export function statusLine(opts: { label: string; state: string; severity?: string; summary?: string }): HTMLElement {
  const wrap = el("div", { className: "status-line" });
  const heading = el("p", { className: "status-line__heading" });
  heading.appendChild(el("span", { className: "status-line__label", text: `${opts.label}: ` }));
  heading.appendChild(
    el("span", { className: `status-token status-token--${opts.state}`, text: opts.state, attrs: { "data-state": opts.state } })
  );
  if (opts.severity !== undefined) {
    heading.appendChild(el("span", { text: " · severity: " }));
    heading.appendChild(
      el("span", {
        className: `severity-token severity-token--${opts.severity}`,
        text: opts.severity,
        attrs: { "data-severity": opts.severity },
      })
    );
  }
  wrap.appendChild(heading);
  if (opts.summary) {
    wrap.appendChild(el("p", { className: "status-line__summary", text: opts.summary }));
  }
  return wrap;
}

/** Renders `null` as an explicit "unknown" token, never as 0 or a blank
 * (brief §1.1: "null coverage values render as unknown, not zero"). */
export function numberOrUnknown(value: number | null): string {
  return value === null ? "unknown" : String(value);
}

/**
 * Renders a list of explicit stable-id references, resolved against the
 * given index where possible. A resolved, focus-selectable id becomes a
 * link; a resolved-but-not-selectable id becomes plain labeled text; an id
 * the index cannot find becomes a visible "unresolved reference" diagnostic
 * — never a fabricated label (claude-stage-3-brief.md §2.1).
 */
export function referenceList(label: string, ids: readonly string[], index: ReferenceIndex): HTMLElement | null {
  if (ids.length === 0) return null;
  const wrap = el("div", { className: "ref-list" });
  wrap.appendChild(el("p", { className: "ref-list__label", text: `${label} (${ids.length})` }));
  const list = el("ul", { className: "ref-list__items" });
  for (const resolution of index.resolveAll(ids)) {
    const item = el("li", { className: "ref-list__item" });
    if (!resolution.resolved) {
      item.classList.add("ref-list__item--unresolved");
      item.setAttribute("role", "note");
      item.appendChild(el("span", { text: `Unresolved reference: "${resolution.id}" (not present in this projection)` }));
      list.appendChild(item);
      continue;
    }
    if (resolution.href) {
      const a = el("a", { text: resolution.label, attrs: { href: resolution.href } });
      item.appendChild(a);
    } else {
      item.appendChild(el("span", { text: resolution.label }));
    }
    item.appendChild(el("span", { className: "ref-list__id", text: ` (${resolution.id})` }));
    list.appendChild(item);
  }
  wrap.appendChild(list);
  return wrap;
}

/** A plain stable-id list for reference categories with no resolvable
 * collection in this contract version (e.g. decision_refs, evidence_refs) —
 * shown as bare ids, never given an invented label. */
export function bareIdList(label: string, ids: readonly string[]): HTMLElement | null {
  if (ids.length === 0) return null;
  const wrap = el("div", { className: "ref-list" });
  wrap.appendChild(el("p", { className: "ref-list__label", text: `${label} (${ids.length})` }));
  const list = el("ul", { className: "ref-list__items" });
  for (const id of ids) {
    list.appendChild(el("li", { className: "ref-list__item", text: id }));
  }
  wrap.appendChild(list);
  return wrap;
}

/** Progressive disclosure for a provenance object: evidence/decision/source
 * refs (bare ids — provenance refs are not resolvable projection objects),
 * observed-at, and limitations. Collapsed by default (`<details>`), never
 * required to read the primary statement above it. */
export function provenanceDisclosure(provenance: Provenance): HTMLElement {
  const details = el("details", { className: "provenance-disclosure" });
  details.appendChild(el("summary", { text: "Provenance and evidence" }));
  const body = el("div", { className: "provenance-disclosure__body" });

  if (provenance.observed_at) {
    body.appendChild(el("p", { className: "provenance-disclosure__observed-at", text: `Observed at: ${provenance.observed_at}` }));
  }
  const evidence = bareIdList("Evidence references", provenance.evidence_refs);
  if (evidence) body.appendChild(evidence);
  const decisions = bareIdList("Decision references", provenance.decision_refs ?? []);
  if (decisions) body.appendChild(decisions);
  const sources = bareIdList("Source references", provenance.source_refs ?? []);
  if (sources) body.appendChild(sources);
  if (provenance.limitations && provenance.limitations.length > 0) {
    const limitations = el("div", { className: "provenance-disclosure__limitations" });
    limitations.appendChild(el("p", { className: "ref-list__label", text: "Limitations" }));
    const list = el("ul");
    for (const limitation of provenance.limitations) {
      list.appendChild(el("li", { text: limitation }));
    }
    limitations.appendChild(list);
    body.appendChild(limitations);
  }
  if (body.childElementCount === 0) {
    body.appendChild(el("p", { className: "provenance-disclosure__empty", text: "No evidence, decision, or source references were supplied." }));
  }

  details.appendChild(body);
  return details;
}

// Projection-supplied clickable targets (Focus source links, active-context
// URLs) are owner text, not something this dashboard authors — but
// `noopener`/`noreferrer` alone only protect the opener relationship, not
// the scheme. A "safe" target must resolve to an accepted, non-active
// scheme (ARCHITECT REVIEW finding #2 on PR #5: `javascript:`/`data:` and
// similar active schemes must never become clickable, and malformed targets
// must not silently become something else).
const SAFE_LINK_SCHEMES = new Set(["http:", "https:"]);

function isSafeLinkTarget(target: string): boolean {
  try {
    // Resolving against the current origin lets a genuinely relative target
    // ("/docs/x", "docs/x") through — it inherits the page's own http(s)
    // scheme — while an absolute target carrying its own scheme (including
    // "javascript:", "data:", or a malformed string) is judged on that
    // scheme, not silently reinterpreted as relative.
    const resolved = new URL(target, window.location.href);
    return SAFE_LINK_SCHEMES.has(resolved.protocol);
  } catch {
    return false;
  }
}

/** External source link exactly as supplied — never rewritten — with safe
 * link attributes (brief §2.1: "apply safe link attributes and do not
 * rewrite targets"). A target whose resolved scheme is not http(s) (e.g.
 * `javascript:`, `data:`) or that fails to parse is never rendered as a
 * clickable anchor — instead it renders as plain text with a visible
 * diagnostic, never silently dropped and never rewritten into another URL. */
export function externalSourceLink(label: string, target: string): HTMLElement {
  if (!isSafeLinkTarget(target)) {
    const wrap = el("span", { className: "unsafe-link" });
    wrap.appendChild(el("span", { text: label }));
    wrap.appendChild(
      el("span", {
        className: "unsafe-link__diagnostic",
        text: ` (link not rendered: "${target}" is not an accepted http(s) or relative target)`,
        attrs: { role: "note" },
      })
    );
    return wrap;
  }
  return el("a", { text: label, attrs: { href: target, target: "_blank", rel: "noopener noreferrer nofollow" } });
}
