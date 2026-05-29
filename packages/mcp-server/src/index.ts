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
      "Start an asynchronous YouTube or Bilibili video digest job in Video Digest. This returns immediately with a recordId and status; long videos, audio transcription, summary generation, and email delivery can take minutes. Do not wait for completion or repeatedly poll in the same turn. Give the user the recordId and only call get_video_digest_record later when the user asks for a status or result check.",
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
      "Read the current snapshot of a Video Digest record, including status, transcript, summary, and delivery state when available. Use for explicit status checks or result retrieval, not tight polling. If the job is still queued or processing, report the current status and ask the user to check again later instead of waiting.",
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
