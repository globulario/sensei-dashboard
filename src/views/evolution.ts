// Evolution (architecture-dashboard-v1.md §6.4). Renders the projection's
// own evolution block verbatim — base/head revision and the changes list —
// without computing or inferring anything about what changed.

import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { renderPartialBannerIfAny } from "../state/render-states.js";

export function renderEvolution(container: HTMLElement, projection: SenseiDashboardProjectionV1): void {
  container.replaceChildren();

  const heading = document.createElement("h1");
  heading.textContent = "Evolution";
  container.appendChild(heading);

  renderPartialBannerIfAny(container, projection);

  const evolution = projection.evolution;
  const summary = document.createElement("p");
  summary.textContent =
    evolution.summary ?? `Comparing ${evolution.base_revision ?? "(no prior revision)"} → ${evolution.head_revision}.`;
  container.appendChild(summary);

  if (evolution.changes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "evolution-empty";
    empty.textContent = evolution.base_revision
      ? "No changes are recorded between these revisions."
      : "This is the first observed revision — there is no prior authoritative projection to compare against.";
    container.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "evolution-changes";
    for (const change of evolution.changes) {
      const item = document.createElement("li");
      item.textContent = `[${change.impact}] ${change.title} — ${change.summary}`;
      list.appendChild(item);
    }
    container.appendChild(list);
  }

  const placeholder = document.createElement("p");
  placeholder.className = "stage-placeholder";
  placeholder.textContent = "Revision comparison (selecting a different base revision) is not implemented in Stage 1.";
  container.appendChild(placeholder);
}
