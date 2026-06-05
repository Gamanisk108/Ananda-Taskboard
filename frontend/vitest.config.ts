import { defineConfig } from "vitest/config";

// Standalone test config (kept separate from vite.config.ts so the PWA/React
// build plugins don't load during unit tests). Tests cover pure logic only.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
