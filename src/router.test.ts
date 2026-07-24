import { describe, it, expect, beforeEach } from "vitest";
import { parseRoute, elementHref, Router } from "./router.js";

describe("parseRoute", () => {
  it("maps / and /overview to the overview route", () => {
    expect(parseRoute("/", "")).toEqual({ name: "overview", query: new URLSearchParams("") });
    expect(parseRoute("/overview", "")).toEqual({ name: "overview", query: new URLSearchParams("") });
  });

  it("maps /map and /evolution", () => {
    expect(parseRoute("/map", "").name).toBe("map");
    expect(parseRoute("/evolution", "").name).toBe("evolution");
  });

  it("maps /element/:id and decodes a percent-encoded stable id", () => {
    const route = parseRoute("/element/component.awareness_graph_service", "");
    expect(route).toEqual({ name: "element", elementId: "component.awareness_graph_service", query: new URLSearchParams("") });
  });

  it("round-trips a stable id containing characters that are meaningful in a URL path (: # / @)", () => {
    const id = "contract.awareness_graph#query/v1@2";
    const href = elementHref(id);
    const url = new URL(href, "http://example.test");
    const route = parseRoute(url.pathname, url.search);
    expect(route).toEqual({ name: "element", elementId: id, query: new URLSearchParams("") });
  });

  it("never treats a display name as an identifier — elementId is exactly the path segment, undecoded interpretation is not attempted", () => {
    const route = parseRoute("/element/" + encodeURIComponent("Not A Display Name"), "");
    expect(route).toEqual({ name: "element", elementId: "Not A Display Name", query: new URLSearchParams("") });
  });

  it("preserves query state (lens/revision) alongside the route", () => {
    const route = parseRoute("/map", "?lens=authority&revision=abc123");
    expect(route.query.get("lens")).toBe("authority");
    expect(route.query.get("revision")).toBe("abc123");
  });

  it("falls back to not_found for an unrecognized path", () => {
    const route = parseRoute("/nonsense/path", "");
    expect(route.name).toBe("not_found");
  });

  it("trims a trailing slash before matching", () => {
    expect(parseRoute("/map/", "").name).toBe("map");
  });

  // --- adversarial: malformed percent-encoding must never throw ---

  it.each(["/element/%", "/element/%zz", "/element/%E0%A4%A", "/element/100%", "/element/%GG"])(
    "does not throw on malformed percent-encoding in an element path (%s) — falls back to not_found",
    (path) => {
      expect(() => parseRoute(path, "")).not.toThrow();
      const route = parseRoute(path, "");
      expect(route.name).toBe("not_found");
    }
  );

  it("still decodes a well-formed percent-encoded id correctly (the malformed-input fix doesn't break the normal path)", () => {
    const route = parseRoute("/element/100%25", "");
    expect(route).toEqual({ name: "element", elementId: "100%", query: new URLSearchParams("") });
  });
});

describe("Router — query-state preservation across internal navigation (adversarial)", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("preserves the current query string (e.g. ?fixture=contested) when navigating to a bare pathname", () => {
    window.history.pushState({}, "", "/overview?fixture=contested");
    const router = new Router();
    const seen: string[] = [];
    router.onChange((route) => seen.push(route.query.get("fixture") ?? "(none)"));

    router.navigate("/map");

    expect(window.location.pathname).toBe("/map");
    expect(window.location.search).toBe("?fixture=contested");
    expect(seen.at(-1)).toBe("contested");
  });

  it("reloading the URL after an internal nav resolves to the same fixture the app was actually showing (the exact bug reported: URL must deterministically identify the rendered projection)", () => {
    window.history.pushState({}, "", "/?fixture=contested");
    const router = new Router();
    router.navigate("/evolution"); // simulates clicking the "Evolution" nav link

    // "Reloading the same URL" == re-parsing the current location from
    // scratch, independent of any in-memory router/adapter state.
    const reloaded = parseRoute(window.location.pathname, window.location.search);
    expect(reloaded.name).toBe("evolution");
    expect(reloaded.query.get("fixture")).toBe("contested");
  });

  it("an explicit query in the target path overrides rather than merges with the current one", () => {
    window.history.pushState({}, "", "/?fixture=contested");
    const router = new Router();
    const seen: string[] = [];
    router.onChange((route) => seen.push(route.query.get("fixture") ?? "(none)"));

    router.navigate("/map?fixture=partial");

    expect(window.location.search).toBe("?fixture=partial");
    expect(seen.at(-1)).toBe("partial");
  });

  it("navigating with no current query and no target query is a no-op on the query string", () => {
    window.history.pushState({}, "", "/");
    const router = new Router();
    router.navigate("/map");
    expect(window.location.search).toBe("");
  });
});
