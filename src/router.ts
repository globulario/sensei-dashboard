// Stable routes for the four Stage 1 URL surfaces
// (claude-stage-1-brief.md §4): `/` or `/overview`, `/map`,
// `/element/:elementId`, `/evolution`. Deep links use stable identifiers,
// never display names, and are percent-encoded/decoded safely — a stable
// id's own pattern permits characters like `/` and `#` that would otherwise
// be ambiguous in a URL path segment.

export type Route =
  | { name: "overview"; query: URLSearchParams }
  | { name: "map"; query: URLSearchParams }
  | { name: "element"; elementId: string; query: URLSearchParams }
  | { name: "evolution"; query: URLSearchParams }
  | { name: "not_found"; path: string; query: URLSearchParams };

export function parseRoute(pathname: string, search: string): Route {
  const query = new URLSearchParams(search);
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/" || path === "/overview") return { name: "overview", query };
  if (path === "/map") return { name: "map", query };
  if (path === "/evolution") return { name: "evolution", query };

  const elementMatch = /^\/element\/(.+)$/.exec(path);
  if (elementMatch?.[1]) {
    return { name: "element", elementId: decodeURIComponent(elementMatch[1]), query };
  }

  return { name: "not_found", path, query };
}

/** Builds a safe, stable href for a Focus deep link. Always percent-encodes
 * the element id — never assumes it's URL-safe as-is. */
export function elementHref(elementId: string): string {
  return `/element/${encodeURIComponent(elementId)}`;
}

export const ROUTE_PATHS = {
  overview: "/overview",
  map: "/map",
  evolution: "/evolution",
} as const;

type RouteChangeListener = (route: Route) => void;

/** Minimal history-API router. No framework, no route-table DSL — four
 * fixed routes don't need one (claude-stage-1-brief.md §1: "Do not add a
 * large dependency stack for a mostly static shell"). */
export class Router {
  #listener: RouteChangeListener | undefined;

  constructor() {
    window.addEventListener("popstate", () => this.#emit());
  }

  onChange(listener: RouteChangeListener): void {
    this.#listener = listener;
  }

  start(): void {
    this.#emit();
  }

  navigate(path: string): void {
    if (path === window.location.pathname + window.location.search) return;
    window.history.pushState({}, "", path);
    this.#emit();
  }

  #emit(): void {
    this.#listener?.(parseRoute(window.location.pathname, window.location.search));
  }
}
