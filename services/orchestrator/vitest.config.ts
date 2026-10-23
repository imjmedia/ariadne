import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "ariadne-common": path.resolve(__dirname, "../../packages/ariadne-common/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
    globals: true,
  },
});

