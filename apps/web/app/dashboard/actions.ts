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
  const outputMode =
    formData.get("outputMode") === "summary_and_email"
      ? "summary"
      : (formData.get("outputMode") ?? "transcript");
  const parsedInput = createVideoDigestJobInputSchema.safeParse({
    fallbackToAudio: formData.get("fallbackToAudio") === "on",
    outputMode,
    platform: formData.get("platform") ?? "auto",
    sendEmail: false,
    url: formData.get("url"),
  });

  if (!parsedInput.success) {
    redirectWithError(
      parsedInput.error.issues[0]?.message ?? "视频任务参数无效。",
    );
  }

  let recordId: string;
  let reusedExistingRecord = false;

  try {
    const supabase = createAdminClient();
    const result = await createVideoRecord(
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

    recordId = result.record.id;
    reusedExistingRecord = !result.created;
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

  redirect(
    reusedExistingRecord ? `/records/${recordId}?reused=1` : `/records/${recordId}`,
  );
}

function redirectWithError(message: string): never {
  redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}
