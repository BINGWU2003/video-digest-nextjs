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
      "在 Video Digest 中创建一个异步 YouTube 或 Bilibili 视频摘要任务。这个工具会立即返回 recordId 和状态；长视频、音频转写、摘要生成和邮件投递可能需要几分钟。不要在同一轮对话里等待任务完成，也不要反复轮询。把 recordId 告诉用户；只有当用户稍后要求查询状态或结果时，才调用 get_video_digest_record。",
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
      "读取 Video Digest 记录的当前快照，包括状态、字幕、摘要和投递状态。这个工具用于明确的状态查询或结果获取，不用于密集轮询。如果任务仍在排队或处理中，只需报告当前状态，并让用户稍后再查，不要继续等待。",
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
