"use server";

import {
  createSupabaseJobEventsRepository,
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
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

    if (!record || record.status !== "failed") {
      redirect(`/records/${recordId}`);
    }

    await videoRecordsRepository.updateStatusForUser({
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      expectedStatus: "failed",
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
