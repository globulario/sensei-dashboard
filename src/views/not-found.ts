// An unrecognized path (not one of the four stable routes). Distinct from
// the Focus view's "unknown deep-linked element" — this is a routing-level
// 404, not a data-level one.

export function renderNotFoundRoute(container: HTMLElement, path: string): void {
  container.replaceChildren();
  const heading = document.createElement("h1");
  heading.textContent = "Not found";
  container.appendChild(heading);
  const note = document.createElement("p");
  note.textContent = `"${path}" is not one of the Stage 1 routes (/, /overview, /map, /element/:elementId, /evolution).`;
  container.appendChild(note);
}
