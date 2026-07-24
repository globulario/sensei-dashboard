// Overview (architecture-dashboard-v1.md §6.1). Stage 1 renders identity,
// the three assessments, and the owner-produced briefing verbatim — real
// data straight from the validated projection. It does not compute,
// summarize, or rank anything itself; the map preview, risk/attention
// summary, and recent-changes list are explicitly deferred (restrained
// placeholder, per claude-stage-1-brief.md §5).

import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { renderPartialBannerIfAny } from "../state/render-states.js";

function assessmentRow(label: string, a: { state: string; severity: string; summary: string }): HTMLElement {
  const row = document.createElement("div");
  row.className = "assessment-row";
  const heading = document.createElement("p");
  heading.className = "assessment-row__heading";
  heading.textContent = `${label}: ${a.state} (severity: ${a.severity})`;
  row.appendChild(heading);
  const summary = document.createElement("p");
  summary.textContent = a.summary;
  row.appendChild(summary);
  return row;
}

export function renderOverview(container: HTMLElement, projection: SenseiDashboardProjectionV1): void {
  container.replaceChildren();

  const heading = document.createElement("h1");
  heading.textContent = "Overview";
  container.appendChild(heading);

  renderPartialBannerIfAny(container, projection);

  const assessments = document.createElement("section");
  assessments.setAttribute("aria-label", "Assessments");
  assessments.appendChild(assessmentRow("Architecture health", projection.assessments.architecture_health));
  assessments.appendChild(assessmentRow("Projection integrity", projection.assessments.projection_integrity));
  assessments.appendChild(assessmentRow("Observation completeness", projection.assessments.observation_completeness));
  container.appendChild(assessments);

  if (projection.briefing.length > 0) {
    const briefingSection = document.createElement("section");
    briefingSection.setAttribute("aria-label", "Briefing");
    for (const statement of projection.briefing) {
      const p = document.createElement("p");
      p.className = `briefing-statement briefing-statement--${statement.kind}`;
      p.textContent = statement.text;
      briefingSection.appendChild(p);
    }
    container.appendChild(briefingSection);
  }

  const counts = document.createElement("p");
  counts.className = "element-counts";
  counts.textContent =
    `${projection.regions.length} region(s), ${projection.components.length} component(s), ` +
    `${projection.boundaries.length} boundary(ies), ${projection.contracts.length} contract(s), ` +
    `${projection.flows.length} flow(s), ${projection.attention.length} attention item(s).`;
  container.appendChild(counts);

  const placeholder = document.createElement("p");
  placeholder.className = "stage-placeholder";
  placeholder.textContent =
    "Full Overview (map preview, risk and attention summary, recent changes) is not implemented in Stage 1.";
  container.appendChild(placeholder);
}
