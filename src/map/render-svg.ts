// Architecture Map SVG renderer (claude-stage-4-map-brief.md deliverable 4).
// The only DOM-touching module in src/map/ — everything upstream
// (model.ts/layout.ts/routing.ts) is pure. Consumes one already-built
// ArchitectureMapModel and never recomputes geometry; lens changes only
// toggle a CSS class on the root <svg> plus which optional groups render,
// never coordinates (brief Law C).
//
// Visual layer order (bottom to top, brief §4): region/lane backgrounds →
// boundary rail → contract/flow routes → component/region foreground nodes
// → labels. Each layer is one <g> appended in that order.
//
// Regions/components are real SVG <a href> elements (native keyboard
// operability — Tab reaches them, Enter/click follows them, exactly like
// any other link in this app). Contracts/flows/boundaries are not
// independently focusable shapes; their operability lives entirely in the
// semantic relationship list below the SVG (brief §6: "a visual edge may be
// difficult to operate directly with keyboard or touch").

import type { SenseiDashboardProjectionV1 } from "../../contract/generated/dashboard-projection-v1.js";
import type { ArchitectureMapModel, MapContractEdge, MapFlowPath, RoutePath } from "./model.js";
import { ReferenceIndex } from "../adapter/reference-index.js";
import { elementHref, withQueryParam } from "../router.js";
import { el } from "../views/dom.js";
import { resolveLens, IMPLEMENTED_MAP_LENSES, DEFAULT_MAP_LENS, type MapLens, type ResolvedLens } from "./lens.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  }
  return node;
}

function pathD(route: RoutePath): string {
  return route.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

/** Deterministic, collision-safe fragment id scope for this one model —
 * used only for <marker>/<title>/<desc> ids that need document-unique
 * `id`/`href="#..."` targets. Individual region/component/edge nodes carry
 * the raw stable id verbatim in `data-stable-id` instead (attribute values
 * accept any character, no sanitization needed there). */
function scopeFromProjectionId(projectionId: string): string {
  return `map-${projectionId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function buildDefs(scope: string): SVGDefsElement {
  const defs = svgEl("defs");

  const arrow = svgEl("marker", {
    id: `${scope}-arrow`,
    viewBox: "0 0 10 10",
    refX: "9",
    refY: "5",
    markerWidth: "7",
    markerHeight: "7",
    orient: "auto-start-reverse",
  });
  arrow.appendChild(svgEl("path", { d: "M0,0 L10,5 L0,10 z", class: "map-marker-arrow" }));
  defs.appendChild(arrow);

  const diamond = svgEl("marker", {
    id: `${scope}-diamond`,
    viewBox: "0 0 10 10",
    refX: "5",
    refY: "5",
    markerWidth: "6",
    markerHeight: "6",
    orient: "auto-start-reverse",
  });
  diamond.appendChild(svgEl("path", { d: "M5,0 L10,5 L5,10 L0,5 z", class: "map-marker-diamond" }));
  defs.appendChild(diamond);

  return defs;
}

function buildContractPath(contract: MapContractEdge, scope: string): SVGPathElement | null {
  if (!contract.route) return null;
  const path = svgEl("path", {
    d: pathD(contract.route),
    class: `map-edge map-edge--contract map-edge--state-${contract.state}${contract.boundaryRefs.length > 0 ? " map-edge--crosses-boundary" : ""}`,
    "data-stable-id": contract.id,
    "data-kind": "contract",
    fill: "none",
  });
  if (contract.direction === "source_to_target" || contract.direction === "bidirectional") {
    path.setAttribute("marker-end", `url(#${scope}-arrow)`);
  }
  if (contract.direction === "target_to_source" || contract.direction === "bidirectional") {
    path.setAttribute("marker-start", `url(#${scope}-arrow)`);
  }
  if (contract.direction === "undirected") {
    path.setAttribute("marker-start", `url(#${scope}-diamond)`);
    path.setAttribute("marker-end", `url(#${scope}-diamond)`);
  }
  return path;
}

function buildFlowElements(flow: MapFlowPath): SVGElement[] {
  const nodes: SVGElement[] = [];
  for (const segment of flow.segments) {
    nodes.push(
      svgEl("path", {
        d: pathD(segment.route),
        class: `map-edge map-edge--flow map-edge--state-${flow.state}`,
        "data-stable-id": flow.id,
        "data-kind": "flow",
        fill: "none",
        "stroke-dasharray": "6 4",
      })
    );
  }
  for (const step of flow.steps) {
    if (!step.point) continue;
    nodes.push(
      svgEl("circle", {
        cx: String(step.point.x),
        cy: String(step.point.y),
        r: "4",
        class: "map-flow-step",
        "data-stable-id": flow.id,
        "data-kind": "flow-step",
      })
    );
  }
  return nodes;
}

function buildLensControl(query: URLSearchParams, resolved: ResolvedLens, navigate: (path: string) => void): HTMLElement {
  const wrap = el("div", { className: "map-lens-control" });
  const label = el("span", { className: "map-lens-control__label", text: "Lens", attrs: { id: "map-lens-label" } });
  wrap.appendChild(label);

  const group = el("div", { className: "map-lens-control__group", attrs: { role: "group", "aria-labelledby": "map-lens-label" } });
  for (const lens of IMPLEMENTED_MAP_LENSES) {
    const isCurrent = resolved.kind === "implemented" && resolved.effective === lens;
    const a = el("a", {
      className: "map-lens-control__link",
      text: lens.charAt(0).toUpperCase() + lens.slice(1),
      attrs: { href: withQueryParam("lens", lens, DEFAULT_MAP_LENS) },
    });
    if (isCurrent) a.setAttribute("aria-current", "true");
    a.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(withQueryParam("lens", lens, DEFAULT_MAP_LENS));
    });
    group.appendChild(a);
  }
  void query;
  wrap.appendChild(group);
  return wrap;
}

