import { defineConfig } from "vite";

// Stage 1: standalone static shell only. No framework plugin — see
// docs/architecture-stage-1-notes.md for why vanilla TypeScript was chosen.
// The build output must work both as plain static assets (GitHub Pages) and
// when served by `sensei serve`, so no absolute base path is assumed.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
