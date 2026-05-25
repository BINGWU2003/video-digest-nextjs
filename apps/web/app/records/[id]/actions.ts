"use server";

import {
  createSupabaseDeliveryRecordsRepository,
  createSupabaseEmailAddressesRepository,
  createSupabaseJobEventsRepository,
  createSupabaseSummariesRepository,
  createSupabaseUsageEventsRepository,
  createSupabaseVideoRecordsRepository,
  isMissingDatabaseSchemaError,
} from "@repo/database";
import {
  cancelVideoDigestJob,
  createResendEmailDeliveryProvider,
  createSummaryEmailHtml,
  createSummaryEmailLinks,
  createSummaryEmailSubject,
  createSummaryEmailText,
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

const redeliverSummaryEmailFormSchema = z.object({
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

export async function redeliverSummaryEmailAction(formData: FormData) {
  const user = await requireUser();
  const parsedInput = redeliverSummaryEmailFormSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedInput.success) {
    redirect("/records");
  }

  const recordId = parsedInput.data.id;
  const deliveryProvider = createResendEmailDeliveryProvider({
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
    userAgent: "video-digest-web/0.1",
  });

  try {
    const supabase = createAdminClient();
    const videoRecordsRepository = createSupabaseVideoRecordsRepository(supabase);
    const summariesRepository = createSupabaseSummariesRepository(supabase);
    const emailAddressesRepository =
      createSupabaseEmailAddressesRepository(supabase);
    const deliveryRecordsRepository =
      createSupabaseDeliveryRecordsRepository(supabase);
    const jobEventsRepository = createSupabaseJobEventsRepository(supabase);
    const usageEventsRepository = createSupabaseUsageEventsRepository(supabase);
    const [record, summary, emailAddress] = await Promise.all([
      videoRecordsRepository.findByIdForUser({
        id: recordId,
        userId: user.id,
      }),
      summariesRepository.findLatestForRecord({
        recordId,
        userId: user.id,
      }),
      emailAddressesRepository.findDefaultVerifiedForUser({
        userId: user.id,
      }),
    ]);

    if (!record) {
      redirect("/records");
    }

    if (!summary) {
      redirect(
        buildRecordDeliveryRedirect(
          recordId,
          "当前记录还没有摘要，暂时不能重新投递邮件。",
        ),
      );
    }

    if (!emailAddress) {
      redirect(
        buildRecordDeliveryRedirect(
          recordId,
          "未找到默认已验证收件邮箱，请先在邮箱设置中配置默认收件人。",
        ),
      );
    }

    const subject = createSummaryEmailSubject();
    const deliveryRecord = await deliveryRecordsRepository.create({
      recordId: record.id,
      userId: user.id,
      summaryId: summary.id,
      type: "email",
      targetId: emailAddress.id,
      subject,
    });
    const links = createSummaryEmailLinks(record, process.env.WEB_APP_URL);
    const text = createSummaryEmailText(record, summary, links);
    const html = createSummaryEmailHtml(record, summary, links);

    try {
      const deliveryResult = await deliveryProvider.sendEmail({
        html,
        subject,
        text,
        to: emailAddress.email,
      });
      const sentAt = new Date();

      await deliveryRecordsRepository.updateStatusForUser({
        id: deliveryRecord.id,
        userId: user.id,
        status: "sent",
        errorMessage: null,
        providerEventAt: sentAt,
        providerEventType: "email.sent",
        providerMessageId: deliveryResult.providerMessageId,
        sentAt,
      });

      await emailAddressesRepository.updateLastSentAt({
        id: emailAddress.id,
        userId: user.id,
        lastSentAt: sentAt,
      });

      await usageEventsRepository.create({
        userId: user.id,
        recordId: record.id,
        eventType: "email_sent",
        quantity: 1,
        unit: "count",
      });

      await jobEventsRepository.create({
        recordId: record.id,
        userId: user.id,
        status: "completed",
        message: "摘要邮件已重新提交服务商。",
        metadata: {
          deliveryId: deliveryRecord.id,
          emailAddressId: emailAddress.id,
          providerMessageId: deliveryResult.providerMessageId,
          summaryId: summary.id,
        },
      });
    } catch (caught) {
      const failedAt = new Date();

      await deliveryRecordsRepository.updateStatusForUser({
        id: deliveryRecord.id,
        userId: user.id,
        status: "failed",
        errorMessage: toErrorMessage(caught),
        providerEventAt: failedAt,
        providerEventType: "email.failed",
        sentAt: null,
      });

      await jobEventsRepository.create({
        recordId: record.id,
        userId: user.id,
        status: "failed",
        message: "摘要邮件重新投递失败。",
        metadata: {
          deliveryId: deliveryRecord.id,
          errorMessage: toErrorMessage(caught),
          summaryId: summary.id,
        },
      });

      redirect(
        buildRecordDeliveryRedirect(
          recordId,
          `重新投递失败：${toErrorMessage(caught)}`,
        ),
      );
    }
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirect("/records");
    }

    throw caught;
  }

  revalidatePath(`/records/${recordId}`);
  revalidatePath("/records");
  revalidatePath("/settings/emails");
  redirect(buildRecordDeliveryRedirect(recordId, "摘要邮件已重新提交服务商。"));
}

function buildRecordDeliveryRedirect(recordId: string, message: string) {
  return `/records/${recordId}?deliveryMessage=${encodeURIComponent(message)}`;
}

function toErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
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
