// Static fixture adapter (claude-stage-1-brief.md §3): loads immutable
// projection JSON, the same way a GitHub Pages static snapshot deployment
// would — real fetch() calls against real static files, not a bundler-time
// import. Views never know this isn't a live server; a future live adapter
// implements the exact same ProjectionAdapter interface.

import type { AdapterCapabilities, FocusOutcome, ProjectionAdapter, ProjectionOutcome } from "./types.js";
import { validateProjection } from "./schema-validate.js";
import { validateFocusIntegrity } from "./focus-integrity.js";
import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";

/**
 * Named fixture sets this adapter can be pointed at, controlled by the
 * `?fixture=<name>` query parameter (default: "real-repo", the accepted
 * fixture built from the actual Sensei repository — see contract/pin.json).
 * Every entry here is either one of the ten fixtures Sensei's producer
 * actually accepted, or a fixture explicitly named `_synthetic-*` and
 * documented as test-only (see public/fixtures/_synthetic/README.md).
 */
const FIXTURE_URLS: Record<string, string> = {
  "real-repo": "/fixtures/dashboard-projection/v1/real-repo/projection.json",
  partial: "/fixtures/dashboard-projection/v1/partial/projection.json",
  unavailable: "/fixtures/dashboard-projection/v1/unavailable/projection.json",
  contested: "/fixtures/dashboard-projection/v1/contested/projection.json",
  "evolution-first-revision": "/fixtures/dashboard-projection/v1/evolution-first-revision/projection.json",
  "public-redacted": "/fixtures/dashboard-projection/v1/public-redacted/projection.json",
  "_synthetic-available": "/fixtures/_synthetic/available.json",
  "_synthetic-invalid-schema": "/fixtures/_synthetic/invalid-schema.json",
  // Accepted schema-valid/producer-invalid fixtures (claude-stage-3-brief.md
  // §2.2): real fixtures Sensei's own contract pin accepts, reachable here
  // so the Focus-integrity rejection path is exercisable end to end, not
  // just schema-valid ones.
  "invalid-missing-focus-record": "/fixtures/dashboard-projection/v1/invalid/missing-focus-record.json",
  "invalid-duplicate-focus-record": "/fixtures/dashboard-projection/v1/invalid/duplicate-focus-record.json",
};

export const DEFAULT_FIXTURE = "real-repo";

export class StaticFixtureAdapter implements ProjectionAdapter {
  #fixtureName: string;
  #cached: ProjectionOutcome | undefined;

  constructor(fixtureName: string = DEFAULT_FIXTURE) {
    this.#fixtureName = fixtureName;
  }

  capabilities(): AdapterCapabilities {
    return { liveRefresh: false, revisionCompare: false, mode: "static" };
  }

  async loadProjection(): Promise<ProjectionOutcome> {
    if (this.#cached) {
      return this.#cached;
    }
    const outcome = await this.#fetchAndValidate();
    this.#cached = outcome;
    return outcome;
  }

  async loadFocusRecord(elementId: string): Promise<FocusOutcome> {
    const outcome = await this.loadProjection();
    if (outcome.status !== "available") {
      return { status: "unavailable", reason: `no available projection (${outcome.status})` };
    }
    const record = outcome.projection.focus_records.find((r) => r.element_ref === elementId);
    if (!record) {
      return { status: "not_found", elementId };
    }
    return { status: "found", record };
  }

  async #fetchAndValidate(): Promise<ProjectionOutcome> {
    const url = FIXTURE_URLS[this.#fixtureName];
    if (!url) {
      return { status: "disconnected", reason: `unknown fixture set "${this.#fixtureName}"` };
    }

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      return { status: "disconnected", reason: `network error fetching ${url}: ${(err as Error).message}` };
    }
    if (!response.ok) {
      return { status: "disconnected", reason: `missing static snapshot: ${url} responded ${response.status}` };
    }

    let text: string;
    try {
      text = await response.text();
    } catch (err) {
      return { status: "disconnected", reason: `could not read response body from ${url}: ${(err as Error).message}` };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { status: "invalid", reason: "response was not valid JSON", errors: [(err as Error).message] };
    }

    const result = validateProjection(parsed);
    if (!result.valid) {
      return { status: "invalid", reason: "projection failed schema validation", errors: result.errors };
    }

    // Validated: this is a real SenseiDashboardProjectionV1 now, not
    // arbitrary JSON. This is the one and only cast in the adapter — every
    // caller past this point receives the validated domain type.
    const projection = parsed as SenseiDashboardProjectionV1;

    // A schema-valid document can still violate the producer's Focus
    // referential-integrity rule (claude-stage-3-brief.md §2.2) — JSON
    // Schema alone cannot express "exactly one focus_records entry per
    // selectable element". That is a projection-integrity defect, not
    // something this adapter repairs: reject it the same way a
    // schema-validation failure is rejected, with a useful diagnostic.
    const focusIntegrity = validateFocusIntegrity(projection);
    if (!focusIntegrity.valid) {
      return { status: "invalid", reason: "projection failed Focus referential-integrity validation", errors: focusIntegrity.errors };
    }

    if (projection.availability.state === "unavailable") {
      return { status: "unavailable", projection };
    }
    return { status: "available", projection };
  }
}
