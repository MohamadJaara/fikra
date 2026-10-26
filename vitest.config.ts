import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "edge-runtime",
    exclude: ["**/node_modules/**", "**/dist/**", "convex/testHelpers.test.ts"],
  },
});
