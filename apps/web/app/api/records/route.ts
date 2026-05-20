import {
  createSupabaseVideoRecordsRepository,
  videoPlatforms,
  videoRecordStatuses,
} from "@repo/database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

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
  const records = await repository.listForUser({
    userId: claims.sub,
    ...parsedQuery.data,
  });

  return NextResponse.json({
    records,
  });
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
