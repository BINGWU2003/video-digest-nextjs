import { createSupabaseVideoRecordsRepository } from "@video-digest-nextjs/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.uuid(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasSupabaseConfig()) {
    return jsonError("请先配置 Supabase 环境变量。", 500);
  }

  const parsedParams = paramsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return jsonError("记录 ID 无效。", 400);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return jsonError("未登录或登录已过期。", 401);
  }

  const repository = createSupabaseVideoRecordsRepository(supabase);
  const record = await repository.findByIdForUser({
    id: parsedParams.data.id,
    userId: claims.sub,
  });

  if (!record) {
    return jsonError("记录不存在。", 404);
  }

  return NextResponse.json({
    record,
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
