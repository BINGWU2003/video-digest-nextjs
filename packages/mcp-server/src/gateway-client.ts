import type {
  CreateVideoDigestJobInput,
  CreateVideoDigestJobOutput,
  GetVideoDigestRecordInput,
  VideoDigestRecordOutput,
} from "./schemas.js";

import type { VideoDigestMcpServerConfig } from "./config.js";

export type VideoDigestToolName =
  | "create_video_digest_job"
  | "get_video_digest_record";

type VideoDigestToolInputByName = {
  create_video_digest_job: CreateVideoDigestJobInput;
  get_video_digest_record: GetVideoDigestRecordInput;
};

type VideoDigestToolOutputByName = {
  create_video_digest_job: CreateVideoDigestJobOutput;
  get_video_digest_record: VideoDigestRecordOutput;
};

type GatewaySuccessResponse<TTool extends VideoDigestToolName> = {
  result: VideoDigestToolOutputByName[TTool];
  tool: TTool;
};

type GatewayErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export async function callVideoDigestTool<TTool extends VideoDigestToolName>(
  config: VideoDigestMcpServerConfig,
  tool: TTool,
  input: VideoDigestToolInputByName[TTool],
) {
  const response = await fetch(`${config.webAppUrl}/api/mcp`, {
    body: JSON.stringify({
      input,
      tool,
    }),
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "User-Agent": "@video-digest-nextjs/mcp-server/0.1.0",
    },
    method: "POST",
  });
  const responseText = await response.text();
  const responseBody = parseJson(responseText);

  if (!response.ok) {
    throw new Error(formatGatewayError(response.status, responseBody));
  }

  if (!isGatewaySuccessResponse(responseBody, tool)) {
    throw new Error("Video Digest MCP gateway returned an invalid response.");
  }

  return responseBody.result;
}

function parseJson(value: string): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function isGatewaySuccessResponse<TTool extends VideoDigestToolName>(
  value: unknown,
  tool: TTool,
): value is GatewaySuccessResponse<TTool> {
  return (
    typeof value === "object" &&
    value !== null &&
    "tool" in value &&
    value.tool === tool &&
    "result" in value
  );
}

function formatGatewayError(status: number, responseBody: unknown) {
  const error = isGatewayErrorResponse(responseBody)
    ? responseBody.error
    : null;

  if (error?.message) {
    return error.code
      ? `Video Digest gateway error (${status}, ${error.code}): ${error.message}`
      : `Video Digest gateway error (${status}): ${error.message}`;
  }

  if (typeof responseBody === "string" && responseBody.length > 0) {
    return `Video Digest gateway error (${status}): ${responseBody}`;
  }

  return `Video Digest gateway error (${status}).`;
}

function isGatewayErrorResponse(value: unknown): value is GatewayErrorResponse {
  return typeof value === "object" && value !== null && "error" in value;
}
