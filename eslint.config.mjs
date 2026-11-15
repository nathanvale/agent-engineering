import js from "@eslint/js";
import localRules from "./eslint-rules.mjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      ".fallow/**",
      ".worktrees/**",
    ],
  },
  {
    files: ["**/*.ts"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "node:child_process",
              message: "Only the runtime effect owner may spawn subprocesses.",
            },
          ],
          patterns: [
            {
              group: ["@logtape/*"],
              message: "Only the diagnostics owner may import LogTape.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/cli.ts"],
    rules: { "no-console": ["error", { allow: ["log"] }] },
  },

  {
    files: ["src/domains/**/*.ts"],
    plugins: { repository: localRules },
    rules: { "repository/no-domain-output": "error" },
  },
);
