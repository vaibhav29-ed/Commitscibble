import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@commitscibble\/shared\/node$/,
        replacement: resolvePath("./packages/shared/src/node.ts"),
      },
      { find: /^@commitscibble\/shared$/, replacement: resolvePath("./packages/shared/src/index.ts") },
      { find: /^@commitscibble\/config$/, replacement: resolvePath("./packages/config/src/index.ts") },
      { find: /^@commitscibble\/github$/, replacement: resolvePath("./packages/github/src/index.ts") },
      { find: /^@commitscibble\/ai-engine$/, replacement: resolvePath("./packages/ai-engine/src/index.ts") },
      {
        find: /^@commitscibble\/documentation-engine$/,
        replacement: resolvePath("./packages/documentation-engine/src/index.ts"),
      },
      { find: /^@commitscibble\/email$/, replacement: resolvePath("./packages/email/src/index.ts") },
      {
        find: /^@commitscibble\/persistence$/,
        replacement: resolvePath("./packages/persistence/src/index.ts"),
      },
    ],
  },
  test: {
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "services/**/*.test.ts",
      "tests/**/*.test.ts",
      "apps/**/*.test.tsx",
    ],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: [
        "packages/*/src/**/*.ts",
        "services/*/src/**/*.ts",
        "apps/web/src/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.test.*", "**/*.d.ts"],
      thresholds: {
        statements: 33,
        branches: 68,
        functions: 45,
        lines: 33,
      },
    },
  },
});
