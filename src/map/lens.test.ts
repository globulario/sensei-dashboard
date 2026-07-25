import { describe, it, expect } from "vitest";
import { resolveLens, CANONICAL_MAP_LENSES, IMPLEMENTED_MAP_LENSES, DEFAULT_MAP_LENS } from "./lens.js";

describe("resolveLens", () => {
  it("defaults to structure when no lens param is present", () => {
    const r = resolveLens(null);
    expect(r).toEqual({ requested: null, effective: "structure", kind: "implemented" });
    expect(DEFAULT_MAP_LENS).toBe("structure");
  });

  it("resolves an implemented lens as itself", () => {
    for (const lens of IMPLEMENTED_MAP_LENSES) {
      expect(resolveLens(lens)).toEqual({ requested: lens, effective: lens, kind: "implemented" });
    }
  });

  it("classifies a canonical-but-unimplemented lens distinctly, falling back to structure for `effective` only", () => {
    for (const lens of ["behavior", "risk", "change", "closure"] as const) {
      const r = resolveLens(lens);
      expect(r.kind).toBe("unimplemented_canonical");
      expect(r.effective).toBe("structure");
      expect(r.requested).toBe(lens);
    }
  });

  it("classifies a non-canonical token as unknown, never crashing, falling back to structure", () => {
    const r = resolveLens("not-a-real-lens");
    expect(r).toEqual({ requested: "not-a-real-lens", effective: "structure", kind: "unknown" });
  });

  it("the six canonical lens identifiers are preserved even though only two are implemented", () => {
    expect(CANONICAL_MAP_LENSES).toEqual(["structure", "authority", "behavior", "risk", "change", "closure"]);
    expect(IMPLEMENTED_MAP_LENSES).toEqual(["structure", "authority"]);
  });
});
