import {
  createSupabaseJobEventsRepository,
  createSupabaseUsageEventsRepository,
  createSupabaseVideoRecordsRepository,
} from "@repo/database";
import { createVideoDigestJobInputSchema } from "@repo/job-contracts";
import { createVideoDigestJobTool } from "@repo/mcp-tools";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getVideoDigestQueue } from "@/lib/queue/video-digest-queue";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const toolRequestSchema = z.object({
  tool: z.literal("create_video_digest_job"),
  input: z.unknown(),
});

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return jsonError("请先配置 Supabase 环境变量。", 500);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return jsonError("未登录或登录已过期。", 401);
  }

  const requestBody = await readJson(request);

  if (!requestBody.ok) {
    return jsonError("请求体必须是有效 JSON。", 400);
  }

  const parsedBody = toolRequestSchema.safeParse(requestBody.value);

  if (!parsedBody.success) {
    return jsonError("MCP tool 请求格式无效。", 400);
  }

  const parsedInput = createVideoDigestJobInputSchema.safeParse(
    parsedBody.data.input,
  );

  if (!parsedInput.success) {
    return jsonError(
      parsedInput.error.issues[0]?.message ?? "Tool input 无效。",
      400,
    );
  }

  const tool = createVideoDigestJobTool;
  const actor = {
    type: "user" as const,
    id: claims.sub,
    userId: claims.sub,
    scopes: tool.requiredScopes,
  };

  const handler = tool.createHandler({
    videoRecordsRepository: createSupabaseVideoRecordsRepository(supabase),
    jobEventsRepository: createSupabaseJobEventsRepository(supabase),
    usageEventsRepository: createSupabaseUsageEventsRepository(supabase),
    videoDigestQueue: getVideoDigestQueue(),
  });

  try {
    const result = await handler(parsedInput.data, { actor });

    return NextResponse.json({
      tool: parsedBody.data.tool,
      result,
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "创建视频摘要任务失败。";

    return jsonError(message, 400);
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
