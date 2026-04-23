var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
var currentDir = path.dirname(fileURLToPath(import.meta.url));
var repoRoot = path.resolve(currentDir, "..");
var e2eDatabasePath = path.join(repoRoot, "e2e-".concat(process.pid, "-").concat(Date.now(), ".sqlite3"));
var normalizedDatabasePath = e2eDatabasePath.replace(/\\/g, "/");
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    reporter: [["list"], ["html", { open: "never" }]],
    timeout: 90000,
    expect: {
        timeout: 10000,
    },
    use: {
        baseURL: "http://127.0.0.1:4174",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },
    webServer: [
        {
            command: "python manage.py migrate && python manage.py bootstrap_ctrms && python manage.py bootstrap_enterprise_e2e && python manage.py runserver 127.0.0.1:8010",
            url: "http://127.0.0.1:8010/api/session/",
            cwd: repoRoot,
            reuseExistingServer: false,
            timeout: 180000,
            env: __assign(__assign({}, process.env), { DATABASE_URL: "sqlite:///".concat(normalizedDatabasePath), DEBUG: "true", CORS_ALLOWED_ORIGINS: "http://127.0.0.1:4174,http://localhost:4174", CSRF_TRUSTED_ORIGINS: "http://127.0.0.1:4174,http://localhost:4174" }),
        },
        {
            command: "npm run dev -- --host 127.0.0.1 --port 4174",
            url: "http://127.0.0.1:4174/login",
            cwd: currentDir,
            reuseExistingServer: false,
            timeout: 120000,
            env: __assign(__assign({}, process.env), { CTRMS_API_PROXY_TARGET: "http://127.0.0.1:8010" }),
        },
    ],
    projects: [
        {
            name: "chromium",
            use: __assign({}, devices["Desktop Chrome"]),
        },
    ],
});
