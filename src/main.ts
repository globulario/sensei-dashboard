import { StaticFixtureAdapter, DEFAULT_FIXTURE } from "./adapter/static-fixture-adapter.js";
import { Router } from "./router.js";
import { Shell } from "./shell.js";

const params = new URLSearchParams(window.location.search);
const fixtureName = params.get("fixture") ?? DEFAULT_FIXTURE;
const adapter = new StaticFixtureAdapter(fixtureName);

const root = document.getElementById("app");
if (!root) {
  throw new Error("missing #app root element");
}

const router = new Router();
const shell = new Shell(root, adapter, router);
router.onChange((route) => {
  void shell.render(route);
});
router.start();