function relationshipItem(label: string, hrefId: string, extra: string): HTMLElement {
  const li = el("li", { className: "ref-list__item" });
  li.appendChild(el("a", { text: label, attrs: { href: elementHref(hrefId) } }));
  li.appendChild(el("span", { className: "ref-list__id", text: ` ${extra}` }));
  return li;
}

function buildRelationshipList(model: ArchitectureMapModel, projection: SenseiDashboardProjectionV1): HTMLElement {
  const index = new ReferenceIndex(projection);
  const section = el("section", { className: "map-relationships", attrs: { "aria-label": "Architectural relationships" } });
  section.appendChild(el("h2", { text: "Relationships" }));

  if (model.contracts.length > 0) {
    const wrap = el("div", { className: "ref-list" });
    wrap.appendChild(el("p", { className: "ref-list__label", text: `Contracts (${model.contracts.length})` }));
    const list = el("ul", { className: "ref-list__items" });
    for (const c of model.contracts) {
      const sourceLabel = index.resolve(c.sourceId);
      const targetLabel = index.resolve(c.targetId);
      const sourceText = sourceLabel.resolved ? sourceLabel.label : `unresolved (${c.sourceId})`;
      const targetText = targetLabel.resolved ? targetLabel.label : `unresolved (${c.targetId})`;
      list.appendChild(
        relationshipItem(
          c.name,
          c.id,
          `— ${c.kind}, ${sourceText} → ${targetText} (${c.direction}), state ${c.state}, id ${c.id}`
        )
      );
    }
    wrap.appendChild(list);
    section.appendChild(wrap);
  } else {
    section.appendChild(el("p", { className: "map-relationships__empty", text: "No contracts were supplied in this projection." }));
  }

  if (model.flows.length > 0) {
    const wrap = el("div", { className: "ref-list" });
    wrap.appendChild(el("p", { className: "ref-list__label", text: `Flows (${model.flows.length})` }));
    const list = el("ul", { className: "ref-list__items" });
    for (const f of model.flows) {
      const stepLabels = f.steps.map((s) => {
        const r = index.resolve(s.elementId);
        return r.resolved ? r.label : `unresolved (${s.elementId})`;
      });
      list.appendChild(relationshipItem(f.name, f.id, `— ${f.kind}, steps: ${stepLabels.join(" → ")}, state ${f.state}, id ${f.id}`));
    }
    wrap.appendChild(list);
    section.appendChild(wrap);
  } else {
    section.appendChild(el("p", { className: "map-relationships__empty", text: "No flows were supplied in this projection." }));
  }

  if (model.boundaries.length > 0) {
    const wrap = el("div", { className: "ref-list" });
    wrap.appendChild(el("p", { className: "ref-list__label", text: `Boundaries (${model.boundaries.length})` }));
    const list = el("ul", { className: "ref-list__items" });
    for (const b of model.boundaries) {
      const memberLabels = b.connectors.map((conn) => {
        const r = index.resolve(conn.memberId);
        return r.resolved ? r.label : `unresolved (${conn.memberId})`;
      });
      list.appendChild(
        relationshipItem(b.name, b.id, `— ${b.kind}, members: ${memberLabels.length > 0 ? memberLabels.join(", ") : "none resolved"}, state ${b.state}, id ${b.id}`)
      );
    }
    wrap.appendChild(list);
    section.appendChild(wrap);
  } else {
    section.appendChild(el("p", { className: "map-relationships__empty", text: "No boundaries were supplied in this projection." }));
  }

  return section;
}

