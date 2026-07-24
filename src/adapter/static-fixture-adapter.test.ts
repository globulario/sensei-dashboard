import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StaticFixtureAdapter } from "./static-fixture-adapter.js";
import { installPublicDirFetchMock } from "../test-support/mock-fetch.js";

describe("StaticFixtureAdapter", () => {
  let restoreFetch: () => void;

  beforeEach(() => {
    restoreFetch = installPublicDirFetchMock();
  });

  afterEach(() => {
    restoreFetch();
  });

  it("loads the accepted real-repo fixture as an honest 'available' outcome (its own availability.state is 'partial')", async () => {
    const adapter = new StaticFixtureAdapter("real-repo");
    const outcome = await adapter.loadProjection();
    expect(outcome.status).toBe("available");
    if (outcome.status === "available") {
      expect(outcome.projection.availability.state).toBe("partial");
      expect(outcome.projection.availability.limitations.length).toBeGreaterThan(0);
    }
  });

  it("loads the accepted unavailable fixture as an adapter-level 'unavailable' outcome", async () => {
    const adapter = new StaticFixtureAdapter("unavailable");
    const outcome = await adapter.loadProjection();
    expect(outcome.status).toBe("unavailable");
    if (outcome.status === "unavailable") {
      expect(outcome.projection.regions).toEqual([]);
      expect(outcome.projection.components).toEqual([]);
    }
  });

  it("reports a missing static snapshot as 'disconnected', not a crash", async () => {
    const adapter = new StaticFixtureAdapter("does-not-exist");
    const outcome = await adapter.loadProjection();
    expect(outcome.status).toBe("disconnected");
  });

  it("reports a schema-invalid document as 'invalid' with a useful diagnostic, never silently repaired", async () => {
    const adapter = new StaticFixtureAdapter("_synthetic-invalid-schema");
    const outcome = await adapter.loadProjection();
    expect(outcome.status).toBe("invalid");
    if (outcome.status === "invalid") {
      expect(outcome.errors.length).toBeGreaterThan(0);
      expect(outcome.errors.some((e) => e.includes("evolution"))).toBe(true);
    }
  });

  it("caches the projection after the first load (does not refetch)", async () => {
    let fetchCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      fetchCount++;
      return originalFetch(...args);
    }) as typeof fetch;

    const adapter = new StaticFixtureAdapter("real-repo");
    await adapter.loadProjection();
    await adapter.loadProjection();
    expect(fetchCount).toBe(1);

    globalThis.fetch = originalFetch;
  });

  it("resolves loadFocusRecord for a real element id in the real-repo fixture", async () => {
    const adapter = new StaticFixtureAdapter("real-repo");
    const projectionOutcome = await adapter.loadProjection();
    expect(projectionOutcome.status).toBe("available");
    if (projectionOutcome.status !== "available") return;

    const firstFocusId = projectionOutcome.projection.focus_records[0]?.element_ref;
    expect(firstFocusId).toBeDefined();
    const focusOutcome = await adapter.loadFocusRecord(firstFocusId!);
    expect(focusOutcome.status).toBe("found");
  });

  it("resolves loadFocusRecord for an unknown element id as 'not_found' — the honest unknown-deep-link state", async () => {
    const adapter = new StaticFixtureAdapter("real-repo");
    const outcome = await adapter.loadFocusRecord("component.this-id-does-not-exist");
    expect(outcome.status).toBe("not_found");
  });

  it("exposes static-mode capabilities honestly (no live_refresh, no revision_compare)", () => {
    const adapter = new StaticFixtureAdapter("real-repo");
    const caps = adapter.capabilities();
    expect(caps).toEqual({ liveRefresh: false, revisionCompare: false, mode: "static" });
  });

  // --- Focus referential-integrity rejection (claude-stage-3-brief.md §2.2) ---

  it("rejects the accepted missing-focus-record fixture as an invalid outcome, not available/unavailable", async () => {
    const adapter = new StaticFixtureAdapter("invalid-missing-focus-record");
    const outcome = await adapter.loadProjection();
    expect(outcome.status).toBe("invalid");
    if (outcome.status === "invalid") {
      expect(outcome.reason).toContain("Focus referential-integrity");
      expect(outcome.errors.some((e) => e.includes("component.orphan"))).toBe(true);
    }
  });

  it("rejects the accepted duplicate-focus-record fixture as an invalid outcome", async () => {
    const adapter = new StaticFixtureAdapter("invalid-duplicate-focus-record");
    const outcome = await adapter.loadProjection();
    expect(outcome.status).toBe("invalid");
    if (outcome.status === "invalid") {
      expect(outcome.errors.some((e) => e.includes("component.dup"))).toBe(true);
    }
  });

  it("never reaches the semantic Focus-integrity check for a document that is already schema-invalid — schema errors are reported, not integrity errors", async () => {
    const adapter = new StaticFixtureAdapter("_synthetic-invalid-schema");
    const outcome = await adapter.loadProjection();
    expect(outcome.status).toBe("invalid");
    if (outcome.status === "invalid") {
      expect(outcome.reason).toContain("schema validation");
    }
  });
});
