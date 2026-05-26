import {
  createSupabaseJobEventsRepository,
  createSupabaseUsageEventsRepository,
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
  videoPlatforms,
  videoRecordStatuses,
} from "@video-digest-nextjs/database";
import { createVideoDigestJobInputSchema } from "@video-digest-nextjs/job-contracts";
import { createVideoRecord } from "@video-digest-nextjs/video-digest-core";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getVideoDigestQueue } from "@/lib/queue/video-digest-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const recordsQuerySchema = z.object({
  status: z.enum(videoRecordStatuses).optional(),
  platform: z.enum(videoPlatforms).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return jsonError("请先配置 Supabase 环境变量。", 500);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return jsonError("未登录或登录已过期。", 401);
  }

  const parsedQuery = recordsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsedQuery.success) {
    return jsonError(
      parsedQuery.error.issues[0]?.message ?? "查询参数无效。",
      400,
    );
  }

  const repository = createSupabaseVideoRecordsRepository(supabase);
  let records;

  try {
    records = await repository.listForUser({
      userId: claims.sub,
      ...parsedQuery.data,
    });
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      return jsonError(getMissingSchemaMessage(), 503);
    }

    throw caught;
  }

  return NextResponse.json({
    records,
  });
}

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

  const parsedInput = createVideoDigestJobInputSchema.safeParse(
    requestBody.value,
  );

  if (!parsedInput.success) {
    return jsonError(
      parsedInput.error.issues[0]?.message ?? "创建参数无效。",
      400,
    );
  }

  try {
    const supabaseAdmin = createAdminClient();
    const result = await createVideoRecord(
      {
        jobEventsRepository: createSupabaseJobEventsRepository(supabaseAdmin),
        usageEventsRepository:
          createSupabaseUsageEventsRepository(supabaseAdmin),
        videoDigestQueue: getVideoDigestQueue(),
        videoRecordsRepository:
          createSupabaseVideoRecordsRepository(supabaseAdmin),
      },
      {
        actor: {
          id: claims.sub,
          scopes: ["digest:create"],
          type: "user",
          userId: claims.sub,
        },
        input: parsedInput.data,
      },
    );

    return NextResponse.json(
      {
        created: result.created,
        record: result.record,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      return jsonError(getMissingSchemaMessage(), 503);
    }

    return jsonError(
      caught instanceof Error ? caught.message : "创建视频任务失败。",
      400,
    );
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

function getMissingSchemaMessage() {
  return "Supabase 数据表尚未创建。请先在 Supabase SQL Editor 执行 supabase/migrations/20260520213500_initial_video_digest_schema.sql。";
}