function buildDiagnosticsSection(model: ArchitectureMapModel): HTMLElement | null {
  if (model.diagnostics.length === 0) return null;
  const section = el("section", { className: "map-diagnostics", attrs: { "aria-label": "Map diagnostics" } });
  section.appendChild(el("h2", { text: "Map diagnostics" }));
  section.appendChild(
    el("p", {
      className: "map-diagnostics__note",
      text: "The map omitted the following explicit references it could not resolve or reconcile. This does not mean the architecture is safe, healthy, or relationship-free — only that the map could not draw these specific references.",
    })
  );
  const list = el("ul", { className: "map-diagnostics__list" });
  for (const d of model.diagnostics) {
    list.appendChild(el("li", { className: `map-diagnostics__item map-diagnostics__item--${d.kind}`, text: d.message }));
  }
  section.appendChild(list);
  return section;
}

function unsupportedLensBlock(requested: string): HTMLElement {
  return el("div", {
    className: "state-block state-block--unsupported-lens",
    text: `The "${requested}" lens is not implemented in this build. Showing the implemented Structure and Authority lenses above.`,
    attrs: { role: "status" },
  });
}

function unknownLensNote(requested: string): HTMLElement {
  return el("p", {
    className: "state-block state-block--unknown-lens",
    text: `"${requested}" is not a recognized lens — showing Structure.`,
    attrs: { role: "status" },
  });
}

