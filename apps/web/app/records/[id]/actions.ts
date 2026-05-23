"use server";

import {
  createSupabaseJobEventsRepository,
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
} from "@repo/database";
import {
  cancelVideoDigestJob,
  retryVideoDigestJob,
} from "@repo/video-digest-core";
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
    const result = await cancelVideoDigestJob(
      {
        jobEventsRepository,
        onJobEventCreateError: (eventCreateError) => {
          console.error("Failed to persist cancel job event.", eventCreateError);
        },
        videoRecordsRepository,
      },
      {
        recordId,
        userId: user.id,
      },
    );

    if (!result.cancelled) {
      redirect(`/records/${recordId}`);
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
    const result = await retryVideoDigestJob(
      {
        jobEventsRepository,
        videoDigestQueue: getVideoDigestQueue(),
        videoRecordsRepository,
      },
      {
        recordId,
        userId: user.id,
      },
    );

    if (!result.retried) {
      redirect(`/records/${recordId}`);
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
