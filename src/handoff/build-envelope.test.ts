import { describe, it, expect } from "vitest";
import { buildHandoffEnvelope, type HandoffSelection, type HandoffUserChoices } from "./build-envelope.js";
import { validateHandoffEnvelope } from "../adapter/schema-validate.js";
import type { FocusRecord, SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";

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
    availability: { state: "available", summary: "s", limitations: [], sources: [] },
    assessments: {
      architecture_health: { state: "unknown", label: "h", summary: "s", severity: "not_applicable", provenance: prov },
      projection_integrity: { state: "healthy", label: "i", summary: "s", severity: "not_applicable", provenance: prov },
      observation_completeness: {
        state: "attention",
        label: "o",
        summary: "s",
        severity: "medium",
        coverage: { observed: null, total: null, unit: "u" },
        provenance: prov,
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
    ...overrides,
  };
}

function focusRecord(overrides: Partial<FocusRecord> = {}): FocusRecord {
  return {
    element_ref: "component.x",
    element_kind: "component",
    name: "X",
    responsibility: "r",
    state: "open",
    owner_refs: [],
    contract_refs: [],
    flow_refs: [],
    attention_refs: [],
    decision_refs: [],
    provenance: { evidence_refs: [] },
    ...overrides,
  };
}

function choices(overrides: Partial<HandoffUserChoices> = {}): HandoffUserChoices {
  return { requestedIntent: "explain", lens: "structure", visibleConcernSummary: null, ...overrides };
}

describe("buildHandoffEnvelope", () => {
  it("populates identity fields verbatim from the projection", () => {
    const projection = baseProjection();
    const envelope = buildHandoffEnvelope(projection, "/overview", null, choices());
    expect(envelope.schema_version).toBe("sensei.dashboard.agent-handoff.v1");
    expect(envelope.repository).toEqual(projection.identity.repository);
    expect(envelope.revision).toEqual(projection.identity.revision);
    expect(envelope.graph_authority).toEqual(projection.identity.graph_authority);
  });

  it("binds selected_element, route, and lens exactly as given", () => {
    const projection = baseProjection();
    const selection: HandoffSelection = { id: "component.x", kind: "component", focusRecord: focusRecord() };
    const envelope = buildHandoffEnvelope(projection, "/element/component.x?tab=overview", selection, choices({ lens: "risk" }));
    expect(envelope.selected_element).toEqual({ id: "component.x", kind: "component" });
    expect(envelope.visible_concern.route).toBe("/element/component.x?tab=overview");
    expect(envelope.lens).toBe("risk");
  });

  it("sets selected_element to null when there is no current selection", () => {
    const envelope = buildHandoffEnvelope(baseProjection(), "/overview", null, choices());
    expect(envelope.selected_element).toBeNull();
  });

  it("copies visible_concern.summary only from explicit user input, never generating prose", () => {
    const withoutSummary = buildHandoffEnvelope(baseProjection(), "/overview", null, choices({ visibleConcernSummary: null }));
    expect(withoutSummary.visible_concern.summary).toBeNull();

    const withSummary = buildHandoffEnvelope(
      baseProjection(),
      "/overview",
      null,
      choices({ visibleConcernSummary: "user-authored text" })
    );
    expect(withSummary.visible_concern.summary).toBe("user-authored text");
  });

  it("sets capability to propose only for requestedIntent 'propose', read_only for every other intent", () => {
    for (const intent of ["explain", "review", "compare"] as const) {
      const envelope = buildHandoffEnvelope(baseProjection(), "/overview", null, choices({ requestedIntent: intent }));
      expect(envelope.requested_intent).toBe(intent);
      expect(envelope.capability).toBe("read_only");
    }
    const proposeEnvelope = buildHandoffEnvelope(baseProjection(), "/overview", null, choices({ requestedIntent: "propose" }));
    expect(proposeEnvelope.capability).toBe("propose");
  });

  it("copies active_context exactly when present, and null when absent", () => {
    const activeContext = { kind: "task" as const, id: "task.1", label: "Investigate boundary pressure" };
    const withContext = buildHandoffEnvelope(baseProjection({ active_context: activeContext }), "/overview", null, choices());
    expect(withContext.active_context).toEqual(activeContext);

    const withoutContext = buildHandoffEnvelope(baseProjection({ active_context: null }), "/overview", null, choices());
    expect(withoutContext.active_context).toBeNull();
  });

  it("returns an empty referenced_ids object when there is no selection", () => {
    const envelope = buildHandoffEnvelope(baseProjection(), "/overview", null, choices());
    expect(envelope.referenced_ids).toEqual({});
  });

  it("populates referenced_ids from the selected Focus record's explicit ref fields, not transitively expanded", () => {
    const record = focusRecord({
      element_ref: "component.x",
      attention_refs: ["attention.a1"],
      contract_refs: ["contract.c1"],
      flow_refs: ["flow.f1"],
      decision_refs: ["decision.d1"],
      provenance: { evidence_refs: ["evidence.e1"] },
    });
    const selection: HandoffSelection = { id: "component.x", kind: "component", focusRecord: record };
    const envelope = buildHandoffEnvelope(baseProjection(), "/element/component.x", selection, choices());
    expect(envelope.referenced_ids).toEqual({
      attention_refs: ["attention.a1"],
      contract_refs: ["contract.c1"],
      flow_refs: ["flow.f1"],
      decision_refs: ["decision.d1"],
      evidence_refs: ["evidence.e1"],
    });
  });

  it("adds a selected boundary's own id to boundary_refs (FocusRecord has no boundary_refs field of its own)", () => {
    const selection: HandoffSelection = {
      id: "boundary.b1",
      kind: "boundary",
      focusRecord: focusRecord({ element_ref: "boundary.b1", element_kind: "boundary" }),
    };
    const envelope = buildHandoffEnvelope(baseProjection(), "/element/boundary.b1", selection, choices());
    expect(envelope.referenced_ids.boundary_refs).toEqual(["boundary.b1"]);
  });

  it("adds a selected contract's own id to contract_refs and its explicit boundary_refs to boundary_refs", () => {
    const projection = baseProjection({
      contracts: [
        {
          id: "contract.c1",
          name: "C1",
          source_ref: "component.a",
          target_ref: "component.b",
          kind: "grpc",
          direction: "bidirectional",
          state: "open",
          summary: "s",
          boundary_refs: ["boundary.b1", "boundary.b2"],
          provenance: { evidence_refs: [] },
        },
      ],
    });
    const selection: HandoffSelection = {
      id: "contract.c1",
      kind: "contract",
      focusRecord: focusRecord({ element_ref: "contract.c1", element_kind: "contract" }),
    };
    const envelope = buildHandoffEnvelope(projection, "/element/contract.c1", selection, choices());
    expect(envelope.referenced_ids.contract_refs).toEqual(["contract.c1"]);
    expect(envelope.referenced_ids.boundary_refs).toEqual(["boundary.b1", "boundary.b2"]);
  });

  it("adds a selected flow's own id to flow_refs", () => {
    const selection: HandoffSelection = {
      id: "flow.f1",
      kind: "flow",
      focusRecord: focusRecord({ element_ref: "flow.f1", element_kind: "flow" }),
    };
    const envelope = buildHandoffEnvelope(baseProjection(), "/element/flow.f1", selection, choices());
    expect(envelope.referenced_ids.flow_refs).toEqual(["flow.f1"]);
  });

  it("adds a selected attention item's own id to attention_refs", () => {
    const selection: HandoffSelection = {
      id: "attention.a1",
      kind: "attention",
      focusRecord: focusRecord({ element_ref: "attention.a1", element_kind: "attention" }),
    };
    const envelope = buildHandoffEnvelope(baseProjection(), "/element/attention.a1", selection, choices());
    expect(envelope.referenced_ids.attention_refs).toEqual(["attention.a1"]);
  });

  it("deduplicates referenced ids while preserving first-occurrence order when the self-id already appears via the Focus record", () => {
    const record = focusRecord({
      element_ref: "flow.f1",
      element_kind: "flow",
      flow_refs: ["flow.other", "flow.f1"],
    });
    const selection: HandoffSelection = { id: "flow.f1", kind: "flow", focusRecord: record };
    const envelope = buildHandoffEnvelope(baseProjection(), "/element/flow.f1", selection, choices());
    expect(envelope.referenced_ids.flow_refs).toEqual(["flow.other", "flow.f1"]);
  });

  it("collects observation_limitations deterministically from availability, observation_completeness provenance, and per-source limitations, deduplicated in first-occurrence order", () => {
    const projection = baseProjection({
      availability: {
        state: "partial",
        summary: "s",
        limitations: ["regions are not authored", "shared limitation"],
        sources: [
          { owner: "src.a", availability: "partial", summary: "s", limitations: ["shared limitation", "source-a only"] },
          { owner: "src.b", availability: "available", summary: "s" },
        ],
      },
    });
    projection.assessments.observation_completeness.provenance.limitations = ["completeness-specific limitation"];
    const envelope = buildHandoffEnvelope(projection, "/overview", null, choices());
    expect(envelope.observation_limitations).toEqual([
      "regions are not authored",
      "shared limitation",
      "completeness-specific limitation",
      "source-a only",
    ]);
  });

  it("produces an envelope that validates against the pinned agent-handoff-v1 schema", () => {
    const projection = baseProjection({
      availability: { state: "partial", summary: "s", limitations: ["some limitation"], sources: [] },
      active_context: { kind: "session", id: "session.1", label: "Reviewing boundary pressure" },
    });
    const record = focusRecord({
      element_ref: "component.x",
      attention_refs: ["attention.a1"],
      provenance: { evidence_refs: ["evidence.e1"] },
    });
    const selection: HandoffSelection = { id: "component.x", kind: "component", focusRecord: record };
    const envelope = buildHandoffEnvelope(
      projection,
      "/element/component.x",
      selection,
      choices({ requestedIntent: "propose", lens: "authority", visibleConcernSummary: "checking ownership" })
    );
    const result = validateHandoffEnvelope(envelope);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("produces a schema-valid envelope even in the minimal no-selection, no-context, no-limitations case", () => {
    const envelope = buildHandoffEnvelope(baseProjection(), "/overview", null, choices());
    const result = validateHandoffEnvelope(envelope);
    expect(result.valid).toBe(true);
  });
});
