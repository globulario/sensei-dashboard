// Architecture Map (architecture-dashboard-v1.md §6.2). Explicitly out of
// scope for Stage 1: "no map layout engine yet" — no positions, no SVG/
// canvas, no graph library. This view proves the route and data reach a
// real projection and nothing more; it deliberately shows only region
// names as a flat list, not a structural tree, so it cannot be mistaken
// for an attempt at the deterministic map.

import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { renderPartialBannerIfAny } from "../state/render-states.js";

export function renderMap(container: HTMLElement, projection: SenseiDashboardProjectionV1): void {
  container.replaceChildren();

  const heading = document.createElement("h1");
  heading.textContent = "Architecture Map";
  container.appendChild(heading);

  renderPartialBannerIfAny(container, projection);

  const placeholder = document.createElement("p");
  placeholder.className = "stage-placeholder";
  placeholder.textContent =
    "The architecture map (deterministic layout, boundaries, contracts, flows) is not implemented in Stage 1.";
  container.appendChild(placeholder);

  const regionNames = projection.regions.map((r) => r.name);
  const note = document.createElement("p");
  note.className = "map-region-names";
  note.textContent =
    regionNames.length > 0
      ? `Regions in this projection: ${regionNames.join(", ")}.`
      : "No regions in this projection.";
  container.appendChild(note);
}
