import assert from "node:assert/strict";
import { test } from "vitest";

import { loadConfig } from "../dist/config.js";

test("loadConfig reads explicit Video Digest env vars", () => {
  const config = loadConfig({
    VIDEO_DIGEST_MCP_TOKEN: "mcp_test",
    VIDEO_DIGEST_WEB_APP_URL: "http://localhost:3000/",
  });

  assert.deepEqual(config, {
    token: "mcp_test",
    webAppUrl: "http://localhost:3000",
  });
});

test("loadConfig falls back to WEB_APP_URL and MCP_TOKEN", () => {
  const config = loadConfig({
    MCP_TOKEN: "mcp_fallback",
    WEB_APP_URL: "https://example.com/app/",
  });

  assert.deepEqual(config, {
    token: "mcp_fallback",
    webAppUrl: "https://example.com/app",
  });
});

test("loadConfig requires a token", () => {
  assert.throws(
    () => loadConfig({ VIDEO_DIGEST_WEB_APP_URL: "http://localhost:3000" }),
    /Missing VIDEO_DIGEST_MCP_TOKEN/,
  );
});
