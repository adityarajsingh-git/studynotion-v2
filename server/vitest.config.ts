import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Each file boots its own in-memory mongod; run them serially so we don't
    // spawn one per CPU core.
    fileParallelism: false,
    hookTimeout: 120_000, // first run downloads the mongod binary
    testTimeout: 20_000,
  },
});
