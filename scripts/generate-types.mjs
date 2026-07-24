#!/usr/bin/env node
// Regenerates contract/generated/*.ts from the pinned canonical JSON Schemas
// in docs/. Deterministic: same schema bytes in, same TypeScript bytes out,
// every run. Run with `npm run generate:types`.
//
// This script only transcribes the schema's own shape into TypeScript
// types. It must never add fields, rename properties, loosen
// required-ness, or otherwise introduce frontend-invented semantics beyond
// what the schema itself declares. The generation logic lives in
// scripts/lib/generate.mjs so this CLI and the drift-check test
// (test/generated-types.test.mjs) can never disagree about what
// "regenerated" means.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { generateAll, outDir } from "./lib/generate.mjs";
import { repoRoot } from "./lib/pin.mjs";

await mkdir(outDir, { recursive: true });
for (const { outFile, contents } of await generateAll()) {
  const outPath = path.join(outDir, outFile);
  await writeFile(outPath, contents, "utf8");
  console.log(`wrote ${path.relative(repoRoot, outPath)}`);
}
