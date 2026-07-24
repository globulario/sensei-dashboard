import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ReferenceIndex } from "./reference-index.js";
import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";

async function loadRealRepo(): Promise<SenseiDashboardProjectionV1> {
  const filePath = path.resolve(
    import.meta.dirname,
    "..",
    "..",
    "docs",
    "fixtures",
    "dashboard-projection",
    "v1",
    "real-repo",
    "projection.json"
  );
  return JSON.parse(await readFile(filePath, "utf8")) as SenseiDashboardProjectionV1;
}

describe("ReferenceIndex", () => {
  it("resolves a real component id to its label, kind, and a Focus deep link", async () => {
    const projection = await loadRealRepo();
    const index = new ReferenceIndex(projection);
    const resolution = index.resolve("component.awareness_graph_service");
    expect(resolution).toEqual({
      resolved: true,
      id: "component.awareness_graph_service",
      kind: "component",
      label: "AwarenessGraphService",
      href: "/element/component.awareness_graph_service",
    });
  });

  it("resolves a real contract id", async () => {
    const projection = await loadRealRepo();
    const index = new ReferenceIndex(projection);
    const resolution = index.resolve("contract.awareness_graph.query");
    expect(resolution.resolved).toBe(true);
    if (resolution.resolved) {
      expect(resolution.kind).toBe("contract");
      expect(resolution.href).toBe("/element/" + encodeURIComponent("contract.awareness_graph.query"));
    }
  });

  it("produces an unresolved marker (never a fabricated label) for an id not present anywhere in the projection", async () => {
    const projection = await loadRealRepo();
    const index = new ReferenceIndex(projection);
    const resolution = index.resolve("component.this-id-does-not-exist");
    expect(resolution).toEqual({ resolved: false, id: "component.this-id-does-not-exist" });
  });

  it("resolves a non-selectable attention item to a label but with href: null (not independently Focus-selectable)", () => {
    const projection: SenseiDashboardProjectionV1 = minimalProjectionWithAttention(false);
    const index = new ReferenceIndex(projection);
    const resolution = index.resolve("attention.a1");
    expect(resolution).toEqual({ resolved: true, id: "attention.a1", kind: "attention", label: "A1", href: null });
  });

  it("resolves a selectable attention item with a real href", () => {
    const projection = minimalProjectionWithAttention(true);
    const index = new ReferenceIndex(projection);
    const resolution = index.resolve("attention.a1");
    expect(resolution).toEqual({
      resolved: true,
      id: "attention.a1",
      kind: "attention",
      label: "A1",
      href: "/element/attention.a1",
    });
  });

  it("resolves an evolution change id to its title with href: null (changes are not Focus-selectable)", () => {
    const projection = minimalProjectionWithChange();
    const index = new ReferenceIndex(projection);
    const resolution = index.resolve("change.c1");
    expect(resolution).toEqual({ resolved: true, id: "change.c1", kind: "change", label: "Change One", href: null });
  });

  it("resolveAll preserves input order and resolves each id independently", async () => {
    const projection = await loadRealRepo();
    const index = new ReferenceIndex(projection);
    const results = index.resolveAll(["component.awareness_graph_service", "component.nope", "contract.awareness_graph.query"]);
    expect(results.map((r) => r.id)).toEqual([
      "component.awareness_graph_service",
      "component.nope",
      "contract.awareness_graph.query",
    ]);
    expect(results[1]).toEqual({ resolved: false, id: "component.nope" });
  });
});

function minimalProjectionWithAttention(selectable: boolean): SenseiDashboardProjectionV1 {
  const prov = { evidence_refs: [] };
  return {
    schema_version: "sensei.dashboard.projection.v1",
    identity: {
      projection_id: "p",
      repository: { key: "k", display_name: "d" },
      revision: { id: "r" },
      graph_authority: { observed: "yes", current: "yes", identity: null, summary: "s" },
      generated_at: "2026-07-24T00:00:00Z",
    },
    availability: { state: "available", summary: "s", limitations: [], sources: [] },
    assessments: {
      architecture_health: { state: "unknown", label: "h", summary: "s", severity: "not_applicable", provenance: prov },
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
    attention: [
      {
        id: "attention.a1", kind: "question", title: "A1", summary: "s", severity: "low", state: "open",
        element_refs: [], selectable, provenance: prov,
      },
    ],
    evolution: { availability: "available", base_revision: null, head_revision: "r", changes: [] },
    focus_records: selectable
      ? [
          {
            element_ref: "attention.a1", element_kind: "attention", name: "A1", responsibility: "r", state: "open",
            owner_refs: [], contract_refs: [], flow_refs: [], attention_refs: [], decision_refs: [], provenance: prov,
          },
        ]
      : [],
  };
}

function minimalProjectionWithChange(): SenseiDashboardProjectionV1 {
  const prov = { evidence_refs: [] };
  const base = minimalProjectionWithAttention(false);
  return {
    ...base,
    attention: [],
    evolution: {
      availability: "available",
      base_revision: "r0",
      head_revision: "r1",
      changes: [
        {
          id: "change.c1", kind: "other", title: "Change One", summary: "s", impact: "changed", element_refs: [], provenance: prov,
        },
      ],
    },
  };
}
