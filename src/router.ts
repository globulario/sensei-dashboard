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
    // decodeURIComponent throws URIError on malformed percent-encoding
    // (e.g. "%", "%zz", a truncated multi-byte sequence). A bad link must
    // fail into an honest not_found route, never crash routing.
    try {
      const elementId = decodeURIComponent(elementMatch[1]);
      return { name: "element", elementId, query };
    } catch {
      return { name: "not_found", path, query };
    }
  }

  return { name: "not_found", path, query };
}

/** Builds a safe, stable href for a Focus deep link. Always percent-encodes
 * the element id — never assumes it's URL-safe as-is. Carries the current
 * query string forward (e.g. `?fixture=contested`) the same way Shell's nav
 * links do, so following a Focus link keeps resolving the same projection
 * instead of silently falling back to the default fixture
 * (claude-stage-3-brief.md §2.1: "preserve current query state such as
 * fixture, lens, or revision context"). */
export function elementHref(elementId: string): string {
  return `/element/${encodeURIComponent(elementId)}${window.location.search}`;
}

/**
 * Builds the current path with one query parameter added, replaced, or
 * removed — the same "preserve everything else" contract as `navigate`'s
 * default query-carrying behavior, but for callers that need to change one
 * param deliberately (e.g. the Architecture Map's lens control) rather than
 * just follow a link. Passing `value === defaultValue` removes the param
 * instead of writing it, so the URL doesn't accumulate a redundant
 * `?lens=structure` when structure is already the default — reload, copied
 * links, and back/forward all still resolve to the same lens either way.
 */
export function withQueryParam(param: string, value: string | null, defaultValue?: string): string {
  const params = new URLSearchParams(window.location.search);
  if (value === null || value === defaultValue) {
    params.delete(param);
  } else {
    params.set(param, value);
  }
  const qs = params.toString();
  return window.location.pathname + (qs ? `?${qs}` : "?");
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

  /**
   * Navigates to `path`. If `path` carries no query string of its own, the
   * current one (e.g. `?fixture=contested`, or a future `?lens=`/
   * `?revision=`) is preserved rather than silently dropped — otherwise the
   * URL stops deterministically identifying the rendered projection: a nav
   * click could keep the in-memory adapter pointed at one fixture while the
   * address bar (and a reload of it) would resolve to the default. Pass a
   * path that already contains "?" (even `path + "?"` for an explicitly
   * empty query) to opt out.
   */
  navigate(path: string): void {
    const target = path.includes("?") ? path : path + window.location.search;
    if (target === window.location.pathname + window.location.search) return;
    window.history.pushState({}, "", target);
    this.#emit();
  }

  #emit(): void {
    this.#listener?.(parseRoute(window.location.pathname, window.location.search));
  }
}
