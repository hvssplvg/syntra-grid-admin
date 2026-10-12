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
  },
});
