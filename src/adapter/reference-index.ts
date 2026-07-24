// One deterministic, bounded resolver over an already-validated projection
// (claude-stage-3-brief.md §2.1): maps an explicit stable id to its
// explicit object label and kind. It performs O(1) lookups over arrays the
// projection already supplies — regions, components, boundaries, contracts,
// flows, attention items, and evolution changes — and nothing else. It
// never infers a new relationship, never guesses a label for an id it
// cannot find, and never expands beyond the ids explicitly present in the
// projection (no transitive graph walk).

import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { elementHref } from "../router.js";

export type ReferenceKind = "region" | "component" | "boundary" | "contract" | "flow" | "attention" | "change";

export interface ResolvedReference {
  resolved: true;
  id: string;
  kind: ReferenceKind;
  label: string;
  /** Deep-link href when this reference is itself Focus-selectable
   * (i.e. has, or is expected to have, a matching focus_records entry);
   * null for kinds that are never Focus targets (evolution changes) or
   * for an attention item that isn't marked selectable. */
  href: string | null;
}

export interface UnresolvedReference {
  resolved: false;
  id: string;
}

export type ReferenceResolution = ResolvedReference | UnresolvedReference;

interface IndexEntry {
  kind: ReferenceKind;
  label: string;
  focusable: boolean;
}

export class ReferenceIndex {
  #byId = new Map<string, IndexEntry>();

  constructor(projection: SenseiDashboardProjectionV1) {
    for (const r of projection.regions) {
      this.#byId.set(r.id, { kind: "region", label: r.name, focusable: true });
    }
    for (const c of projection.components) {
      this.#byId.set(c.id, { kind: "component", label: c.name, focusable: true });
    }
    for (const b of projection.boundaries) {
      this.#byId.set(b.id, { kind: "boundary", label: b.name, focusable: true });
    }
    for (const c of projection.contracts) {
      this.#byId.set(c.id, { kind: "contract", label: c.name, focusable: true });
    }
    for (const f of projection.flows) {
      this.#byId.set(f.id, { kind: "flow", label: f.name, focusable: true });
    }
    for (const a of projection.attention) {
      this.#byId.set(a.id, { kind: "attention", label: a.title, focusable: a.selectable === true });
    }
    for (const ch of projection.evolution.changes) {
      // Evolution changes are not Focus-selectable in this contract version
      // (focus_records.element_kind has no "change" option) — resolvable
      // for label purposes only.
      this.#byId.set(ch.id, { kind: "change", label: ch.title, focusable: false });
    }
  }

  resolve(id: string): ReferenceResolution {
    const entry = this.#byId.get(id);
    if (!entry) {
      return { resolved: false, id };
    }
    return {
      resolved: true,
      id,
      kind: entry.kind,
      label: entry.label,
      href: entry.focusable ? elementHref(id) : null,
    };
  }

  resolveAll(ids: readonly string[]): ReferenceResolution[] {
    return ids.map((id) => this.resolve(id));
  }
}
