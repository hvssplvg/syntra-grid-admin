import { defineConfig } from "vitest/config";
import path from "path";

// Mirrors tsconfig.json's "@/*" -> "./*" path alias so test files can
// import the same way the app does. No Prisma/DB setup here by design —
// see docs/campaigns-implementation-checklist.md's Phase 17 note: tests
// run against pure business logic only, never a live database.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // e2e/ holds Playwright specs (own runner, own config) — exclude them
    // here so Vitest's default include glob doesn't also try to collect
    // test.describe()-based files meant for `npx playwright test`. The
    // rest of this list is Vitest's own default exclude set, preserved
    // since setting `exclude` at all replaces it rather than extending it.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "**/e2e/**",
    ],
  },
});
