// Architecture Map (architecture-dashboard-v1.md §6.2, claude-stage-4-map-
// brief.md). Thin composition root only: partial banner, the honest empty-
// projection state (brief §8.1), or else build the pure map model once and
// hand it to the SVG renderer. All layout/routing logic lives in src/map/.

import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { renderPartialBannerIfAny } from "../state/render-states.js";
import { buildArchitectureMapModel } from "../map/model.js";
import { renderArchitectureMap } from "../map/render-svg.js";

export function renderMap(
  container: HTMLElement,
  projection: SenseiDashboardProjectionV1,
  query: URLSearchParams,
  navigate: (path: string) => void
): void {
  container.replaceChildren();

  const heading = document.createElement("h1");
  heading.textContent = "Architecture Map";
  container.appendChild(heading);

  renderPartialBannerIfAny(container, projection);

  if (projection.regions.length === 0 && projection.components.length === 0) {
    const empty = document.createElement("p");
    empty.className = "state-block state-block--empty";
    empty.setAttribute("role", "status");
    empty.textContent = "No architectural elements were supplied for this projection.";
    container.appendChild(empty);
    return;
  }

  const model = buildArchitectureMapModel(projection);
  renderArchitectureMap(container, projection, model, { query, navigate });
}