function buildSvg(model: ArchitectureMapModel, projection: SenseiDashboardProjectionV1, lens: MapLens): SVGSVGElement {
  const scope = scopeFromProjectionId(model.projectionId);
  const svg = svgEl("svg", {
    viewBox: `${model.bounds.x} ${model.bounds.y} ${model.bounds.width} ${model.bounds.height}`,
    width: "100%",
    class: `arch-map-svg map-lens-${lens}`,
    "aria-labelledby": `${scope}-title`,
    "aria-describedby": `${scope}-desc`,
  });

  const title = svgEl("title", { id: `${scope}-title` });
  title.textContent = `Architecture Map — ${lens} lens`;
  svg.appendChild(title);

  const desc = svgEl("desc", { id: `${scope}-desc` });
  desc.textContent = `${projection.identity.repository.display_name} at revision ${projection.identity.revision.display ?? projection.identity.revision.id}. ${model.regions.length} region(s), ${model.components.length} component(s), ${model.boundaries.length} boundary(ies), ${model.contracts.length} contract(s), ${model.flows.length} flow(s). Structure and Authority lenses render identical coordinates; only emphasis differs.`;
  svg.appendChild(desc);

  svg.appendChild(buildDefs(scope));

  const backgroundsLayer = svgEl("g", { class: "layer layer-region-backgrounds" });
  for (const region of model.regions) {
    backgroundsLayer.appendChild(
      svgEl("rect", {
        x: String(region.rect.x),
        y: String(region.rect.y),
        width: String(region.rect.width),
        height: String(region.rect.height),
        class: `map-region-bg map-region-bg--state-${region.state}`,
      })
    );
  }
  svg.appendChild(backgroundsLayer);

  const boundaryLayer = svgEl("g", { class: "layer layer-boundary-rails" });
  for (const boundary of model.boundaries) {
    boundaryLayer.appendChild(
      svgEl("rect", {
        x: String(boundary.railRect.x),
        y: String(boundary.railRect.y),
        width: String(boundary.railRect.width),
        height: String(boundary.railRect.height),
        class: `map-boundary-rail map-boundary-rail--${boundary.kind}`,
        "data-stable-id": boundary.id,
        "data-kind": "boundary",
      })
    );
    for (const connector of boundary.connectors) {
      boundaryLayer.appendChild(
        svgEl("line", {
          x1: String(connector.point.x),
          y1: String(connector.point.y),
          x2: String(connector.point.x),
          y2: String(boundary.railRect.y),
          class: "map-boundary-connector",
        })
      );
    }
  }
  // component.authority_refs connectors are a distinct signal from
  // boundary.member_refs membership (brief §3.3) — rendered with their own
  // class so Authority-lens emphasis and Structure-lens de-emphasis can
  // target them independently of membership connectors above.
  const boundaryRailById = new Map(model.boundaries.map((b) => [b.id, b.railRect]));
  for (const component of model.components) {
    for (const authorityRef of component.authorityRefs) {
      const railRect = boundaryRailById.get(authorityRef);
      if (!railRect) continue;
      const x = component.rect.x + component.rect.width / 2;
      boundaryLayer.appendChild(
        svgEl("line", {
          x1: String(x),
          y1: String(component.rect.y + component.rect.height),
          x2: String(x),
          y2: String(railRect.y),
          class: "map-authority-ref-connector",
          "data-stable-id": component.id,
          "data-kind": "component-authority-ref",
        })
      );
    }
  }
  svg.appendChild(boundaryLayer);

  const routesLayer = svgEl("g", { class: "layer layer-routes" });
  for (const contract of model.contracts) {
    const path = buildContractPath(contract, scope);
    if (path) routesLayer.appendChild(path);
  }
  for (const flow of model.flows) {
    for (const node of buildFlowElements(flow)) routesLayer.appendChild(node);
  }
  svg.appendChild(routesLayer);

  const nodesLayer = svgEl("g", { class: "layer layer-nodes" });
  for (const region of model.regions) {
    const a = svgEl("a", {
      href: elementHref(region.id),
      class: "map-node map-node--region",
      "aria-label": `${region.name}, region, state ${region.state}, id ${region.id}`,
      "data-stable-id": region.id,
      "data-kind": "region",
    });
    a.appendChild(
      svgEl("rect", {
        x: String(region.rect.x),
        y: String(region.rect.y),
        width: String(region.rect.width),
        height: String(region.rect.height),
        class: "map-region-outline",
        fill: "none",
        "pointer-events": "all",
      })
    );
    nodesLayer.appendChild(a);
  }
  for (const component of model.components) {
    const a = svgEl("a", {
      href: elementHref(component.id),
      class: `map-node map-node--component map-node--state-${component.state}`,
      "aria-label": `${component.name}, component, state ${component.state}, id ${component.id}`,
      "data-stable-id": component.id,
      "data-kind": "component",
    });
    a.appendChild(
      svgEl("rect", {
        x: String(component.rect.x),
        y: String(component.rect.y),
        width: String(component.rect.width),
        height: String(component.rect.height),
        class: "map-node-box",
      })
    );
    nodesLayer.appendChild(a);
  }
  svg.appendChild(nodesLayer);

  const labelsLayer = svgEl("g", { class: "layer layer-labels" });
  for (const region of model.regions) {
    const text = svgEl("text", {
      x: String(region.rect.x + 8),
      y: String(region.rect.y + 20),
      class: "map-label map-label--region",
      "aria-hidden": "true",
    });
    text.textContent = region.name;
    labelsLayer.appendChild(text);
  }
  for (const component of model.components) {
    const text = svgEl("text", {
      x: String(component.rect.x + component.rect.width / 2),
      y: String(component.rect.y + component.rect.height / 2),
      class: "map-label map-label--component",
      "text-anchor": "middle",
      "aria-hidden": "true",
    });
    text.textContent = component.name;
    labelsLayer.appendChild(text);
  }
  svg.appendChild(labelsLayer);

  return svg;
}

export function renderArchitectureMap(
  container: HTMLElement,
  projection: SenseiDashboardProjectionV1,
  model: ArchitectureMapModel,
  opts: { query: URLSearchParams; navigate: (path: string) => void }
): void {
  const resolved = resolveLens(opts.query.get("lens"));

  container.appendChild(buildLensControl(opts.query, resolved, opts.navigate));

  if (resolved.kind === "unimplemented_canonical") {
    container.appendChild(unsupportedLensBlock(resolved.requested ?? ""));
    return;
  }

  if (resolved.kind === "unknown" && resolved.requested !== null) {
    container.appendChild(unknownLensNote(resolved.requested));
  }

  const figure = el("figure", { className: "arch-map-figure" });
  figure.appendChild(buildSvg(model, projection, resolved.effective));
  container.appendChild(figure);

  container.appendChild(buildRelationshipList(model, projection));

  const diagnostics = buildDiagnosticsSection(model);
  if (diagnostics) container.appendChild(diagnostics);
}
