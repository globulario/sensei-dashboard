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
  #currentRouteName: Route["name"] | undefined;

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
      a.href = link.path;
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
    this.#currentRouteName = route.name;
    this.#renderNav(route.name);

    // The projection is fetched once; every route after the first reuses
    // the adapter's own cache (see StaticFixtureAdapter).
    this.#outcome = { status: "loading" };
    this.#renderIdentity(this.#outcome);
    renderNonAvailableState(this.#mainEl, this.#outcome);

    const outcome = await this.#adapter.loadProjection();
    this.#outcome = outcome;

    // A route change may have happened while the fetch was in flight.
    if (this.#currentRouteName !== route.name) return;

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
      case "element":
        await renderFocus(this.#mainEl, projection, this.#adapter, route.elementId);
        return;
      case "not_found":
        renderNotFoundRoute(this.#mainEl, route.path);
        return;
    }
  }
}
