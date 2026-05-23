"use server";

import {
  createSupabaseJobEventsRepository,
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
  type VideoRecordStatus,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { getVideoDigestQueue } from "@/lib/queue/video-digest-queue";
import { createAdminClient } from "@/lib/supabase/admin";

const retryVideoDigestJobFormSchema = z.object({
  id: z.uuid(),
});

const cancelVideoDigestJobFormSchema = z.object({
  id: z.uuid(),
});

export async function cancelVideoDigestJobAction(formData: FormData) {
  const user = await requireUser();
  const parsedInput = cancelVideoDigestJobFormSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedInput.success) {
    redirect("/records");
  }

  const recordId = parsedInput.data.id;

  try {
    const supabase = createAdminClient();
    const videoRecordsRepository = createSupabaseVideoRecordsRepository(supabase);
    const jobEventsRepository = createSupabaseJobEventsRepository(supabase);
    const record = await videoRecordsRepository.findByIdForUser({
      id: recordId,
      userId: user.id,
    });

    if (!record || !isCancellableStatus(record.status)) {
      redirect(`/records/${recordId}`);
    }

    const cancelledAt = new Date();

    await videoRecordsRepository.updateStatusForUser({
      completedAt: cancelledAt,
      errorCode: null,
      errorMessage: null,
      expectedStatus: record.status,
      id: record.id,
      status: "cancelled",
      userId: user.id,
    });

    try {
      await jobEventsRepository.create({
        message: "用户取消任务，后续 worker 阶段会停止处理。",
        metadata: {
          cancelledAt: cancelledAt.toISOString(),
          previousStatus: record.status,
        },
        recordId: record.id,
        status: "cancelled",
        userId: user.id,
      });
    } catch (eventCreateError) {
      console.error("Failed to persist cancel job event.", eventCreateError);
    }
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirect("/records");
    }

    throw caught;
  }

  revalidatePath(`/records/${recordId}`);
  revalidatePath("/records");
  revalidatePath("/dashboard");
  redirect(`/records/${recordId}`);
}

export async function retryVideoDigestJobAction(formData: FormData) {
  const user = await requireUser();
  const parsedInput = retryVideoDigestJobFormSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedInput.success) {
    redirect("/records");
  }

  const recordId = parsedInput.data.id;

  try {
    const supabase = createAdminClient();
    const videoRecordsRepository = createSupabaseVideoRecordsRepository(supabase);
    const jobEventsRepository = createSupabaseJobEventsRepository(supabase);
    const record = await videoRecordsRepository.findByIdForUser({
      id: recordId,
      userId: user.id,
    });

    if (!record || !isRetryableStatus(record.status)) {
      redirect(`/records/${recordId}`);
    }

    await videoRecordsRepository.updateStatusForUser({
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      expectedStatus: record.status,
      id: record.id,
      status: "queued",
      userId: user.id,
    });

    try {
      const retryQueuedAt = new Date();

      await jobEventsRepository.create({
        message: "用户重新提交失败任务，等待后台处理。",
        metadata: {
          previousErrorCode: record.errorCode,
          previousStatus: record.status,
          retriedAt: retryQueuedAt.toISOString(),
        },
        recordId: record.id,
        status: "queued",
        userId: user.id,
      });

      await getVideoDigestQueue().enqueueVideoDigestJob(
        {
          recordId: record.id,
          userId: user.id,
        },
        {
          queueJobId: `${record.id}-retry-${retryQueuedAt.getTime()}`,
        },
      );
    } catch (caught) {
      await videoRecordsRepository.updateStatusForUser({
        completedAt: new Date(),
        errorCode: "retry_enqueue_failed",
        errorMessage:
          caught instanceof Error ? caught.message : "重试任务入队失败。",
        expectedStatus: "queued",
        id: record.id,
        status: "failed",
        userId: user.id,
      });

      await jobEventsRepository.create({
        message:
          caught instanceof Error ? caught.message : "重试任务入队失败。",
        metadata: {
          previousErrorCode: record.errorCode,
          previousStatus: record.status,
        },
        recordId: record.id,
        status: "failed",
        userId: user.id,
      });
    }
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirect("/records");
    }

    throw caught;
  }

  revalidatePath(`/records/${recordId}`);
  revalidatePath("/records");
  revalidatePath("/dashboard");
  redirect(`/records/${recordId}`);
}

function isRetryableStatus(
  status: VideoRecordStatus,
): status is "cancelled" | "failed" {
  return status === "cancelled" || status === "failed";
}

function isCancellableStatus(
  status: VideoRecordStatus,
): status is
  | "delivering"
  | "extracting_audio"
  | "extracting_transcript"
  | "fetching_metadata"
  | "queued"
  | "summarizing"
  | "transcribing_audio" {
  return (
    status === "queued" ||
    status === "fetching_metadata" ||
    status === "extracting_transcript" ||
    status === "extracting_audio" ||
    status === "transcribing_audio" ||
    status === "summarizing" ||
    status === "delivering"
  );
}
