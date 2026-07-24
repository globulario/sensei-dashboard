// Test-only helper: the static adapter uses real fetch() against
// public/fixtures/* the way a deployed static site would. Vitest doesn't
// run Vite's dev server, so this maps that same URL space onto the real
// files on disk instead of mocking away what's being tested.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "public");

export function installPublicDirFetchMock(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    const filePath = path.join(publicDir, url.replace(/^\//, ""));
    try {
      const data = await readFile(filePath, "utf8");
      return new Response(data, { status: 200 });
    } catch {
      return new Response("not found", { status: 404 });
    }
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
