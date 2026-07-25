// Architecture Map lens (claude-stage-4-map-brief.md §5). A lens is a pure
// URL-token → classification mapping; it never touches the map model
// (buildArchitectureMapModel takes no lens parameter at all — see
// model.ts's header comment) and only ever changes render-svg.ts's
// emphasis/visibility choices over one fixed geometry (brief Law C).
//
// Reuses the six-token canonical lens union already defined for the agent
// handoff envelope (`HandoffLens` in ../handoff/build-envelope.ts) rather
// than inventing a parallel type — the brief is explicit that "the six
// canonical lens identifiers remain preserved by the product contract",
// and it's the same six-token vocabulary in both places.

import type { HandoffLens } from "../handoff/build-envelope.js";

export type MapLens = HandoffLens;

export const CANONICAL_MAP_LENSES: readonly MapLens[] = ["structure", "authority", "behavior", "risk", "change", "closure"];

export const IMPLEMENTED_MAP_LENSES: readonly MapLens[] = ["structure", "authority"];

export const DEFAULT_MAP_LENS: MapLens = "structure";

export interface ResolvedLens {
  /** The raw query-string token, or null when the `lens` param was absent. */
  requested: string | null;
  /** Always one of the implemented lenses — the lens render-svg.ts actually
   * draws geometry-emphasis for. Never itself a signal that the requested
   * lens was honored; check `kind` for that. */
  effective: MapLens;
  /** `implemented`: requested (or defaulted) lens is drawn as requested.
   * `unimplemented_canonical`: a real, canonical-but-not-yet-built lens
   * (behavior/risk/change/closure) — render-svg.ts must show the honest
   * "not implemented in this build" state, never silently draw Structure
   * while labeling it as the requested lens (brief §8.4).
   * `unknown`: not one of the six canonical tokens at all (typo, garbage
   * query value) — falls back to Structure the same as `unimplemented_canonical`,
   * but gets its own distinct honest note rather than being silently
   * absorbed into the default with no explanation. */
  kind: "implemented" | "unimplemented_canonical" | "unknown";
}

function isCanonicalLens(token: string): token is MapLens {
  return (CANONICAL_MAP_LENSES as readonly string[]).includes(token);
}

export function resolveLens(token: string | null): ResolvedLens {
  if (token === null) {
    return { requested: null, effective: DEFAULT_MAP_LENS, kind: "implemented" };
  }
  if ((IMPLEMENTED_MAP_LENSES as readonly string[]).includes(token)) {
    return { requested: token, effective: token as MapLens, kind: "implemented" };
  }
  if (isCanonicalLens(token)) {
    return { requested: token, effective: DEFAULT_MAP_LENS, kind: "unimplemented_canonical" };
  }
  return { requested: token, effective: DEFAULT_MAP_LENS, kind: "unknown" };
}
