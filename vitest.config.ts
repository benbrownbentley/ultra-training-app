import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// vite-tsconfig-paths makes `@/lib/...` imports resolve in tests the
// same way Next.js does at build time. Without it, Vitest sees the bare
// alias and throws ERR_MODULE_NOT_FOUND.

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Skip Playwright + Next route files when collecting; the lib/ pure
    // functions are the only thing we care about for v1.
    include: ["lib/**/*.test.ts"],
  },
});
