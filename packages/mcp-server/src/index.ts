#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  createVideoDigestJobInputSchema,
  getVideoDigestRecordInputSchema,
} from "./schemas.js";

import { loadConfig } from "./config.js";
import { callVideoDigestTool } from "./gateway-client.js";

const config = loadConfig(process.env);

const server = new McpServer({
  name: "video-digest",
  version: "0.1.0",
});

server.registerTool(
  "create_video_digest_job",
  {
    description:
      "Create a queued YouTube or Bilibili video digest job in Video Digest.",
    inputSchema: createVideoDigestJobInputSchema,
  },
  async (input) => {
    const result = await callVideoDigestTool(
      config,
      "create_video_digest_job",
      input,
    );

    return {
      content: [
        {
          text: JSON.stringify(result, null, 2),
          type: "text",
        },
      ],
    };
  },
);

server.registerTool(
  "get_video_digest_record",
  {
    description:
      "Read a Video Digest record with transcript, summary and delivery status.",
    inputSchema: getVideoDigestRecordInputSchema,
  },
  async (input) => {
    const result = await callVideoDigestTool(
      config,
      "get_video_digest_record",
      input,
    );

    return {
      content: [
        {
          text: JSON.stringify(result, null, 2),
          type: "text",
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("Video Digest MCP server running on stdio.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Video Digest MCP server failed: ${message}`);
  process.exit(1);
});
