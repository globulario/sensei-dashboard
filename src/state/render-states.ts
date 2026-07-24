// Shared honest-state rendering (claude-stage-1-brief.md §6). Every view
// calls renderNonAvailableState() first and stops if it returns true — this
// is the one place "loading", "disconnected" (missing snapshot / network),
// "invalid" (failed schema validation), and "unavailable" (a validated
// projection that itself honestly declares no architecture is claimed) are
// rendered, so every view is visually and textually consistent, and no view
// can accidentally invent its own interpretation of a failure.

import type { ProjectionOutcome } from "../adapter/types.js";
import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";

function stateBlock(kind: string, title: string, details: string[]): HTMLElement {
  const el = document.createElement("div");
  el.className = `state-block state-block--${kind}`;
  el.setAttribute("role", kind === "invalid" || kind === "disconnected" ? "alert" : "status");

  const heading = document.createElement("p");
  heading.className = "state-block__title";
  heading.textContent = title;
  el.appendChild(heading);

  if (details.length > 0) {
    const list = document.createElement("ul");
    list.className = "state-block__details";
    for (const detail of details) {
      const item = document.createElement("li");
      item.textContent = detail;
      list.appendChild(item);
    }
    el.appendChild(list);
  }

  return el;
}

/**
 * Renders the correct honest-state block for any outcome that is not a
 * successfully validated projection. Returns true when it rendered
 * something and the caller must stop; false when outcome.status ===
 * "available" and the caller should proceed to render real content.
 */
export function renderNonAvailableState(
  container: HTMLElement,
  outcome: ProjectionOutcome
): outcome is Exclude<ProjectionOutcome, { status: "available" }> {
  switch (outcome.status) {
    case "loading":
      container.replaceChildren(stateBlock("loading", "Loading projection…", []));
      return true;

    case "disconnected":
      container.replaceChildren(
        stateBlock("disconnected", "No projection could be retrieved.", [outcome.reason])
      );
      return true;

    case "invalid":
      container.replaceChildren(
        stateBlock("invalid", "The retrieved projection is invalid and cannot be shown.", [
          outcome.reason,
          ...outcome.errors,
        ])
      );
      return true;

    case "unavailable":
      container.replaceChildren(
        stateBlock("unavailable", "This revision's architecture is unavailable.", [
          outcome.projection.availability.summary,
          ...outcome.projection.availability.limitations,
        ])
      );
      return true;

    case "available":
      return false;
  }
}

/** Appends the partial-projection banner when (and only when) the
 * projection's own availability.state says "partial" — never inferred,
 * never shown for "available". */
export function renderPartialBannerIfAny(container: HTMLElement, projection: SenseiDashboardProjectionV1): void {
  if (projection.availability.state !== "partial") return;
  container.appendChild(
    stateBlock("partial", "This projection is partial.", [
      projection.availability.summary,
      ...projection.availability.limitations,
    ])
  );
}

export function renderUnknownElement(container: HTMLElement, elementId: string): void {
  container.replaceChildren(
    stateBlock("unknown-element", "This element is not in the current projection.", [
      `No focus record matches "${elementId}" in the loaded revision.`,
      "It may have existed in a different revision, or the link may be stale.",
    ])
  );
}
