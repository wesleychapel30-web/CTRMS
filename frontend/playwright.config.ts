import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..");
const e2eDatabasePath = path.join(repoRoot, `e2e-${process.pid}-${Date.now()}.sqlite3`);
const normalizedDatabasePath = e2eDatabasePath.replace(/\\/g, "/");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "python manage.py migrate && python manage.py bootstrap_ctrms && python manage.py bootstrap_enterprise_e2e && python manage.py runserver 127.0.0.1:8010",
      url: "http://127.0.0.1:8010/api/session/",
      cwd: repoRoot,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        DATABASE_URL: `sqlite:///${normalizedDatabasePath}`,
        DEBUG: "true",
        CORS_ALLOWED_ORIGINS: "http://127.0.0.1:4174,http://localhost:4174",
        CSRF_TRUSTED_ORIGINS: "http://127.0.0.1:4174,http://localhost:4174",
      },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174/login",
      cwd: currentDir,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        CTRMS_API_PROXY_TARGET: "http://127.0.0.1:8010",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
