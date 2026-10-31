import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next. The "**/" prefix matters:
    // eslint-config-next's own patterns (".next/**" etc.) only match at
    // the repo root, so a nested checkout — e.g. a separate Git
    // worktree under .claude/worktrees/ — has its own .next build
    // output walked and linted too, inflating error/warning counts
    // with generated, non-source JS. The "**/" prefix makes these
    // match at any depth, while leaving every real source file (in
    // this checkout or a worktree) fully linted as normal.
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
