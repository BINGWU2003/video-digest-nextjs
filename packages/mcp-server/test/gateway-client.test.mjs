import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { callVideoDigestTool } from "../dist/gateway-client.js";

test("callVideoDigestTool forwards tool calls to the web gateway", async () => {
  const server = createServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/mcp");
    assert.equal(request.headers.authorization, "Bearer mcp_test");

    let body = "";
    for await (const chunk of request) {
      body += chunk;
    }

    assert.deepEqual(JSON.parse(body), {
      input: {
        platform: "auto",
        url: "https://www.youtube.com/watch?v=test",
      },
      tool: "create_video_digest_job",
    });

    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        result: {
          created: true,
          recordId: "00000000-0000-0000-0000-000000000000",
          status: "queued",
        },
        tool: "create_video_digest_job",
      }),
    );
  });

  const webAppUrl = await listen(server);

  try {
    const result = await callVideoDigestTool(
      {
        token: "mcp_test",
        webAppUrl,
      },
      "create_video_digest_job",
      {
        platform: "auto",
        url: "https://www.youtube.com/watch?v=test",
      },
    );

    assert.deepEqual(result, {
      created: true,
      recordId: "00000000-0000-0000-0000-000000000000",
      status: "queued",
    });
  } finally {
    await close(server);
  }
});

test("callVideoDigestTool surfaces gateway errors", async () => {
  const server = createServer((_request, response) => {
    response.statusCode = 403;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        error: {
          code: "insufficient_scope",
          message: "MCP 令牌权限不足，无法调用该 tool。",
        },
      }),
    );
  });

  const webAppUrl = await listen(server);

  try {
    await assert.rejects(
      () =>
        callVideoDigestTool(
          {
            token: "mcp_test",
            webAppUrl,
          },
          "get_video_digest_record",
          {
            recordId: "00000000-0000-0000-0000-000000000000",
          },
        ),
      /403, insufficient_scope/,
    );
  } finally {
    await close(server);
  }
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Test server did not return a TCP address."));
        return;
      }

      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
