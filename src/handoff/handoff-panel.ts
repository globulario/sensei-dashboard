// Agent-handoff UI: explicit controls, live preview, and local export
// (claude-stage-3-brief.md §3.4). Generation and export only — no live
// agent transport is called from here, ever. Rendering is synchronous and
// interactive-only (event listeners), consistent with the Stage 1 boundary
// that views never perform network access.

import type { SenseiDashboardAgentHandoffV1 } from "../../contract/generated/agent-handoff-v1.js";
import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import { validateHandoffEnvelope } from "../adapter/schema-validate.js";
import { el, section } from "../views/dom.js";
import { buildHandoffEnvelope, DEFAULT_HANDOFF_LENS, type HandoffIntent, type HandoffLens, type HandoffSelection } from "./build-envelope.js";

const INTENT_OPTIONS: Array<{ value: HandoffIntent; label: string }> = [
  { value: "explain", label: "Explain" },
  { value: "review", label: "Review" },
  { value: "compare", label: "Compare" },
  { value: "propose", label: "Propose (prepare a governed-change proposal — not mutation authority)" },
];

// The six canonical contract lens identifiers (architecture-dashboard-v1.md
// §7) — the serialized value is the token itself, never relabeled.
const LENS_OPTIONS: Array<{ value: HandoffLens; label: string }> = [
  { value: "structure", label: "Structure" },
  { value: "authority", label: "Authority" },
  { value: "behavior", label: "Behavior" },
  { value: "risk", label: "Risk" },
  { value: "change", label: "Change" },
  { value: "closure", label: "Closure" },
];

/**
 * Renders the "Ask Agent" panel for the given selection, or renders nothing
 * when `projection.capabilities?.agent_handoff` is `"none"` or absent
 * (brief §3.1). Appends directly to `container` — callers decide placement.
 */
export function renderHandoffPanel(container: HTMLElement, projection: SenseiDashboardProjectionV1, selection: HandoffSelection): void {
  const capability = projection.capabilities?.agent_handoff;
  if (!capability || capability === "none") {
    return;
  }

  const panel = section("Ask Agent", "handoff-panel");
  panel.appendChild(el("h2", { text: "Ask Agent" }));

  if (capability === "live") {
    panel.appendChild(
      el("p", {
        className: "handoff-panel__note",
        text: "Live delivery to a connected agent is not implemented in this build. The envelope below can still be generated and exported locally.",
      })
    );
  }

  const controls = el("div", { className: "handoff-panel__controls" });

  const intentLabel = el("label", { className: "handoff-panel__field-label", text: "Requested intent", attrs: { for: "handoff-intent" } });
  const intentSelect = el("select", { className: "handoff-panel__intent", attrs: { id: "handoff-intent" } });
  for (const opt of INTENT_OPTIONS) {
    const optionEl = el("option", { text: opt.label, attrs: { value: opt.value } });
    intentSelect.appendChild(optionEl);
  }
  controls.appendChild(intentLabel);
  controls.appendChild(intentSelect);

  const lensLabel = el("label", { className: "handoff-panel__field-label", text: "Lens", attrs: { for: "handoff-lens" } });
  const lensSelect = el("select", { className: "handoff-panel__lens", attrs: { id: "handoff-lens" } });
  for (const opt of LENS_OPTIONS) {
    const optionEl = el("option", { text: opt.label, attrs: { value: opt.value } });
    if (opt.value === DEFAULT_HANDOFF_LENS) optionEl.selected = true;
    lensSelect.appendChild(optionEl);
  }
  controls.appendChild(lensLabel);
  controls.appendChild(lensSelect);

  const summaryLabel = el("label", {
    className: "handoff-panel__field-label",
    text: "Visible-concern note (optional, your own words — never generated)",
    attrs: { for: "handoff-summary" },
  });
  const summaryInput = el("textarea", { className: "handoff-panel__summary", attrs: { id: "handoff-summary", rows: "2" } });
  controls.appendChild(summaryLabel);
  controls.appendChild(summaryInput);

  panel.appendChild(controls);

  const capabilityNote = el("p", { className: "handoff-panel__capability-note" });
  panel.appendChild(capabilityNote);

  const diagnostic = el("p", { className: "handoff-panel__diagnostic", attrs: { role: "alert" } });
  const copyStatus = el("p", { className: "handoff-panel__copy-status", attrs: { role: "status" } });

  const actions = el("div", { className: "handoff-panel__actions" });
  const copyButton = el("button", { className: "handoff-panel__copy", text: "Copy envelope JSON", attrs: { type: "button" } });
  const downloadButton = el("button", { className: "handoff-panel__download", text: "Download envelope JSON", attrs: { type: "button" } });
  actions.appendChild(copyButton);
  actions.appendChild(downloadButton);
  panel.appendChild(actions);
  panel.appendChild(copyStatus);
  panel.appendChild(diagnostic);

  const previewDetails = el("details", { className: "handoff-panel__preview-details" });
  previewDetails.appendChild(el("summary", { text: "Preview exported envelope" }));
  const preview = el("pre", { className: "handoff-panel__preview", attrs: { "aria-label": "Handoff envelope JSON preview" } });
  previewDetails.appendChild(preview);
  panel.appendChild(previewDetails);

  let currentEnvelope: SenseiDashboardAgentHandoffV1 | null = null;

  function update(): void {
    const route = window.location.pathname + window.location.search;
    const summaryText = summaryInput.value.trim();
    const envelope = buildHandoffEnvelope(projection, route, selection, {
      requestedIntent: intentSelect.value as HandoffIntent,
      // Cast, not validated here: an out-of-contract value (only reachable
      // by manipulating the DOM directly, since the <select> only ever
      // offers the six canonical options) is caught by
      // validateHandoffEnvelope() below via the schema's lens enum, and
      // export is disabled the same way any other invalid envelope is.
      lens: lensSelect.value as HandoffLens,
      visibleConcernSummary: summaryText.length > 0 ? summaryText : null,
    });
    preview.textContent = JSON.stringify(envelope, null, 2);
    capabilityNote.textContent = `This envelope's capability will be "${envelope.capability}".`;

    const result = validateHandoffEnvelope(envelope);
    if (result.valid) {
      currentEnvelope = envelope;
      diagnostic.textContent = "";
      copyButton.disabled = false;
      downloadButton.disabled = false;
    } else {
      currentEnvelope = null;
      diagnostic.textContent = `This envelope failed schema validation and cannot be exported: ${result.errors.join("; ")}`;
      copyButton.disabled = true;
      downloadButton.disabled = true;
    }
  }

  intentSelect.addEventListener("change", update);
  lensSelect.addEventListener("change", update);
  summaryInput.addEventListener("input", update);

  copyButton.addEventListener("click", () => {
    if (!currentEnvelope) return;
    const json = JSON.stringify(currentEnvelope, null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => {
        copyStatus.textContent = "Copied envelope JSON to clipboard.";
      })
      .catch((err: unknown) => {
        copyStatus.textContent = `Could not copy to clipboard: ${(err as Error).message}`;
      });
  });

  downloadButton.addEventListener("click", () => {
    if (!currentEnvelope) return;
    const json = JSON.stringify(currentEnvelope, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = el("a", { attrs: { href: url, download: `agent-handoff-${selection.id}.json` } });
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  update();
  container.appendChild(panel);
}
