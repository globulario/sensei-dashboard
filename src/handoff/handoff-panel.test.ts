import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHandoffPanel } from "./handoff-panel.js";
import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import type { HandoffSelection } from "./build-envelope.js";

function baseProjection(overrides: Partial<SenseiDashboardProjectionV1> = {}): SenseiDashboardProjectionV1 {
  const prov = { evidence_refs: [] };
  return {
    schema_version: "sensei.dashboard.projection.v1",
    identity: {
      projection_id: "p",
      repository: { key: "repo.k", display_name: "Repo" },
      revision: { id: "rev.1" },
      graph_authority: { observed: "yes", current: "yes", identity: "g1", summary: "authoritative" },
      generated_at: "2026-07-24T00:00:00Z",
    },
    availability: { state: "available", summary: "ok", limitations: [], sources: [] },
    assessments: {
      architecture_health: { state: "healthy", label: "h", summary: "s", severity: "not_applicable", provenance: prov },
      projection_integrity: { state: "healthy", label: "i", summary: "s", severity: "not_applicable", provenance: prov },
      observation_completeness: {
        state: "attention", label: "o", summary: "s", severity: "medium",
        coverage: { observed: null, total: null, unit: "u" }, provenance: prov,
      },
    },
    active_context: null,
    briefing: [],
    regions: [],
    components: [],
    boundaries: [],
    contracts: [],
    flows: [],
    attention: [],
    evolution: { availability: "available", base_revision: null, head_revision: "rev.1", changes: [] },
    focus_records: [],
    capabilities: { agent_handoff: "export" },
    ...overrides,
  };
}

function selection(): HandoffSelection {
  return {
    id: "component.a",
    kind: "component",
    focusRecord: {
      element_ref: "component.a",
      element_kind: "component",
      name: "Component A",
      responsibility: "r",
      state: "open",
      owner_refs: [],
      contract_refs: [],
      flow_refs: [],
      attention_refs: [],
      decision_refs: [],
      provenance: { evidence_refs: [] },
    },
  };
}

function mount(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

beforeEach(() => {
  Object.defineProperty(window, "URL", {
    value: Object.assign(window.URL, {
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    }),
    writable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("renderHandoffPanel", () => {
  it("renders nothing when capabilities.agent_handoff is absent", () => {
    const container = mount();
    renderHandoffPanel(container, baseProjection({ capabilities: undefined }), selection());
    expect(container.querySelector(".handoff-panel")).toBeNull();
  });

  it("renders nothing when capabilities.agent_handoff is 'none'", () => {
    const container = mount();
    renderHandoffPanel(container, baseProjection({ capabilities: { agent_handoff: "none" } }), selection());
    expect(container.querySelector(".handoff-panel")).toBeNull();
  });

  it("renders the panel with a visible not-implemented note when capability is 'live', without calling any transport", () => {
    const container = mount();
    renderHandoffPanel(container, baseProjection({ capabilities: { agent_handoff: "live" } }), selection());
    const panel = container.querySelector(".handoff-panel");
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain("not implemented in this build");
  });

  it("defaults to requested intent 'explain' producing capability read_only in the preview", () => {
    const container = mount();
    renderHandoffPanel(container, baseProjection(), selection());
    const preview = container.querySelector(".handoff-panel__preview");
    const envelope = JSON.parse(preview!.textContent ?? "{}");
    expect(envelope.requested_intent).toBe("explain");
    expect(envelope.capability).toBe("read_only");
  });

  it("produces capability propose only when the user selects requested intent propose", () => {
    const container = mount();
    renderHandoffPanel(container, baseProjection(), selection());
    const select = container.querySelector<HTMLSelectElement>(".handoff-panel__intent")!;
    select.value = "propose";
    select.dispatchEvent(new Event("change"));

    const preview = container.querySelector(".handoff-panel__preview");
    const envelope = JSON.parse(preview!.textContent ?? "{}");
    expect(envelope.requested_intent).toBe("propose");
    expect(envelope.capability).toBe("propose");
  });

  it("keeps capability read_only for review and compare intents", () => {
    const container = mount();
    renderHandoffPanel(container, baseProjection(), selection());
    const select = container.querySelector<HTMLSelectElement>(".handoff-panel__intent")!;
    for (const intent of ["review", "compare"]) {
      select.value = intent;
      select.dispatchEvent(new Event("change"));
      const preview = container.querySelector(".handoff-panel__preview");
      const envelope = JSON.parse(preview!.textContent ?? "{}");
      expect(envelope.capability).toBe("read_only");
    }
  });

  it("binds the route from the current location, including query context, and the selected id/kind exactly", () => {
    window.history.replaceState({}, "", "/element/component.a?fixture=contested");
    const container = mount();
    renderHandoffPanel(container, baseProjection(), selection());
    const preview = container.querySelector(".handoff-panel__preview");
    const envelope = JSON.parse(preview!.textContent ?? "{}");
    expect(envelope.visible_concern.route).toBe("/element/component.a?fixture=contested");
    expect(envelope.selected_element).toEqual({ id: "component.a", kind: "component" });
  });

  it("fixes the lens to the visible default 'structure' with no interactive lens picker", () => {
    const container = mount();
    renderHandoffPanel(container, baseProjection(), selection());
    expect(container.textContent).toContain("Lens: structure");
    expect(container.querySelector("select[id='handoff-lens']")).toBeNull();
    const preview = container.querySelector(".handoff-panel__preview");
    const envelope = JSON.parse(preview!.textContent ?? "{}");
    expect(envelope.lens).toBe("structure");
  });

  it("copies the exact previewed envelope JSON to the clipboard on Copy", async () => {
    const container = mount();
    renderHandoffPanel(container, baseProjection(), selection());
    const copyButton = container.querySelector<HTMLButtonElement>(".handoff-panel__copy")!;
    copyButton.click();
    await Promise.resolve();
    await Promise.resolve();

    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = JSON.parse(writeText.mock.calls[0]![0] as string);
    const preview = container.querySelector(".handoff-panel__preview");
    expect(copied).toEqual(JSON.parse(preview!.textContent ?? "{}"));
  });

  it("triggers a JSON file download on Download", () => {
    const container = mount();
    renderHandoffPanel(container, baseProjection(), selection());
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const downloadButton = container.querySelector<HTMLButtonElement>(".handoff-panel__download")!;
    downloadButton.click();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("disables export and shows a visible diagnostic when the built envelope fails schema validation", () => {
    const container = mount();
    // Violates the stableId pattern (must start with an alphanumeric and
    // contain only [A-Za-z0-9._:/#@-]) — a value TypeScript happily accepts
    // as a string but the pinned handoff schema rejects.
    const projection = baseProjection({
      identity: {
        projection_id: "p",
        repository: { key: "not a valid stable id!", display_name: "Repo" },
        revision: { id: "rev.1" },
        graph_authority: { observed: "yes", current: "yes", identity: "g1", summary: "authoritative" },
        generated_at: "2026-07-24T00:00:00Z",
      },
    });
    renderHandoffPanel(container, projection, selection());

    const copyButton = container.querySelector<HTMLButtonElement>(".handoff-panel__copy")!;
    const downloadButton = container.querySelector<HTMLButtonElement>(".handoff-panel__download")!;
    expect(copyButton.disabled).toBe(true);
    expect(downloadButton.disabled).toBe(true);
    const diagnostic = container.querySelector(".handoff-panel__diagnostic");
    expect(diagnostic!.textContent).not.toBe("");
    expect(diagnostic!.getAttribute("role")).toBe("alert");
  });
});
