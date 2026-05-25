import {
  createSupabaseDeliveryRecordsRepository,
  createSupabaseJobEventsRepository,
  createSupabaseMcpTokensRepository,
  createSupabaseSummariesRepository,
  createSupabaseTranscriptsRepository,
  createSupabaseUsageEventsRepository,
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
  type McpTokenRow,
} from "@repo/database";
import {
  type Actor,
  createVideoDigestJobInputSchema,
  getVideoDigestRecordInputSchema,
} from "@repo/job-contracts";
import {
  createVideoDigestJobTool,
  getVideoDigestRecordTool,
} from "@repo/mcp-tools";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getVideoDigestQueue } from "@/lib/queue/video-digest-queue";
import { createMcpTokenHash, isMcpToken } from "@/lib/mcp/token-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const toolRequestSchema = z.object({
  tool: z.enum(["create_video_digest_job", "get_video_digest_record"]),
  input: z.unknown(),
});

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return jsonError("请先配置 Supabase 环境变量。", 500);
  }

  const supabaseAdmin = createAdminClient();
  const authenticatedActor = await authenticateRequest(request, supabaseAdmin);
  const requestBody = await readJson(request);

  if (!authenticatedActor.ok) {
    return jsonError(authenticatedActor.message, authenticatedActor.status);
  }

  if (!requestBody.ok) {
    return jsonError("请求体必须是有效 JSON。", 400);
  }

  const parsedBody = toolRequestSchema.safeParse(requestBody.value);

  if (!parsedBody.success) {
    return jsonError("MCP tool 请求格式无效。", 400);
  }

  const tool = getTool(parsedBody.data.tool);

  if (!hasRequiredScopes(authenticatedActor.actor.scopes, tool.requiredScopes)) {
    return jsonError("MCP 令牌权限不足，无法调用该 tool。", 403);
  }

  try {
    const result = await executeTool({
      actor: authenticatedActor.actor,
      input: parsedBody.data.input,
      supabaseAdmin,
      tool: parsedBody.data.tool,
    });

    if (authenticatedActor.token) {
      await createSupabaseMcpTokensRepository(supabaseAdmin).updateLastUsedAt({
        id: authenticatedActor.token.id,
        lastUsedAt: new Date(),
      });
    }

    return NextResponse.json({
      tool: parsedBody.data.tool,
      result,
    });
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      return jsonError(
        "Supabase 数据表尚未创建。请先在 Supabase SQL Editor 执行 supabase/migrations/20260520213500_initial_video_digest_schema.sql。",
        503,
      );
    }

    const message =
      caught instanceof Error ? caught.message : "创建视频摘要任务失败。";

    return jsonError(message, 400);
  }
}

type AuthenticatedRequest =
  | {
      actor: Actor;
      ok: true;
      token: McpTokenRow | null;
    }
  | {
      message: string;
      ok: false;
      status: number;
    };

async function authenticateRequest(
  request: NextRequest,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
): Promise<AuthenticatedRequest> {
  const bearerToken = parseBearerToken(request.headers.get("authorization"));

  if (bearerToken) {
    if (!isMcpToken(bearerToken)) {
      return {
        message: "MCP 令牌格式无效。",
        ok: false,
        status: 401,
      };
    }

    const token = await createSupabaseMcpTokensRepository(
      supabaseAdmin,
    ).findActiveByHash({
      now: new Date(),
      tokenHash: createMcpTokenHash(bearerToken),
    });

    if (!token) {
      return {
        message: "MCP 令牌不存在、已撤销或已过期。",
        ok: false,
        status: 401,
      };
    }

    return {
      actor: {
        id: token.id,
        scopes: token.scopes,
        type: "agent",
        userId: token.userId,
      },
      ok: true,
      token,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return {
      message: "未登录或登录已过期。",
      ok: false,
      status: 401,
    };
  }

  return {
    actor: {
      id: claims.sub,
      scopes: supportedScopes,
      type: "user",
      userId: claims.sub,
    },
    ok: true,
    token: null,
  };
}

const supportedScopes = ["digest:create", "digest:read"];

function parseBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    return null;
  }

  return token;
}

function hasRequiredScopes(actorScopes: string[], requiredScopes: string[]) {
  const actorScopeSet = new Set(actorScopes);

  return requiredScopes.every((scope) => actorScopeSet.has(scope));
}

function getTool(toolName: z.infer<typeof toolRequestSchema>["tool"]) {
  return toolName === "create_video_digest_job"
    ? createVideoDigestJobTool
    : getVideoDigestRecordTool;
}

async function executeTool({
  actor,
  input,
  supabaseAdmin,
  tool,
}: {
  actor: Actor;
  input: unknown;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  tool: z.infer<typeof toolRequestSchema>["tool"];
}) {
  if (tool === "create_video_digest_job") {
    const parsedInput = createVideoDigestJobInputSchema.safeParse(input);

    if (!parsedInput.success) {
      throw new ToolInputError(
        parsedInput.error.issues[0]?.message ?? "Tool input 无效。",
      );
    }

    return createVideoDigestJobTool
      .createHandler({
        jobEventsRepository: createSupabaseJobEventsRepository(supabaseAdmin),
        usageEventsRepository:
          createSupabaseUsageEventsRepository(supabaseAdmin),
        videoDigestQueue: getVideoDigestQueue(),
        videoRecordsRepository:
          createSupabaseVideoRecordsRepository(supabaseAdmin),
      })(parsedInput.data, { actor });
  }

  const parsedInput = getVideoDigestRecordInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw new ToolInputError(
      parsedInput.error.issues[0]?.message ?? "Tool input 无效。",
    );
  }

  return getVideoDigestRecordTool
    .createHandler({
      deliveryRecordsRepository:
        createSupabaseDeliveryRecordsRepository(supabaseAdmin),
      summariesRepository: createSupabaseSummariesRepository(supabaseAdmin),
      transcriptsRepository: createSupabaseTranscriptsRepository(supabaseAdmin),
      videoRecordsRepository: createSupabaseVideoRecordsRepository(supabaseAdmin),
    })(parsedInput.data, { actor });
}

class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

async function readJson(request: NextRequest) {
  try {
    return {
      ok: true as const,
      value: (await request.json()) as unknown,
    };
  } catch {
    return {
      ok: false as const,
    };
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status },
  );
}
