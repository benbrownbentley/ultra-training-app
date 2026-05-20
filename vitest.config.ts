import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

// vite-tsconfig-paths makes `@/lib/...` imports resolve in tests the
// same way Next.js does at build time. Without it, Vitest sees the bare
// alias and throws ERR_MODULE_NOT_FOUND.
//
// The `server-only` alias points Next.js's runtime guard at an empty
// shim so we can unit-test modules that import it (e.g. lib/claude.ts).
// `server-only` is meant to fail bundling when pulled into a client
// chunk — in Node tests there's no client/server distinction, so the
// shim is the documented workaround.

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "test/shims/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    // Skip Playwright + Next route files when collecting; the lib/ pure
    // functions are the only thing we care about for v1.
    include: ["lib/**/*.test.ts"],
  },
});
