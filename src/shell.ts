// Application shell (claude-stage-1-brief.md §5): product header,
// repository/revision identity area, primary navigation, main content
// region, optional Focus region. Fetches the projection once (the adapter
// caches it) and re-renders the active view on every route change without
// re-fetching.

import type { ProjectionAdapter, ProjectionOutcome } from "./adapter/types.js";
import type { Route, Router } from "./router.js";
import { ROUTE_PATHS } from "./router.js";
import { renderNonAvailableState } from "./state/render-states.js";
import { renderOverview } from "./views/overview.js";
import { renderMap } from "./views/map.js";
import { renderEvolution } from "./views/evolution.js";
import { renderFocus } from "./views/focus.js";
import { renderNotFoundRoute } from "./views/not-found.js";

export class Shell {
  #root: HTMLElement;
  #adapter: ProjectionAdapter;
  #router: Router;
  #identityEl!: HTMLElement;
  #navEl!: HTMLElement;
  #mainEl!: HTMLElement;
  #outcome: ProjectionOutcome = { status: "loading" };
  /**
   * Incremented at the start of every render() call. Every async
   * continuation compares its own captured value against the current one
   * before touching the DOM — comparing route *names* is not enough, since
   * two different /element/:id navigations share the same route name
   * ("element") and a slower response for the first could otherwise
   * overwrite a faster response already shown for the second.
   */
  #renderGeneration = 0;

  constructor(root: HTMLElement, adapter: ProjectionAdapter, router: Router) {
    this.#root = root;
    this.#adapter = adapter;
    this.#router = router;
    this.#buildChrome();
  }

  #buildChrome(): void {
    this.#root.replaceChildren();

    const header = document.createElement("header");
    header.className = "shell-header";

    const title = document.createElement("p");
    title.className = "shell-header__title";
    title.textContent = "Sensei Dashboard";
    header.appendChild(title);

    this.#identityEl = document.createElement("div");
    this.#identityEl.className = "shell-header__identity";
    header.appendChild(this.#identityEl);

    this.#navEl = document.createElement("nav");
    this.#navEl.className = "shell-nav";
    this.#navEl.setAttribute("aria-label", "Primary");
    header.appendChild(this.#navEl);

    this.#root.appendChild(header);

    this.#mainEl = document.createElement("main");
    this.#mainEl.className = "shell-main";
    this.#mainEl.setAttribute("id", "main-content");
    this.#root.appendChild(this.#mainEl);
  }

  #renderNav(activeRouteName: Route["name"]): void {
    this.#navEl.replaceChildren();
    const links: Array<{ name: Route["name"]; label: string; path: string }> = [
      { name: "overview", label: "Overview", path: ROUTE_PATHS.overview },
      { name: "map", label: "Map", path: ROUTE_PATHS.map },
      { name: "evolution", label: "Evolution", path: ROUTE_PATHS.evolution },
    ];
    for (const link of links) {
      const a = document.createElement("a");
      // Carry the current query string (e.g. ?fixture=contested) into the
      // href itself, not just the JS-driven navigate() call below — a
      // middle-click/open-in-new-tab bypasses the click handler and follows
      // the href literally, and it must resolve to the same rendered
      // projection, not silently fall back to the default fixture.
      a.href = link.path + window.location.search;
      a.textContent = link.label;
      a.className = "shell-nav__link";
      if (link.name === activeRouteName) {
        a.setAttribute("aria-current", "page");
      }
      a.addEventListener("click", (event) => {
        event.preventDefault();
        this.#router.navigate(link.path);
      });
      this.#navEl.appendChild(a);
    }
  }

  #renderIdentity(outcome: ProjectionOutcome): void {
    this.#identityEl.replaceChildren();
    if (outcome.status === "available" || outcome.status === "unavailable") {
      const { repository, revision } = outcome.projection.identity;
      const text = document.createElement("p");
      text.className = "shell-header__identity-text";
      text.textContent = `${repository.display_name} @ ${revision.display ?? revision.id}`;
      this.#identityEl.appendChild(text);
    }
  }

  async render(route: Route): Promise<void> {
    const generation = ++this.#renderGeneration;
    this.#renderNav(route.name);

    // The projection is fetched once; every route after the first reuses
    // the adapter's own cache (see StaticFixtureAdapter).
    this.#outcome = { status: "loading" };
    this.#renderIdentity(this.#outcome);
    renderNonAvailableState(this.#mainEl, this.#outcome);

    const outcome = await this.#adapter.loadProjection();

    // A newer render() may have started (and possibly already finished)
    // while this fetch was in flight — never let a stale response paint
    // over it.
    if (generation !== this.#renderGeneration) return;

    this.#outcome = outcome;
    this.#renderIdentity(outcome);

    if (renderNonAvailableState(this.#mainEl, outcome)) {
      return;
    }

    const projection = outcome.projection;
    switch (route.name) {
      case "overview":
        renderOverview(this.#mainEl, projection);
        return;
      case "map":
        renderMap(this.#mainEl, projection);
        return;
      case "evolution":
        renderEvolution(this.#mainEl, projection);
        return;
      case "element": {
        renderNonAvailableState(this.#mainEl, { status: "loading" });
        const focusOutcome = await this.#adapter.loadFocusRecord(route.elementId);
        // Same guard, for the second async gap: two /element/:id
        // navigations share route.name === "element", so this generation
        // check — not a route-name comparison — is what actually prevents
        // element A's slower response from overwriting element B's.
        if (generation !== this.#renderGeneration) return;
        renderFocus(this.#mainEl, focusOutcome);
        return;
      }
      case "not_found":
        renderNotFoundRoute(this.#mainEl, route.path);
        return;
    }
  }
}
