import { describe, it, expect } from "vitest";
import { parseRoute, elementHref } from "./router.js";

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
});
