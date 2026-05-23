"use server";

import {
  createSupabaseJobEventsRepository,
  createSupabaseUsageEventsRepository,
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
} from "@repo/database";
import { createVideoDigestJobInputSchema } from "@repo/job-contracts";
import { createVideoRecord } from "@repo/video-digest-core";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getVideoDigestQueue } from "@/lib/queue/video-digest-queue";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createVideoDigestJobAction(formData: FormData) {
  const user = await requireUser();
  const parsedInput = createVideoDigestJobInputSchema.safeParse({
    fallbackToAudio: formData.get("fallbackToAudio") === "on",
    outputMode: formData.get("outputMode") ?? "transcript",
    platform: formData.get("platform") ?? "auto",
    sendEmail: formData.get("outputMode") === "summary_and_email",
    url: formData.get("url"),
  });

  if (!parsedInput.success) {
    redirectWithError(
      parsedInput.error.issues[0]?.message ?? "视频任务参数无效。",
    );
  }

  let recordId: string;

  try {
    const supabase = createAdminClient();
    const record = await createVideoRecord(
      {
        jobEventsRepository: createSupabaseJobEventsRepository(supabase),
        usageEventsRepository: createSupabaseUsageEventsRepository(supabase),
        videoDigestQueue: getVideoDigestQueue(),
        videoRecordsRepository: createSupabaseVideoRecordsRepository(supabase),
      },
      {
        actor: {
          id: user.id,
          scopes: ["digest:create"],
          type: "user",
          userId: user.id,
        },
        input: parsedInput.data,
      },
    );

    recordId = record.id;
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirectWithError(
        "Supabase 数据表尚未创建。请先在 Supabase SQL Editor 执行 supabase/migrations/20260520213500_initial_video_digest_schema.sql。",
      );
    }

    redirectWithError(
      caught instanceof Error ? caught.message : "创建视频任务失败。",
    );
  }

  redirect(`/records/${recordId}`);
}

function redirectWithError(message: string): never {
  redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}
