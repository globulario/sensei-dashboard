// Focus (architecture-dashboard-v1.md §6.3). Resolves the deep-linked
// stable element id against the current projection's focus_records. An id
// with no matching record is an honest "unknown deep-linked element" state
// (claude-stage-1-brief.md §6), not a fabricated fallback description.
//
// This renderer is synchronous and takes an already-resolved FocusOutcome —
// Shell owns the async loadFocusRecord() call and the stale-response guard
// around it (see shell.ts's #renderGeneration). A view doing its own
// awaiting here was the root cause of a real race: two overlapping
// /element/:id navigations both call this function, and whichever fetch
// resolved last used to win regardless of which navigation was more
// recent.

import type { FocusOutcome } from "../adapter/types.js";
import { renderUnknownElement } from "../state/render-states.js";

function refList(label: string, refs: string[]): HTMLElement | null {
  if (refs.length === 0) return null;
  const wrapper = document.createElement("div");
  wrapper.className = "focus-ref-list";
  const heading = document.createElement("p");
  heading.className = "focus-ref-list__label";
  heading.textContent = `${label} (${refs.length})`;
  wrapper.appendChild(heading);
  const list = document.createElement("ul");
  for (const ref of refs) {
    const item = document.createElement("li");
    item.textContent = ref;
    list.appendChild(item);
  }
  wrapper.appendChild(list);
  return wrapper;
}

export function renderFocus(container: HTMLElement, outcome: FocusOutcome): void {
  container.replaceChildren();
  const heading = document.createElement("h1");
  heading.textContent = "Focus";
  container.appendChild(heading);

  switch (outcome.status) {
    case "loading":
      // The real adapter never actually returns this status from
      // loadFocusRecord (Shell renders its own loading block before
      // awaiting) — handled for exhaustiveness, not a reachable UI state.
      return;
    case "not_found":
      renderUnknownElement(container, outcome.elementId);
      return;
    case "unavailable": {
      const note = document.createElement("p");
      note.className = "state-block state-block--unavailable";
      note.textContent = outcome.reason;
      container.appendChild(note);
      return;
    }
    case "found":
      break;
  }

  const record = outcome.record;

  const identity = document.createElement("p");
  identity.className = "focus-identity";
  identity.textContent = `${record.name} — ${record.element_kind} — ${record.state}`;
  container.appendChild(identity);

  const responsibility = document.createElement("p");
  responsibility.textContent = record.responsibility;
  container.appendChild(responsibility);

  for (const [label, refs] of [
    ["Owns", record.owned_refs ?? []],
    ["Owned by", record.owner_refs],
    ["Contracts", record.contract_refs],
    ["Flows", record.flow_refs],
    ["Attention", record.attention_refs],
  ] as const) {
    const el = refList(label, refs);
    if (el) container.appendChild(el);
  }

  const agentSection = document.createElement("div");
  agentSection.className = "agent-handoff-placeholder";
  const agentButton = document.createElement("button");
  agentButton.type = "button";
  agentButton.disabled = true;
  agentButton.textContent = "Ask Agent";
  agentButton.title = "Agent handoff envelope generation is Stage 3 scope — not implemented yet.";
  agentSection.appendChild(agentButton);
  const agentNote = document.createElement("p");
  agentNote.className = "stage-placeholder";
  agentNote.textContent = "Agent handoff is not implemented in Stage 1.";
  agentSection.appendChild(agentNote);
  container.appendChild(agentSection);
}
