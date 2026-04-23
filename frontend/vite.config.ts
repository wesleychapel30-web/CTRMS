import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.CTRMS_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["e2e/**/*", "node_modules/**/*", "dist/**/*"]
  },
  server: {
    port: 5173,
    proxy: {
      "/api": apiProxyTarget,
      "/media": apiProxyTarget,
      "/export": apiProxyTarget
    }
  }
});
